# celeb-services

The project is Celeb Plus serverless backEnd project based micro service architecture

[KR](https://github.com/spinprotocol/celebplus-be/blob/develop/README_KR.md) | [EN](https://github.com/spinprotocol/celebplus-be)

#### Stack   
AWS Lambda, Api-gateway, S3, RDS(PostgrelSQL) 

#### Environment   
Node.js v12.16.1

## Installation

#### Prerequisite
1 Install serverless globally

```bash
  $ npm install serverless -g
```

2 Install ttab globally

```bash
  $ npm install ttab -g
```

#### Install project dependencies

```bash
  $ npm run install-dependencies
```

**Note**:   
serverless-offline, serverless-offline-ssm module is incompatible in latest version.  
Please install serverless-offline(**ver.^4.7.1**) & serverless-offline-ssm(**ver.^4.1.2**). 

## Build

#### Prerequisite

You have to deploy layers in your local.
[layer_readme](https://github.com/spinprotocol/celeb-layers/blob/develop/README.md)
```bash
  $ npm run deploy-layers-local
```

*Make sure `npm ttab` is installed. then, you are ready for build this API in your local environment*

#### build all APIs

```bash
  $ STAGE=<stage_name> npm run offline-api
```

#### build one API

```bash
  $ STAGE=<stage_name> npm run offline-api-<api_name>
```

## Deployment

Before deploying lambda services, be sure that you have already deployed Layers service with the same staging name from `https://github.com/spinprotocol/celeb-layers` repository which is a submodule in this repository. In order to update the submodule, go to `celeb-layers` directory and pull the latest commit. `$ cd celeb-layers && git pull`

Due to the fact that the services are coupled, they should be deployed in a certain order. Deployment order of the services as follows

`resources -> celeb-layers -> APIs`

While removing, the order should be reversed.

In order to see debug logs, before running the deploy command, export the serverless debug environment variable as follows

```bash
  $ export SLS_DEBUG=*
```

If you are deploying Api-Gateway service for the very first time, before deploying any other services, you should first need to create SSL Certificate through AWS Certificate Manager which should cover/be consistent with the domain name that you set for the API Gateway. Also after creating SSL Certificate, you need to run the following command to create custom domain and to add it to Route53.
  
```bash
  $ STAGE=<stage_name> npm run create-custom-domain
```

*This may take around 40 mins, but this is only one-time cost. You won't be needing to run this command later.*

### Mutli-service stack

Update the whole mutli-service stack

```bash
  # Must remember switching aws credential[profile] before deploy!!
  $ STAGE=<stage_name> npm run deploy

  # Example for dev stage
  $ STAGE=dev npm run deploy
```

### Resource deploy

```bash
  $ STAGE=<stage_name> npm run deploy-resources
```

### Layers deploy

```bash
  $ STAGE=<stage_name> npm run deploy-layers
```

### APIs deploy

#### Deploy the whole lambda services

```bash
  $ STAGE=<stage_name> npm run deploy-api

  # The bApp-api is not included in the deploy script!
```

#### Deploy a lambda service

```bash
  $ STAGE=<stage_name> npm run deploy-api-<service_name>

  # !! When bApp-api deploy, docker must be installed.
```

## Remove

Remove the whole mutli-service stack

```bash
  $ STAGE=<stage_name> npm run remove
```
> Be careful when using `remove` command which will completely delete targeted stack.
> See the `package.json` for the corresponding service stack names.


Removing Resource, Layers, APIs stack is the same as Deployment method.


## Test

Testing the whole apis with Jest

```bash
  $ STAGE=<stage_name> npm run test-api
```

