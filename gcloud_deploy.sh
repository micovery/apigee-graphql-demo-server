#!/bin/bash

TARGET_GCP_PROJECT_ID=${TARGET_GCP_PROJECT_ID:-miguelmendoza-external}

echo "Pulling Secrets ..."

APIGEE_BUILD_USER=$(gcloud secrets versions access latest --secret apigee_build_user)
APIGEE_BUILD_PASS=$(gcloud secrets versions access latest --secret apigee_build_pass)

GRAPHQL_APIGEE_KEY=$(gcloud secrets versions access latest --secret graphql_ax_key)
GRAPHQL_APIGEE_SECRET=$(gcloud secrets versions access latest --secret graphql_ax_secret)
GRAPHQL_GCP_PROJECT_ID=$(gcloud secrets versions access latest --secret graphql_gcp_project_id)
GRAPHQL_GCP_SERVICE_ACCOUNT_JSON=$(gcloud secrets versions access latest --secret graphql_gcp_service_account_json | base64)

echo "Deploying GraphQL server to cloud-run ..."

gcloud run deploy graphql-server --image gcr.io/${TARGET_GCP_PROJECT_ID}/graphql-server --platform managed --region us-west1  \
   --set-env-vars "GRAPHQL_APIGEE_KEY=${GRAPHQL_APIGEE_KEY}" \
   --set-env-vars "GRAPHQL_APIGEE_SECRET=${GRAPHQL_APIGEE_SECRET}" \
   --set-env-vars "GRAPHQL_GCP_PROJECT_ID=${GRAPHQL_GCP_PROJECT_ID}" \
   --set-env-vars "GRAPHQL_GCP_SERVICE_ACCOUNT_JSON=${GRAPHQL_GCP_SERVICE_ACCOUNT_JSON}"