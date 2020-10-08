// tool
const { go, map, log, tap, filter, mapC, first, remove, find } = require('ffp-js');
const moment = require('moment')
// credential
const Credentials = require('./config/credentials');
// resource
const TableNames = require('./resource/table')
// aws sdk
const AWS = require('aws-sdk');
// postgre sql
const { PostgreSQL } = require('fxsql');
const { CONNECT } = PostgreSQL;

const postgreStage = "prod";

const PGDB = CONNECT(Credentials[postgreStage].spinDB);

const awsStage = "prod";

AWS.config.region = Credentials[awsStage].region;

const dynamoDBCall = (method, params) => {
    const dynamoDB = new AWS.DynamoDB.DocumentClient();
    return dynamoDB[method](params).promise()
}

/**
 * @param { String } tableName 
 * @description : get table items
 */
const getDynamoDBItems = async (tableName) => {
    return go(
        await dynamoDBCall('scan', {
            TableName: tableName
        }),
        a => a.Items
    )
}

const getLocalTime = (date) => {
    return !date ? 
        null :
        moment(date).format('YYYY-MM-DDTHH:mm:ssZ')
}

// ---------------------------------------------------------------
/**
 * @name Postgre_users_test
 * @table user_test
 * @structure 
 *  {
 *      id:          { type: integer, constraints: [primery_key] },
 *      email:       { type: char(30), constraints: [unique] },
 *      user_info:   { type: jsonb },
 *      wallet_info: { type: jsonb },
 *      terms_agree: { type: jsonb },
 *      is_active:   { type: boolean },
 *      auth:        { type: char(30) },
 *      created_at:  { type: timestamp with timezone },
 *      updated_at:  { type: timestamp with timezone }
 *  }
 * @description : Dynamo DB [stage]-celeb-user migrate to Postgre DB users table.
 */
const migrateUser = async _ => {
    await go(
        getDynamoDBItems(TableNames[awsStage].dynamoDB_table_user),
        mapC(async user => go(
            user,
            a => Object.assign(a, {
                email: user.id,
                terms_agree: {
                    "terms": true,
                    "receiveMarketing": true,
                    "providing_personal_infomation": true
                },
                created_at: getLocalTime(user.created_at),
                updated_at: getLocalTime(user.updated_at)
            }),
            remove('id'),
            b => {
                delete b.user_info.wt_eh_list_idx
                return b
            },
            c => PGDB.QUERY`INSERT INTO users ${PGDB.VALUES(c)} RETURNING id`.then(
                ([pgUser]) => log(`Migrate user id : ${pgUser.id} / email : ${c.email}`)
            ).catch(err => log(err.detail || err))
        ))
    )
}
/**
 * @name CheckUserMigrationIsOk
 * @table users
 * @description : get dynamo DB and postgre DB uesr list, check is match and return response by log.
 *                if you want show the list, add this code at 'go' function
 *                `, a => log(' user list : ', a.users, '\n', 'matched user list : ', a.matched_users)`
 */
const compareUserList = async _ => {
    await go(
        getDynamoDBItems(TableNames[awsStage].dynamoDB_table_user),
        async dyUsers => {
            const pgUsers = go( await PGDB.QUERY`SELECT email FROM users`, map(a => a.email) )
            return ({ users: dyUsers, matched_users: filter(user => pgUsers.some(a => a === user.id), dyUsers) })
        },
        tap(a => log(`${a.users.length} users, matched user count ${a.matched_users.length} and not ${a.users.length - a.matched_users.length}`))
    )
}

// ---------------------------------------------------------------
/**
 * @name Postgre_campaign
 * @table campaign
 * @structure
 *  {
 *      id:                   { type: integer, constraints: [primery_key] },
 *      type:                 { type: text },
 *      gender:               { type: text },
 *      name:                 { type: text },
 *      product_code:         { type: text },
 *      revenue_ratio:        { type: text },
 *      limit_count:          { type: text },
 *      main_img:             { type: text },
 *      campaign_description: { type: text },
 *      mission_description:  { type: text },
 *      offer:                { type: text },
 *      hash_tag:             { type: text },
 *      guide:                { type: text },
 *      main_influencer:      { type: text },
 *      notice:               { type: text },
 *      apply_start_date:     { type: timestamp with timezone },
 *      apply_end_date:       { type: timestamp with timezone },
 *      shipping_date:        { type: timestamp with timezone },
 *      sale_start_date:      { type: timestamp with timezone },
 *      sale_end_date:        { type: timestamp with timezone },
 *      created_at:           { type: timestamp with timezone },
 *      updated_at:           { type: timestamp with timezone },
 *      applied_influencers:  { type: jsonb },
 *      product_price:        { type: integer },
 *      total_supply:         { type: text }
 *  }
 * @description : Dynamo DB [stage]-celeb-campaign migrate to Postgre DB campaign table.
 */
