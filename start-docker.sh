#!/usr/bin/env bash

docker run \
        -it --rm  \
        -e "GRAPHQL_APIGEE_KEY=${GRAPHQL_APIGEE_KEY}" \
        -e "GRAPHQL_APIGEE_SECRET=${GRAPHQL_APIGEE_SECRET}" \
        -e "GRAPHQL_GCP_PROJECT_ID=${GRAPHQL_GCP_PROJECT_ID}" \
        -e "GRAPHQL_GCP_SERVICE_ACCOUNT_JSON=${GRAPHQL_GCP_SERVICE_ACCOUNT_JSON}" \
        -p 4000:4000 \
        --name apigee-graphql-demo-server  \
        micovery/apigee-graphql-demo-server
