# celeb-services

이 프로젝트는 Serverless, micro architecture 를 기반으로 한 celeb-plus backend 프로젝트이다.

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

2 ttab 전역으로 설치

```bash
  $ npm intall ttab -g
```

#### 프로젝트 의존성 모듈 설치

```bash
  $ npm run install-dependencies
```
**Note**:   
serverless-offline, serverless-offline-ssm 모듈은 현 최신 버전으로 호환되지 않는다.  
serverless-offline(**ver.^4.7.1**) & serverless-offline-ssm(**ver.^4.1.2**)로 모듈을 설치를 해야한다.


## Build

#### 전제 조건

#### 준비

Layers 를 개인 local 환경에 배포해야 한다.
[layer_readme](https://github.com/spinprotocol/celebplus-layers/blob/develop/README.md)
```bash
  $ npm run deploy-layers-local
```

*`npm ttab`이 설치되어 있는지 확인한다. 설치되어 있다면 현재 프로젝트를 local 환경에서 구성하기 위한 준비가 끝닜다.*

#### 모든 API들 build

```bash
  $ STAGE=<stage_name> npm run offline-api
```

#### 하나의 API build

```bash
  $ STAGE=<stage_name> npm run offline-api-<api_name>
```

## Deployment 

- Lambda 서비스를 배포하기 전에 [Layers](https://github.com/spinprotocol/celeb-layers) 서비스를 먼저 배포해야 한다.
- `https://github.com/spinprotocol/celeb-layers` 저장소는 서브모듈로 현재 저장소에 포함되어있다.

현재 저장소를 처음 배포하는 것이라면 다음의 순서에 따라 배포해야 한다.
`resources -> celeb-layers -> APIs`

만약 배포과정에서 디버그 로그를 확인하고 싶으면 배포 커멘드를 입력하기 전 다음과 같은 환경변수를 선언한다.
```bash
  $ SLS_DEBUG=*
```

만약 AWS의 api gateway 서비스를 처음 배포하는 것이라면, 다른 서비스를 배포하기 전, AWS Certificate Manager를 통해 SSL 인증서를 생성해야 한다. 그리고 env.yml 파일의 domains 에 올바른 값을 넣는다. 일련의 과정이 왼료되었으면, Custom domain(개인 도메인)을 생성할 준비가 되었는데, 다음 명령어를 실행해서 도메인을 생성할 수 있다.
```bash
  $ STAGE=<stage_name> npm run create-custom-domain
```
이 개인 도메인 생성에는 약 40분정도 소요될 수 있으며, 개인 도메인을 생성할 때 단 한번만 수행된다.


### Mutli-service stack

mutli-service stack 전체를 업데이트한다.

```bash
  # 배포하기전 aws credential[profile] 파일을 스위칭하는 것을 기억해라!!
  $ STAGE=<stage_name> npm run deploy

  # dev stage를 예를 들어
  $ STAGE=dev npm run deploy
```

### Resource 배포

```bash
  $ STAGE=<stage_name> npm run deploy-resources
```

### Layers 배포

```bash
  $ STAGE=<stage_name> npm run deploy-layers
```

### APIs 배포

#### 전체 API들 배포

```bash
  $ STAGE=<stage_name> npm run deploy-api
  
  # The bApp-api 는 현재 스크립트에 포함되어 있지 않습니다!
```

#### 하나의 API 배포

```bash
  $ STAGE=<stage_name> npm run deploy-api-<service_name>

  # !! bApp-api 를 배포 할 때, 꼭 docker 가 설치되어 있아야 합니다!
```

## Remove

전체 mutli-service stack을 삭제

```bash
  $ STAGE=<stage_name> npm run remove
```
> 대상 스택을 완전히 삭제하는 remove 명령을 사용할 때는 주의하십시오.  
> 서비스 스택명이 일치하는지는 `package.json'을 보시오.

 Resource, Layers, APIs stack을 삭제하는 방식은 배포하는 방식과 동일하다.

## Test

Jest로 전체 apis를 삭제

```bash
  $ STAGE=<stage_name> npm run test-api
```
