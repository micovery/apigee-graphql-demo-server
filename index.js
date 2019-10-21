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

const { ApolloServer:GraphQLServer} = require('apollo-server-express');
const express = require('express');
const { importSchema } = require('graphql-import');
const _ = require('lodash');
const Resolvers = require('./src/Resolvers');
const data = require('./resources/data.json');
const formatResponse = require('./src/ApigeeResponseFormatter');

const resolvers = new Resolvers({ data });


const server = new GraphQLServer({
    typeDefs: importSchema('./resources/schema.graphql'),
    resolvers ,
    tracing: true,
    caching: false,
    introspection: true,
    playground: true,
    context: ({ req }) => ({req}), //this is needed by the response format plugins
    formatResponse
});

const options = {
    port: process.env.PORT || 4000,
    endpoint: '/'
};

const app = express();
server.applyMiddleware({
    app,
    path: options.endpoint
});

app.listen(options, () =>
    console.log(`Server started, listening on port ${options.port} for incoming requests`)
);