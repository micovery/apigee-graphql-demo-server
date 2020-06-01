// Copyright 2019 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const assert = require('assert');
const crypto = require('crypto');
const { google } = require('googleapis');
const cloudtrace = google.cloudtrace('v2');
const logging = google.logging('v2beta1');
const fs = require('fs').promises;

const DEFAULT_BUFFERSIZE = 10000;
const DEFAULT_FLUSHINTERVAL = 5000;
const DEFAULT_BATCHSIZE = 500;

/**
 * Options:
 *  projectId: 'GCPProjectId',
 *  serviceAccountFile: '/path/to/client_credentials.json',
 *  bufferSize: 'NumberOfRecordsInBuffer',
 *  flushInterval: 'HowOftenToFlushTheBuffer',
 *  batchSize: 'HowManyRecordsToSendInEachBatch'
 *
 */
class StackDriverGraphQLAX {
    constructor(options) {
        assert(options.projectId, 'GCP Project ID is required');

        assert(options.serviceAccountFile || options.serviceAccountJSON, 'GCP Service Account JSON text, or path to JSON/p12 file required');

        options.bufferSize = parseInt(options.bufferSize) ;
        options.flushInterval = parseInt(options.flushInterval);
        options.batchSize = parseInt(options.batchSize);

        options.bufferSize = (options.bufferSize <= 0 || isNaN(options.bufferSize))? DEFAULT_BUFFERSIZE: options.bufferSize;
        options.flushInterval = (options.flushInterval <= 0 || isNaN(options.flushInterval))? DEFAULT_FLUSHINTERVAL: options.flushInterval;
        options.batchSize = (options.batchSize <= 0 || isNaN(options.batchSize))? DEFAULT_BATCHSIZE: options.batchSize;

        this.spansBuffer = [];
        this.logsBuffer = [];

        this.options = options;

        this.intervalObject = setInterval(() => this.flushSpansAndLogs(), this.options.flushInterval);
        this.intervalObject.unref();

        return this;
    }

    static _hasTracing(response) {
        return response.extensions && response.extensions.tracing;
    }

     apply(response, context) {

        let {spans,logs} = this._makeSpansAndLogs(response, context);
        this._pushSpans(spans);
        this._pushLogs(logs);

        return response;
    }

    _pushSpans(spans) {
        this.spansBuffer.push.apply(this.spansBuffer, this._trimSpansToFit(spans));
    }

    _pushLogs(spans) {
        this.logsBuffer.push.apply(this.logsBuffer, this._trimSpansToFit(spans));
    }

    _trimSpansToFit(spans) {
        let freeSlots = this._feeSpanSlots();

        if ( freeSlots >= spans.length) {
            return spans;
        }

        return spans.slice(0, freeSlots - 1);
    }

    _trimLogsToFit(logs) {
        let freeSlots = this._freeLogSlots();

        if ( freeSlots >= logs.length) {
            return logs;
        }

        return logs.slice(0, freeSlots - 1);
    }

    _feeSpanSlots() {
        return this.options.bufferSize - this.spansBuffer.length;
    }

    _freeLogSlots() {
        return this.options.bufferSize - this.logsBuffer.length;
    }

    _makeSpansAndLogs(response, context) {
        let spans = [];
        let logs = [];

        if (!StackDriverGraphQLAX._hasTracing(response) || !context.req) {
            return {spans, logs};
        }

        let tracing = response.extensions.tracing;
        if (tracing.execution.resolvers.length === 0) {
            return {spans, logs};
        }

        let traceId = crypto.randomBytes(16).toString("hex");

        //build spans
        let mainSpan = this._makeMainSpan(traceId, tracing, context);
        spans.push(mainSpan);

        for (let resolver of tracing.execution.resolvers) {
            let span = this._makeSpan(traceId, mainSpan.spanId, tracing, context.req, resolver);
            spans.push(span);
        }

        //build logs
        let mainLog = this._makeMainLog(traceId, mainSpan.spanId, tracing, context);
        logs.push(mainLog);

        return {spans,logs};
    }

    _strValue(value) {
        return {
            stringValue: {
                value,
                truncatedByteCount: 0
            }
        }
    }

    _makeMainSpan(traceId, tracing, context) {
        let query = context.req.body.query;
        let operationName = context.req.body.operationName || '';

        let queryId = crypto.createHash('md5')
            .update(query)
            .update(operationName)
            .digest("hex");

        let type = tracing.execution.resolvers[0].parentType;
        let url = `graphql://${type}/${queryId}`;

        return this._makeSpan(traceId,
            "", tracing, context.req, {
                startOffset: 0,
                duration: tracing.duration,
                path: [url]
            },
            {
                "/graphql/hash": this._strValue(queryId),
                "/graphql/operation": this._strValue(operationName),
                "/graphql/query": this._strValue(context.req.body.query),
                "/http/method": this._strValue(this._getMethodFromRequest(context.req, 'POST')),
                "/http/url": this._strValue(url)
            }
        );
    }


