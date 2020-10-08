// tool
Object.assign(global, require("ffp-js"));

const { getSecretParameter } = require('/opt/libs/ssm-lib')

const moment = require('moment')
// credential
const Credentials = require('./config/credentials');
// resource
const tableSchema = require('./resource/tableSchema')
// postgre sql
const { PostgreSQL } = require('fxsql');
const { CONNECT } = PostgreSQL;

const postgreStage = "dev";
const postgreDB = "celebDB";

const { QUERY, TABLE, VALUES, SQL, MQL_DEBUG } = CONNECT(Credentials[postgreStage][postgreDB]);

/**
 * @name Create_table_campaign
 */
const campaignTable = _ => QUERY`
  CREATE TABLE campaign (
    id SERIAL PRIMARY KEY,
    type text,
    name text,
    main_img text,
    notice text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone,
    applied_influencers jsonb DEFAULT '[]'::jsonb,
    on_chain boolean DEFAULT true,
    registrant_email text,
    image_list jsonb DEFAULT '{}'::jsonb,
    campaign_info jsonb DEFAULT '{}'::jsonb,
    is_confirm boolean DEFAULT false,
    sub_type text
  )
`
.then(_ => log('create campaign table'))
.catch(err => log('error to create campaign table. \nthis error message : ', err.message))

/**
 * @name Create_table_event
 */
const eventTable = _ => QUERY`
  CREATE TABLE event (
    id SERIAL PRIMARY KEY,
    title text,
    limit_people text,
    provision_type text,
    provision_coin jsonb,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    history jsonb DEFAULT '[]'::jsonb,
    update_at timestamp with time zone,
    limit_per_capita text DEFAULT 1
  )
`
.then(_ => log('create event table'))
.catch(err => log('error to create event table. \nthis error message : ', err.message))

/**
 * @name Create_table_marketing
 */
const marketingTable = _ => QUERY`
CREATE TABLE marketing (
    id SERIAL PRIMARY KEY,
    email character varying(30) NOT NULL UNIQUE,
    created_at timestamp with time zone DEFAULT now(),
    is_subscribe boolean DEFAULT true
)
`
.then(_ => log('create marketing table'))
.catch(err => log('error to create marketing table. \nthis error message : ', err.message))

/**
 * @name Create_table_mission
 */
const missionTable = _ => QUERY`
CREATE TABLE mission (
    id SERIAL PRIMARY KEY,
    title text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
)
`
.then(_ => log('create mission table'))
.catch(err => log('error to create mission table. \nthis error message : ', err.message))

/**
 * @name Create_table_notice
 */
const noticeTable = _ => QUERY`
  CREATE TABLE notice (
    id SERIAL PRIMARY KEY,
    title text,
    content text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    writer text,
    reader text
  )
`
.then(_ => log('create notice table'))
.catch(err => log('error to create notice table. \nthis error message : ', err.message))

/**
 * @name Create_table_notification
 */
const notificationTable = _ => QUERY`
  CREATE TABLE notification (
    id SERIAL PRIMARY KEY,
    content text,
    icon text,
    property text,
    property_value text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    receiver jsonb DEFAULT '[]'::jsonb
  )
`
.then(_ => log('create notification table'))
.catch(err => log('error to create notification table. \nthis error message : ', err.message))

/**
 * @name Create_table_referralLedger
 */
const referralLedgerTable = _ => QUERY`
CREATE TABLE referral_ledger (
    id SERIAL PRIMARY KEY,
    parents_id integer,
    influencer_id integer,
    created_at timestamp with time zone DEFAULT now(),
    profit jsonb DEFAULT '{"spin": 0, "total": 0}'::jsonb,
    is_accounted boolean DEFAULT false,
    settlement_date text
)
`
.then(_ => log('create referralLedger table'))
.catch(err => log('error to create referralLedger table. \nthis error message : ', err.message))

/**
 * @name Create_table_revenue_ledger
 */
