## Apigee GraphQL Demo Server

This repo contains a node module that uses [Apollo Server](https://www.apollographql.com/docs/apollo-server) server express 
middleware to expose a demo GraphQL API.

The schema for the GraphQL API follows the theme of a fictional company that aggregates information for
ski resort lifts and trails.

Along with the demo GraphQL API, this repo has a couple of extra plugins that demonstrate how to collect Apollo's GraphQL trace data
and send the records to Apigee Edge Analytics and Google Cloud Platform (GCP) Stackdriver.


## How to use it with docker

The node module has been conveniently dockerized so, you can start using right away without closing this repo or anything.

To use the docker image run the following command:

```bash
docker run \
        -it --rm  \
        -p 4000:4000 \
        --name apigee-graphql-server  \
        micovery/apigee-graphql-server
```

Then, just point your browser to http://localhost:4000, and you should see the GraphQL playground with the Ski resort schema.



## How to use it with Node.js

If you want to make changes to the code (for development), you can clone this repo, and run the GraphQL server
using `npm` and `node.js`. First clone this repo, then run the following commands:

1. Install NPM dependencies
    
    ```bash
    npm install
    ```
2. Start server
    
    ```bash
    npm start
    ```

### How to use the GCP Stackdriver plugin

By default, the GCP Stackdriver plugin is not enabled. 

In order to use the GCP Stackdriver plugin you have to pass the following environment variables to the GraphQL server.

* **GRAPHQL_GCP_PROJECT_ID**
    
    This is the project id for your Google Cloud Platform project.
* **GRAPHQL_GCP_SERVICE_ACCOUNT_JSON**
    
    This is the full json contents of your Google Cloud Platform service account. 
    The service account needs to have the following roles: **"Cloud Trace Agent"**, **"Log Writer"** in IAM.

When the server starts, if it detects the above two environment variables, it will load the GCP Stackdriver plugin.

Below is an example of how to start the server (passing the necessary env variables) using the docker image:


```bash
export GRAPHQL_GCP_PROJECT_ID="YOUR-GCP-PROJECT-ID"
export GRAPHQL_GCP_SERVICE_ACCOUNT_JSON=$(< ./path/to/service-account.json)

docker run \
        -it --rm  \
        -e "GRAPHQL_GCP_PROJECT_ID=${GRAPHQL_GCP_PROJECT_ID}" \
        -e "GRAPHQL_GCP_SERVICE_ACCOUNT_JSON=${GRAPHQL_GCP_SERVICE_ACCOUNT_JSON}" \
        -p 4000:4000 \
        --name apigee-graphql-server  \
        micovery/apigee-graphql-server
```

At this point, you can send GraphQL queries to the server, and they will show up in the Cloud Trace view.

### How to use the Apigee Edge Analytics plugin

By default, the Apigee Edge Analytics plugin is not enabled.

In order to use the Apigee Edge Analytics plugin you have to pass the following environment variables to the GraphQL server.

* **GRAPHQL_APIGEE_KEY**
    
    This is an Apigee Edge Micro-Gateway key (see [managing-edge-micro-keys](managing-edge-micro-keys.md))
* **GRAPHQL_APIGEE_SECRET**
    
    This is an Apigee Edge Micro-Gateway secret (see [managing-edge-micro-keys](managing-edge-micro-keys.md))

When the server starts, if it detects the above two environment variables, it will load the Apigee Edge Analytics plugin.

By itself, this plugin will not do anything. The idea is that you deploy this plugin in combination with an API Proxy in
Apigee Edge. The API proxy would logically sit in front of your GraphQL server and provide additional functionality such
as OAuth authorization, API key validation, etc. Take a look at at a sample API Proxy that this over at [github.com/micovery/apigee-graphql-proxy](https://github.com/micovery/apigee-graphql-proxy)


### Not Google Product Clause

This is not an officially supported Google product.