const config = {
    host: process.env.wtDbHost,
    database: process.env.wtDbDatabase,
    user: process.env.wtDbUser,
    password: process.env.wtDbPassword
}

const mysql = require('serverless-mysql')({ config });

const { MySQL } = require('fxsql');
const { CONNECT } = MySQL;

const POOL = CONNECT(config);

exports.query = async (queryStr) => {
    let results = await mysql.query(queryStr);
    await mysql.end();
    return results;
};

exports.POOL = POOL;