const AWS = require('aws-sdk')
const s3 = new AWS.S3()
const request = require('request')
Object.assign(global, require('ffp-js'))

const S3 = {}

S3.uploadImageToS3 = (Bucket, Key, Body, ContentType, ContentLength) => {
  return s3.upload({
    Bucket,
    Key,
    Body,
    ContentType,
    ContentLength
  }).promise()
}

S3.uploadFromUrlToS3 = (url, destPath) => {
  return new Promise((resolve, reject)=> {
    request(
      {
        url: url,
        encoding: null
      },
      (err, res, body) => {
        if (err) reject(err)
        resolve(S3.uploadImageToS3(
          process.env.BUCKET,
          destPath,
          body,
          res.headers['content-type'],
          res.headers['content-length']
        ))
      })
  })
}

module.exports = {
  S3
}