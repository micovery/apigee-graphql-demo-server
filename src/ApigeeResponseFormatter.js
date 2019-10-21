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

'use strict';

const ApigeeGraphQLAX = require('./ApigeeGraphQLAX');
const StackDriverGraphQLAX = require('./StackDriverGraphQLAX');



function loadStackDriverTracePlugin(plugins) {
    let projectId = process.env.GRAPHQL_GCP_PROJECT_ID;
    let serviceAccountJSON = process.env.GRAPHQL_GCP_SERVICE_ACCOUNT_JSON;

    if (projectId && serviceAccountJSON) {
        console.log("Loading Stackdriver logging/tracing plugin ...");
        plugins.push(new StackDriverGraphQLAX({projectId, serviceAccountJSON}))
    }
}

function loadApigeeAnalyticsPlugin(plugins) {
    let key = process.env.GRAPHQL_APIGEE_KEY;
    let secret = process.env.GRAPHQL_APIGEE_SECRET;

    if (key && secret) {
        console.log("Loading Apigee GraphQL analytics plugin ...");
        plugins.push(new ApigeeGraphQLAX({key, secret}))
    }
}


function deleteTracing(response) {
    if (!(response.extensions && response.extensions.tracing)) {
        response;
    }

    delete response.extensions.tracing;
    if(Object.keys(response.extensions).length == 0) {
        delete response.extensions;
    }

    return response;
}


function getFormatter() {
    let plugins = [];
    loadStackDriverTracePlugin(plugins);
    loadApigeeAnalyticsPlugin(plugins);


    return (response,  {context}) => {
        for (let plugin of plugins) {
            plugin.apply(response, context);
        }
        return deleteTracing(response);
    };
}



module.exports = getFormatter();