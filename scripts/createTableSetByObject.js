// tool
const { go, map, log, tap, filter, mapC, first, remove, find, take, takeAll, mapL, takeL, goFirst } = require('ffp-js');
function curry(f) {
  return (a, ..._) => _.length < 1 ? (..._) => f(a, ..._) : f(a, ..._);
}
const moment = require('moment')
// credential
const Credentials = require('./config/credentials');
// resource
const tableSchema = require('./resource/tableSchema')
// postgre sql
const { PostgreSQL } = require('fxsql');
const { CONNECT } = PostgreSQL;

const postgreStage = "prod";

const { QUERY, TABLE, VALUES, SQL, MQL_DEBUG } = CONNECT(Credentials[postgreStage].spinDB);

MQL_DEBUG.LOG = true

const mapObjL = curry(function *(f, obj) {
  for (const key in obj) {
    yield f([key, obj[key]])
  }
})

// go(
//   tableSchema.tables,
//   map(a => {
//     const table_name = a.table_name
//     let schema = go(
//       a,
//       remove('table_name'),
//       mapObjL(([k, v]) => `${k} ${v.type || ''} ${v.constraints || ''} ${v.default ? `DEFAULT ${v.default}` : ''}`),
//       takeAll
//     )
//     log(`--- ${table_name} TABLE SCHEMA ---`)
//     log(schema)
//     log('----------------------------------')
//     let text = `${table_name} (${schema.join(',')})`
//     log(text)
//     QUERY`CREATE TABLE ${text}`
//   })
// )
