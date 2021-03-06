const { curry, go, log } = require('ffp-js')

exports.success = curry((headers, body) => buildResponse(200, body, headers))
exports.failure = curry((headers, body) => buildResponse(500, body, headers))
exports.badRequest = curry((headers, body) => buildResponse(400, body, headers))

const accessOriginList =
  [
    'http://localhost:8080',
    'https://dev.celeb-plus.io',
    'https://staging.celeb-plus.io',
    'https://celebplus.io',
    'http://dalpumae20181.godomall.io',
    'https://womanstalk.co.kr',
    'http://womanstalk.co.kr',
    'http://dev-celeb-plus-web-bucket.s3-website.ap-northeast-2.amazonaws.com'
  ]

const accessHostList =
  [
    'localhost:3000',
    'localhost:3001',
    'localhost:3002',
    'localhost:3003',
    'localhost:3004',
    'localhost:3005',
    'localhost:3006',
    'localhost:3007',
    'localhost:3008',
    'localhost:3009',
    'localhost:3010',
    'localhost:3011',
    'localhost:3012',
    'localhost:3013',
    'api.dev.celeb-plus.io',
    'api.staging.celeb-plus.io',
    'api.celebplus.io',
    'api.womanstalk.co.kr',
    'n2omp45sdf.execute-api.ap-northeast-2.amazonaws.com'
  ]

function buildResponse (statusCode, body, headers){
  return go(
    accessOriginList,
    list => !headers
      ?  ({
        statusCode: 200,
        body: 'access schedule'
      })
      : go(
        list,
        list => list.some(a => a === headers.origin),
        bool => !bool && !accessHostList.some(a => a === headers.Host)
          ? ({
            statusCode: 405,
            body: 'not allowed access'
          })
          : ({
            statusCode: statusCode,
            headers: {
              'Access-Control-Allow-Origin': headers.origin,
              'Access-Control-Allow-Credentials': true
            },
            body: JSON.stringify(body)
          })
      )
  )
}
