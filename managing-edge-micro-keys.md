## Managing Apigee Edge Micro-Gateway Keys

This document describes the backend API that is used by Apigee the Apigee Edge Micro-Gateway to provision credentials.

**DISCLAIMER**: This API is **not** published or documented as part of the [Apigee Edge Management APIs](https://apidocs.apigee.com/management/apis). 
This means that it is not supported by Apigee, and it may change at any time. Use it at your own risk.


### How it works
In Apigee Edge, after you install the edge micro-gateway, one of the first steps you do is to configure it.
As part of the configuration process, the micro-gateway provisions a key and secret. This key and secret are used
by the micro-gateway itself to authenticate the calls that are made to the Apigee Edge (on the cloud).




### Creating a new Edge Micro-Gateway key
```bash
curl -v \
    -X POST "https://edgemicroservices.apigee.net/edgemicro/credential/organization/${ORG}/environment/${ENV}" \
    -u "${APIGEE_USERNAME}:${APIGEE_PASSWORD}" \
    -H 'Content-Type: application/json' \
    -d '{
          "key": "unique-key",
          "secret": "secret-value"
        }'
```        

### Listing all existing Edge Micro-Gateway keys
```bash
curl -v \
     -X GET "https://edgemicroservices.apigee.net/edgemicro/credential/organization/${ORG}/environment/${ENV}" \
     -u "${APIGEE_USERNAME}:${APIGEE_PASSWORD}" \
     -H 'Accept: application/json'
```

### Deleting an existing Edge Micro-Gateway Key
```bash
curl -v \
     -X DELETE "https://edgemicroservices.apigee.net/edgemicro/credential/organization/${ORG}/environment/${ENV}" \
     -u "${APIGEE_USERNAME}:${APIGEE_PASSWORD}" \
     -H 'Accept: application/json' \
     -H 'Content-Type: application/json' \
     -d '{ "key": "<THE-KEY-TO-DELETE>"}' 
```        