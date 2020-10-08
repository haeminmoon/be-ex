const AWS = require('aws-sdk');

exports.call = (method, params) => {
    const cognito = new AWS.CognitoIdentityServiceProvider();
    return cognito[method](params).promise()
}