const dynamoDbClient = require('serverless-dynamodb-client');
const { go } = require('ffp-js');

// In order to be able to test libraries on local,
// we need to use `serverless-dynamodb-client` instead of `aws-sdk`
exports.call = function (action, params) {
  const dynamoDb = dynamoDbClient.doc;
  return dynamoDb[action](params).promise();
};

exports.defaltParamsForPaging = (tableName, limit, lastKey) => {
  const lastEvaluatedKey = !id ? "0" : id;
  return {
    TableName: tableName,
    ExclusiveStartKey: lastKey,
    Limit: limit,
    ScanIndexForward: false
  }
}

exports.getAllItems = params => go(
  params,
  a => this.call('scan', a),
  result => result.Items
);

exports.getItem = params => go(
  params,
  a => this.call("get", a),
  result => result.Item
);

exports.createItem = params => go(
  params,
  a => this.call("put", a)
);

exports.updateItem = params => go(
  params,
  a => this.call("update", a)
);

exports.deleteItem = params => go(
  params,
  a => this.call("delete", a)
);

exports.getAllItemsForPaging = params => go(
  params,
  a => this.call('scan', a)
);