const revenueLedgerTable = _ => QUERY`
  CREATE TABLE revenue_ledger (
    id SERIAL PRIMARY KEY,
    campaign_id integer,
    influencer_id integer,
    sales_amount integer,
    sales_price integer,
    created_at timestamp with time zone DEFAULT now(),
    profit jsonb DEFAULT '{"fiat": 0, "spin": 0, "total": 0}'::jsonb,
    is_accounted boolean DEFAULT false,
    settlement_date text,
    is_condition boolean DEFAULT false
  )
`
.then(_ => log('create revenue_ledger table'))
.catch(err => log('error to create revenue_ledger table. \nthis error message : ', err.message))

/**
 * @name Create_table_reward_ledger
 */
const rewardLedgerTable = _ => QUERY`
  CREATE TABLE reward_ledger (
    id SERIAL PRIMARY KEY,
    campaign_id integer NOT NULL,
    influencer_id integer NOT NULL,
    sample_price integer,
    reward_price integer,
    profit jsonb DEFAULT '{"fiat": 0, "celeb": 0, "total": 0}'::jsonb,
    payment_date text,
    is_condition boolean DEFAULT false,
    is_paid boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
  )
`
.then(_ => log('create reward_ledger table'))
.catch(err => log('error to create reward_ledger table. \nthis error message : ', err.message))

/**
 * @name Create_table_posting
 */
const postingTable = _ => QUERY`
  CREATE TABLE posting (
    id SERIAL PRIMARY KEY,
    campaign_id integer NOT NULL,
    influencer_id integer NOT NULL,
    user_info jsonb DEFAULT '{}'::jsonb,
    sales_info jsonb DEFAULT '[]'::jsonb,
    media_info jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    view_count integer DEFAULT 0,
    posting_url jsonb DEFAULT '[]'::jsonb,
    is_connected boolean DEFAULT false
  )
`
.then(_ => log('create posting table'))
.catch(err => log('error to create posting table. \nthis error message : ', err.message))

/**
 * @name Create_table_users
 */
const usersTable = _ => QUERY`
  CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email character varying(30) NOT NULL UNIQUE,
    user_info jsonb DEFAULT '{}'::jsonb,
    wallet_info jsonb DEFAULT '{}'::jsonb,
    terms_agree jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    auth character varying(30),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    password jsonb DEFAULT '{"key": "XSuAmN3udfg5DUduCUBSBTr7x9+LW/TDywFHFhDmKSenu8LEQeYNdMkCg8QpdMzTjym/c+D6VVMLAiZ4XtNdOg==", "sub_key": "OEYq24khbuLsIfOAczlqEXR2gQmZRP37dD6ag22Nm/nciP/7mwJE9hhUZx5kFIOeWlS4vPHODeViCg1779RcLQ=="}'::jsonb,
    refresh_token text,
    is_verified_email boolean DEFAULT true
  )
`
.then(_ => log('create users table'))
.catch(err => log('error to create users table. \nthis error message : ', err.message))

/**
 * @name Create_table_wt_order
 */
const wt_orderTable = _ => QUERY`
CREATE TABLE wt_order (
    id SERIAL PRIMARY KEY,
    campaign_id integer NOT NULL,
    influencer_id integer NOT NULL,
    wt_user_id integer NOT NULL,
    product_code text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
)
`
.then(_ => log('create wt_order table'))
.catch(err => log('error to create wt_order table. \nthis error message : ', err.message))

/**
 * 
 * @name Create_table_category
 */
const categoryTable = _ => QUERY`
  CREATE TABLE category (
    id SERIAL PRIMARY KEY,
    title text NOT NULL UNIQUE
  )
`
.then(_ => log('create category table'))
.catch(err => log('error to create category table. \nthis error message : ', err.message))

/**
 * 
 * @name Create_table_bookmark
 */
const bookmarkTable = _ => QUERY`
  CREATE TABLE bookmark (
    id SERIAL PRIMARY KEY,
    user_email text NOT NULL,
    bookmark_info jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now()
  )
`
.then(_ => log('create bookmark table'))
.catch(err => log('error to create bookmark table. \nthis error message : ', err.message))

const excute = async _ => await go(
  [
    campaignTable,
    marketingTable,
    noticeTable,
    notificationTable,
    referralLedgerTable,
    revenueLedgerTable,
    rewardLedgerTable,
    postingTable,
    usersTable,
    categoryTable,
    bookmarkTable
    // eventTable,
    // missionTable,
    // wt_orderTable
  ],
  mapC(a => call(null, a))
)

excute()