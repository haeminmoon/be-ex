const { go, map, log, tap, mapC, merge } = require('ffp-js')

const Credentials = require('./config/credentials')

const { PostgreSQL } = require('fxsql')
const { CONNECT } = PostgreSQL

const postgreStage = 'staging'

const { QUERY, MQL_DEBUG } = CONNECT(Credentials[postgreStage].spinDB)

// MQL_DEBUG.LOG = true

const jsonbExpression = (index, key) => `{${index}, ${key}}`

const addObjKey = _ => go(
  QUERY`SELECT id, applied_influencers FROM campaign ORDER BY id DESC`,
  map(({ id, applied_influencers }) => go(
    applied_influencers,
    inf => Array.from({ length: inf.length }, (v, i) => (i)),
    idxList => merge(idxList, applied_influencers),
    mapC(([idx, user]) => !user.instagram_url 
        ? QUERY`
            UPDATE 
              campaign 
            SET 
              applied_influencers = jsonb_set(applied_influencers, ${jsonbExpression(idx, 'posting_url')}, '[]'::JSONB)
            WHERE 
              id = ${id}`
        : QUERY`
            UPDATE 
              campaign 
            SET 
              applied_influencers = jsonb_set(applied_influencers, ${jsonbExpression(idx, 'posting_url')}, 
              (SELECT json_build_array(applied_influencers #> ${jsonbExpression(idx, 'instagram_url')}) FROM campaign WHERE id = ${id})::JSONB)
            WHERE 
              id = ${id}`
    )
  ))
)

const deleteObjKey = _ => go(
  QUERY`SELECT id, applied_influencers FROM campaign ORDER BY id DESC`,
  map(({ id, applied_influencers }) => go(
    applied_influencers,
    inf => Array.from({ length: inf.length }, (v, i) => i),
    mapC(idx => QUERY`
      UPDATE 
        campaign 
      SET 
        applied_influencers = applied_influencers #- ${jsonbExpression(idx, 'instagram_url')} WHERE id = ${id}`
    )
  ))
)

const execute = async _ => {
  log('-------------------------------------')
  // log('ADD KEY START')
  //   await addObjKey()
  // log('ADD KEY END')

  // log('DELETE KEY START')
  //   await deleteObjKey()
  // log('DELETE KEY END')
  log('-------------------------------------')
}
execute()