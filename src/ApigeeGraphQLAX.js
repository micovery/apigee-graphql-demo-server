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

const axios = require('axios');
const assert = require('assert');
const {promisify} = require('util');
const zlib = require('zlib');
const gzipAsync = promisify(zlib.gzip).bind(zlib);
const crypto = require('crypto');

const DEFAULT_BUFFERSIZE = 10000;
const DEFAULT_FLUSHINTERVAL = 5000;
const DEFAULT_BATCHSIZE = 500;

/**
 * Options:
 *  org: 'ApigeeOrganization',
 *  env: 'ApigeeEnvironment',
 *  proxy: 'NameOfGraphQLProxy',
 *  rev: 'RevisionOfGraphQLProxy', (optional)
 *  key: 'EdgeMicroGatewayKey',
 *  secret: 'EdgeMicroGatewaySecret',
 *  bufferSize: 'NumberOfRecordsInBuffer',
 *  flushInterval: 'HowOftenToFlushTheBuffer',
 *  batchSize: 'HowManyRecordsToSendInEachBatch'
 *
 */
class ApigeeGraphQLAX {
    constructor(options) {
        assert(options.key, 'Edge Micro-Gateway key is required');
        assert(options.secret, 'Edge Micro-Gateway secret is required');

        options.bufferSize = parseInt(options.bufferSize) ;
        options.flushInterval = parseInt(options.flushInterval);
        options.batchSize = parseInt(options.batchSize);

        options.bufferSize = (options.bufferSize <= 0 || isNaN(options.bufferSize))? DEFAULT_BUFFERSIZE: options.bufferSize;
        options.flushInterval = (options.flushInterval <= 0 || isNaN(options.flushInterval))? DEFAULT_FLUSHINTERVAL: options.flushInterval;
        options.batchSize = (options.batchSize <= 0 || isNaN(options.batchSize))? DEFAULT_BATCHSIZE: options.batchSize;

        this.buffer = [];
        this.options = options;

        this.intervalObject = setInterval(() => this.flushItems(), this.options.flushInterval);
        this.intervalObject.unref();


        return this;
    }

    static _hasTracing(response) {
        return response.extensions && response.extensions.tracing;
    }



     apply(response, context) {

        let items =  this._makeItems(response, context);
        this._pushItems(items);

        return response;
    }

    _pushItems(items) {
        this.buffer.push.apply(this.buffer, this._trimToFit(items));
    }

    _trimToFit(items) {
        let freeSlots = this._freeSlots();

        if ( freeSlots >= items.length) {
            return items;
        }

        return items.slice(0, freeSlots - 1);
    }

    _freeSlots() {
        return this.options.bufferSize - this.buffer.length;
    }

    _makeItems(response, context) {
        if (!ApigeeGraphQLAX._hasTracing(response) || !context.req) {
            return [];
        }

        let queryId = crypto.createHash('md5')
            .update(context.req.body.query)
            .update(context.req.body.operationName||"")
            .digest("hex");

        let tracing = response.extensions.tracing;
        let items = [];


        let axUrl = context.req.headers['apigee-analytics-url'];
        if (!axUrl) {
            //console.warn('Request did not contain \'apigee-analytics-url\' header, will not send record to Apigee');
            return items;
        }


        for (let resolver of tracing.execution.resolvers) {
            let axRecord = this._makeAXRecord(queryId, tracing, context.req, resolver);
            items.push({axUrl, axRecord});
        }

        return items;
    }

     _makeAXRecord(queryId, tracing, req, resolver) {
        let requestStartMillis = new Date(tracing.startTime).getTime();

        let resolverStartMillis = requestStartMillis + (resolver.startOffset / 1e6);
        let resolverEndMillis = resolverStartMillis + (resolver.duration / 1e6);

        let type = tracing.execution.resolvers[0].parentType;

        let client_ip = req.headers['x-forwarded-for']||req.connection.remoteAddress.toString();
        client_ip = client_ip.split(',')[0];

        var axRecord = {
            client_received_start_timestamp:  resolverStartMillis,
            client_received_end_timestamp:    resolverStartMillis + 1, // hack to avoid error in server calculations
            recordType:                       'APIAnalytics',
            apiproxy:                         req.headers['apigee-proxy-name'],
            request_uri:                      `graphql://${type}/${queryId}`,
            request_path:                     this.generalizePath(resolver),
            request_verb:                     (req.headers['apigee-request-verb']||"POST").toUpperCase(),
            client_ip:                        client_ip,
            useragent:                        req.headers['user-agent'],
            apiproxy_revision:                req.headers['apigee-proxy-rev'],
            response_status_code:             200,
            client_sent_start_timestamp:      resolverEndMillis,
            client_sent_end_timestamp:        resolverEndMillis+1,
            developer_email:                  req.headers['apigee-developer-email'],
            developer_app:                    req.headers['apigee-developer-app-name'],
            client_id:                        req.headers['apigee-client-id'],
        };

        return axRecord;
    }

    generalizePath(resolver) {
        if (!resolver.path) {
            return;
        }
        return resolver.path.filter((el) => typeof el !== 'number').join('/');
    }

    async flushItems() {
        let batch = this.buffer.splice(0, this.options.batchSize);
        if (batch.length == 0) {
            return;
        }

        let groups = {};
        for (let item of batch) {
            if (!groups[item.axUrl]) {
                groups[item.axUrl] = [];
            }
            groups[item.axUrl].push(item);
        }


        for(let axUrl in groups) {
          let items = groups[axUrl];
            let rejectedItems = [];
            try {
                rejectedItems = await this.publishItems(axUrl, items);
            } catch(ex) {
                rejectedItems = items; //assume no items were pushed
            }

            if (!rejectedItems || rejectedItems.length == 0) {
                continue;
            }

            this._pushItems(rejectedItems);
        }

       
    }

    async publishItems(axUrl, items) {
        let axRecords = items.map((item)=> item.axRecord);
        let compressed = await gzipAsync(JSON.stringify({"records":axRecords}));

        let response = await axios({
            method: 'post',
            url: axUrl,
            headers: {
                'accept': 'application/json',
                'content-type': 'application/json',
                'content-encoding': 'gzip'
            },
            auth: {
                username: this.options.key,
                password: this.options.secret
            },
            data: compressed,
        });

        if (response.data && response.data.rejected > 0) {
            //apigee rejected some of the items
            return items.slice(items.length - response.body.rejected);
        }

        //apigee accepted all of the records
        return [];
    }
}

module.exports = ApigeeGraphQLAX;