const migrateCampaign = async _ => go(
    getDynamoDBItems(TableNames[awsStage].dynamoDB_table_campaign),
    mapC(async campaign => go(
        campaign,
        async a => Object.assign(a, {
            type: "group",
            updated_at: a.update_at || null,
            applied_influencers: 
                a.applied_influencers.length === 0 
                    ? [] 
                    : await go(
                        a.applied_influencers,
                        map(async inf => go(
                            inf,
                            async a => !a 
                                ? a || {}
                                : Object.assign(a, {
                                    email: inf.id,
                                    id: await go( PGDB.QUERY`SELECT id FROM users WHERE email = ${inf.id}`, first, a =>!a ? null : a.id )
                                }),
                            remove('wt_wcrew_product_pick_idx'),
                            remove('user_idx')
                        )),
                        a => JSON.stringify(a)
                    )
            ,
            campaign_info: a.campaign_info,
            created_at: getLocalTime(a.created_at),
            updated_at: getLocalTime(a.updated_at),
            on_chain: false
        }),
        remove('id'),
        remove('wt_wcrew_product_idx'),
        remove('sort'),
        remove('update_at'),
        remove('commission'),
        remove('state'),
        b => PGDB.QUERY`INSERT INTO campaign ${PGDB.VALUES(b)} RETURNING id`.then(
            ([pgCampaign]) => log(`Migrate campaign id : ${pgCampaign.id} / name : ${b.name}`)
        ).catch(err => log(err))
    ))
)
// ---------------------------------------------------------------
/**
 * @name Postgre_notice
 * @table notice
 * @structure
 *  {
 *      id:         { type: integer, constraints: [primery_key] },
 *      title:      { type: text },
 *      content:    { type: text },
 *      created_at: { type: timestamp with timezone },
 *      updated_at: { type: timestamp with timezone }
 *  }
 */
const migrateNotice = async _ => go(
    getDynamoDBItems(TableNames[awsStage].dynamoDB_table_notice),
    mapC(async notice => go(
        notice,
        a => Object.assign(a, {
            created_at: getLocalTime(a.created_at),
            updated_at: getLocalTime(a.updated_at)
        }),
        remove('id'),
        b => PGDB.QUERY`INSERT INTO notice ${PGDB.VALUES(b)} RETURNING id`.then(
            ([pgNotice]) => log(`Migrate notice id : ${pgNotice.id} / title : ${b.title}`)
        ).catch(err => log(err))
    ))
)
// ---------------------------------------------------------------
/**
 * @name Postgre_notification
 * @table notification
 * @structure
 *  {
 *      id:             { type: integer, constraints: [primery_key] },
 *      content:        { type: text },
 *      icon:           { type: text },
 *      property:       { type: text },
 *      property_value: { type: text },
 *      receiver:       { type: text },
 *      created_at:     { type: timestamp with timezone },
 *      updated_at:     { type: timestamp with timezone }
 *  }
 */
const migrateNotification = async _ => {
    await go(
        getDynamoDBItems(TableNames[awsStage].dynamoDB_table_notification),
        mapC(async notification => await go(
            notification,
            async a => Object.assign(a, {
                created_at: getLocalTime(a.created_at),
                updated_at: getLocalTime(a.updated_at),
                property_value: !a.property_value 
                    ? null 
                    : a.property === 'campaign' 
                        ? await go(
                            PGDB.QUERY`SELECT id, main_img FROM campaign`,
                            find(pgCamps => pgCamps.main_img && pgCamps.main_img.split('/')[5] === a.property_value),
                            pgCamp => !pgCamp ? null : pgCamp.id)
                        : null
                ,
                receiver: await go(
                    a.receiver || [],
                    map(async receiver => {
                        !receiver.id 
                            ? receiver 
                            : receiver.id = await go(
                                PGDB.QUERY`SELECT id FROM users WHERE email = ${receiver.id}`, 
                                first, 
                                a => !a ? null : a.id)
                        return receiver
                    }),
                    receivers => JSON.stringify(receivers)
                )
            }),
            remove('id'),
            remove('sort'),
            b => PGDB.QUERY`INSERT INTO notification ${PGDB.VALUES(b)} RETURNING id`.then(
                ([pgNotification]) => log(`Migrate notification id : ${pgNotification.id}`)
            ).catch(err => log(err))
        ))
    )
}
// ---------------------------------------------------------------
/**
 * @name Migrate_DynamoDB_to_PostgreSQL
 * @TODO : log export file
 */
(async function execute () {
    /** @name user_table */
    // migrateUser()
    // compareUserList()

    /** @name campaign_table */
    // migrateCampaign()

    /** @name notice_table */
    // migrateNotice()

    /** @name notification_table */
    // migrateNotification()

    /** @name start_migration */
    const startMigration = async _ => {
        log('----------------------------------------')
        log('START user migration')
            await migrateUser()
        log('END user migration')
        log('----------------------------------------')
        log('START campaign migration')
            await migrateCampaign()
        log('END campaign migration')
        log('----------------------------------------')
        log('START notice migration')
            await migrateNotice()
        log('END notice migration')
        log('----------------------------------------')
        log('START notification migration')
            await migrateNotification()
        log('END notification migration')
        log('----------------------------------------')
    }
    startMigration()

    // log(getLocalTime(new Date()))
})()