    _makeMainLog(traceId, spanId, tracing, context) {

        let log = {
            logName: `projects/${this.options.projectId}/logs/${traceId}`,
            resource: {
                type: 'consumed_api',
                labels: {
                    project_id: this.options.projectId,
                    service: 'graphql',
                    method: this._getMethodFromRequest(context.req, 'POST'),
                    version: this._getRevFromRequest(context.req, '1'),
                    location: 'global'
                }
            },
            timestamp: this._getNanoTimeStamp(tracing.startTime, 0),
            insertId: traceId,
            trace: `projects/${this.options.projectId}/traces/${traceId}`,
            spanId,
            textPayload: context.req.body.query
        };

        return log;
    }

    _makeSpan(traceId, parentSpanId, tracing, req, resolver, attributeMap) {
        attributeMap = attributeMap || {};
        let spanId = crypto.randomBytes(8).toString("hex");
        let spanName = `projects/${this.options.projectId}/traces/${traceId}/spans/${spanId}`;


        let span = {
            name: spanName,
            spanId: spanId,
            parentSpanId,
            displayName: {
                value: `${resolver.path.join('/')}`,
                truncatedByteCount: 0
            },
            startTime: this._getNanoTimeStamp(tracing.startTime, resolver.startOffset),
            endTime: this._getNanoTimeStamp(tracing.startTime, (resolver.startOffset + resolver.duration)),
            attributes: {
                attributeMap
            }
        };

        return span;
    }

    _getMethodFromRequest(req, defaultValue) {
        return (req.headers['apigee-request-verb'] ||defaultValue).toUpperCase()
    }

    _getRevFromRequest(req, defaultValue) {
        return (req.headers['apigee-proxy-rev'] ||defaultValue);
    }

    _getNanoTimeStamp(startDateStr, nanoOffset) {
        let startDate = new Date(startDateStr);
        let millisComponent = startDate.getMilliseconds();

        let startTimeSeconds = parseInt((startDate.getTime() - millisComponent) / 1e3);

        let nanosComponent = nanoOffset + millisComponent * 1e6;
        let overFlowSeconds = parseInt(nanosComponent / (1e6*1e3));

        startTimeSeconds += overFlowSeconds;
        nanosComponent -= overFlowSeconds * 1e9;

        let nanoPart = (new Number(nanosComponent)).toString().padStart(9,'0');
        let date =  (new Date(startTimeSeconds * 1e3)).toISOString().replace('000Z', `${nanoPart}Z`);
        return date;
    }

    async flushSpansAndLogs() {
        await this.flushSpans();
        await this.flushLogs();
    }


    async flushLogs() {
        let logs = this.logsBuffer.splice(0, this.options.batchSize);
        if (logs.length == 0) {
            return;
        }

        let rejectedLogs = [];
        try {
            rejectedLogs = await this.publishLogs(logs);
        } catch(ex) {
            rejectedLogs = logs; //assume no items were pushed
        }

        if (!rejectedLogs || rejectedLogs.length == 0) {
            return;
        }

        this._pushLogs(rejectedLogs);
    }

    async flushSpans() {
        let spans = this.spansBuffer.splice(0, this.options.batchSize);
        if (spans.length == 0) {
            return;
        }

        let rejectedSpans = [];
        try {
            rejectedSpans = await this.publishSpans(spans);
        } catch(ex) {
            rejectedSpans = spans; //assume no items were pushed
        }

        if (!rejectedSpans || rejectedSpans.length == 0) {
            return;
        }

        this._pushSpans(rejectedSpans);
       
    }

    async getAuthClient() {
        if (this.authClient) {
            return this.authClient;
        }

        let json = this.options.serviceAccountJSON;
        if (this.options.serviceAccountFile) {
            json = (await fs.readFile(this.options.serviceAccountFile)).toString();
        }

        let parsedJson = null;
        try {
            parsedJson = JSON.parse(json)
        } catch(ex) {
            //try base-64 decoding it
            try {
                parsedJson = JSON.parse(Buffer.from(json, 'base64').toString());
            } catch(ex) {
                //no-op
            }
        }

        if (!parsedJson) {
            throw new Error('Cloud not load GCP Service account JSON');
        }

        let authClient = google.auth.fromJSON(parsedJson);

        this.authClient = authClient.createScoped([
            'https://www.googleapis.com/auth/trace.append',
            'https://www.googleapis.com/auth/logging.write',
            'https://www.googleapis.com/auth/cloud-platform'
        ]);

        return this.authClient;
    }

    async publishSpans(spans) {
        let response = await cloudtrace.projects.traces.batchWrite({
            auth: await this.getAuthClient(),
            name: `projects/${this.options.projectId}`,
            requestBody: {
                spans: spans
            }
        });

        return [];
    }

    async publishLogs(logs) {
        let response = await logging.entries.write({
            auth: await this.getAuthClient(),
            requestBody: {
                entries: logs
            }
        });

        return [];
    }
}

module.exports = StackDriverGraphQLAX;


