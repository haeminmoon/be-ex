Object.assign(global, require('ffp-js'));
const axios = require('axios');

/*******************************************************
 *               Main objects initialize               *
 *******************************************************/

const USER = {};
const CAMPAIGN = {};
const BAPP = {};
const NOTICE = {};
const NOTIFICATION = {};
const MISSION = {};
const RL = {};
const EVENT = {};
const POSTING = {};

const UTIL = {};
const HEADER = {};
const STATE = {};

/*******************************************************
 *                  Axios setting                      *
 *******************************************************/

const celebURL = go(
  process.env.STAGE,
  match
    .case(_ => process.env.LOCAL === 'true')(
      _ => ({
        bApp: 'http://localhost:3000',
        campaign: 'http://localhost:3001',
        event: 'http://localhost:3002',
        notice: 'http://localhost:3003',
        notification: 'http://localhost:3004',
        revenueLedger: 'http://localhost:3005',
        transaction: 'http://localhost:3006',
        user: 'http://localhost:3007',
        mission: 'http://localhost:3008',
        category: 'http://localhost:3009',
        posting: 'http://localhost:3010'
      })
    )
    .case(stage => stage === 'prod')(
      _ => 'https://api.celebplus.io'
    )
    .case(stage => stage === 'dev')(
      _ => 'https://n2omp45sdf.execute-api.ap-northeast-2.amazonaws.com/dev'
    )
    .case(stage => stage === 'staging')(
      _ => 'https://api.staging.celeb-plus.io'
    )
    .else(_ => 'https://n2omp45sdf.execute-api.ap-northeast-2.amazonaws.com/dev')
);

const wtURL = go(
  process.env.STAGE,
  match
    .case(stage => stage === 'prod')(
      _ => 'https://hq6tste8th.execute-api.ap-northeast-2.amazonaws.com/prod'
    )
    .case(stage => stage === 'dev')(
      _ => 'https://rh1zmikd92.execute-api.ap-northeast-2.amazonaws.com/dev'
    )
    .case(stage => stage === 'staging')(
      _ => 'https://vt3xih5b23.execute-api.ap-northeast-2.amazonaws.com/staging'
    )
    .else(_ => 'https://rh1zmikd92.execute-api.ap-northeast-2.amazonaws.com/dev')
);

const user = axios.create({
  baseURL: celebURL.user || celebURL,
  timeout: 20000
})
const userOpen = axios.create({
  baseURL: celebURL.user || celebURL,
  timeout: 20000
})
const campaign = axios.create({
  baseURL: celebURL.campaign || celebURL,
  timeout: 20000
})
const notice = axios.create({
  baseURL: celebURL.notice || celebURL,
  timeout: 20000
})
const notification = axios.create({
  baseURL: celebURL.notification || celebURL,
  timeout: 20000
})
const revenueLedger = axios.create({
  baseURL: celebURL.revenueLedger || celebURL,
  timeout: 20000
})
const transaction = axios.create({
  baseURL: celebURL.transaction || celebURL,
  timeout: 20000
})
const event = axios.create({
  baseURL: celebURL.event || celebURL,
  timeout: 20000
})
const bApp = axios.create({
  baseURL: celebURL.bApp || celebURL,
  timeout: 20000
})
const mission = axios.create({
  baseURL: celebURL.mission || celebURL,
  timeout: 20000
})
const posting = axios.create({
  baseURL: celebURL.posting || celebURL,
  timeout: 20000
})


const wtRequest = axios.create({ baseURL: wtURL, timeout: 20000 });

HEADER.token = null;
HEADER.setAuthorization = headers => { 
  if (process.env.LOCAL) {
    HEADER.token = {
      email: headers.email,
      auth: headers.auth
    }
  } 
  else HEADER.token = headers.Authorization
}

go(
  [user, campaign, notice, notification, revenueLedger, transaction, event, bApp, mission, posting],
  map(axios => {
    axios.interceptors.request.use(config => {
      if (process.env.LOCAL) {
        config.headers.email = HEADER.token.email
        config.headers.auth = HEADER.token.auth
      }
      else config.headers.Authorization = HEADER.token
      return config
    })
  })
)

wtRequest.interceptors.request.use(config => {
  config.headers.Authorization = HEADER.token
  return config
})

/*******************************************************
 *                     User APIs                       *
 *******************************************************/

USER.getUserByEmail = email => user.get('/user/get_user_by_email', { params : { email } })
USER.getCompleteMission = email => user.get('/user/get_complete_mission', { params : { email } })

USER.createUser = body => userOpen.post('/user/create_user', body)
USER.createCognitoUser = body => userOpen.post('/user/create_cognito_user', body)

USER.updateUserInfo = body => user.post('user/update_user_info', body)
USER.updateWalletAddress = body => user.post('user/update_wallet_address', body)

USER.deleteUser = body => user.post('/user/delete_user', body)
USER.deleteCognitoUser = body => user.post('/user/delete_cognito_user', body)

/*******************************************************
 *                   Campaign APIs                     *
 *******************************************************/

CAMPAIGN.createCampaign = body => campaign.post('/campaign/create_campaign', body);

CAMPAIGN.updateCampaign = body => campaign.post('campaign/update_campaign', body)
CAMPAIGN.updateAppliedInfluencers = body => campaign.post('campaign/update_applied_influencer', body)
CAMPAIGN.updateCancelInfluencer = body => campaign.post('campaign/update_cancel_influencer', body)
CAMPAIGN.updateMainInfluencer = body => campaign.post('campaign/update_main_influencer', body)
CAMPAIGN.updateSaleEnd = body => campaign.post('/campaign/update_sale_end', body)
CAMPAIGN.updateComment = body => campaign.post('/campaign/update_comment', body)
CAMPAIGN.updateInfluencerStop = body => campaign.post('campaign/update_influencer_stop', body)
CAMPAIGN.updateInfluencerHidden = body => campaign.post('campaign/update_influencer_hidden', body)
CAMPAIGN.updateCancelMainInfluencer = body => campaign.post('campaign/update_cancel_main_influencer', body)
CAMPAIGN.updatePostingUrl = body => campaign.post('campaign/update_postingUrl', body)
CAMPAIGN.updateIsConfirm = body => campaign.post('campaign/update_is_confirm', body)

CAMPAIGN.deleteCampaign = body => campaign.post('/campaign/delete_campaign', body)

/*******************************************************
 *                     bApp APIs                       *
 *******************************************************/

BAPP.createCampaign = body => bApp.post('/bApp/klaytn_create_campaign', body);
BAPP.createRevenueLedger = body => bApp.post('/bApp/klaytn_create_revenueLedger', body)
BAPP.createReferralLedger = body => bApp.post('/bApp/klaytn_create_referral_ledger', body)
BAPP.pushHistory = body => bApp.post('/bApp/klaytn_push_history', body)
BAPP.addAuth = body => bApp.post('/bApp/klaytn_add_auth', body)

BAPP.updateCampaign = body => bApp.post('/bApp/klaytn_update_campaign', body)
BAPP.attendCampaign = body => bApp.post('/bApp/klaytn_attend_campaign', body)
BAPP.updateCancelInfluencer = body => bApp.post('/bApp/klaytn_cancel_campaign', body)
BAPP.updateSaleEnd = body => bApp.post('/bApp/klaytn_update_sale_end', body)
BAPP.revenueShare = body => bApp.post('/bApp/klaytn_revenueShare', body)

BAPP.deleteCampaign = body => bApp.post('/bApp/klaytn_delete_campaign', body);
BAPP.deleteRevenueLedger = body => bApp.post('/bApp/klaytn_delete_revenueLedger', body);
BAPP.deleteReferralLedger = body => bApp.post('/bApp/klaytn_delete_referral_ledger', body);
BAPP.removeAuth = body => bApp.post('/bApp/klaytn_remove_auth', body)
BAPP.removeHistory = body => bApp.post('/bApp/klaytn_remove_history', body)

BAPP.event_sendReward = body => bApp.post('/bApp/klaytn_send_reward', body);

BAPP.sendRawTxFeeDelegated = body => bApp.post('/bApp/klaytn_sendRawTx_feeDelegated', body);
BAPP.sendTokenIncelebContract = body => bApp.post('/bApp/klaytn_send_token_celeb_contract', body);

/*******************************************************
 *                     Notice APIs                     *
 *******************************************************/

NOTICE.createNotice = body => notice.post('notice/create_notice', body)

NOTICE.deleteNotice = body => notice.post('notice/delete_notice', body)

/*******************************************************
 *                 Notification APIs                   *
 *******************************************************/

NOTIFICATION.createNotification = body => notification.post('notification/create_notification', body)

NOTIFICATION.deleteNotification = body => notification.post('notification/delete_notification', body)

/*******************************************************
 *                 Notification APIs                   *
 *******************************************************/

MISSION.getMissionByID = id => mission.get('mission/get_mission_by_id', { params : { id }})
MISSION.getMissionList = _ => mission.get('mission/get_mission_list')

/*******************************************************
 *                       RL APIs                       *
 *******************************************************/

RL.updateRevenueLedger = body => revenueLedger.post('revenueLedger/update_revenueLedger', body)
RL.updateReferralLedger = body => revenueLedger.post('revenueLedger/update_referralLedger', body)

/*******************************************************
 *                       Event APIs                       *
 *******************************************************/

EVENT.getEventHistory = id => event.get('/event/get_event_history', { params: { id } })
EVENT.getEventHistoryWithIndex = id => event.get('/event/get_event_history_with_index', { params: { id } })
EVENT.receivesAmount = param => event.get('/event/get_receives_amount', { params: param })
EVENT.getEventSharingStatus = id => event.get('/event/get_event_sharing_status', { params: { id } })

EVENT.pushHistory = body => event.post('/event/push_history', body)
EVENT.removeHistory = body => event.post('/event/remove_history', body)
EVENT.updatePaidHistory = body => event.post('/event/update_paid_history', body)
EVENT.setEventSharingStatus = body => event.post('/event/set_event_sharing_status', body)


/*******************************************************
 *                       Posting APIs                       *
 *******************************************************/

POSTING.createPosting = data => posting.post('dashboard/create_posting', data)
POSTING.deletePosting = data => posting.post('dashboard/delete_posting', data)

/*******************************************************
 *                   Others section                    *
 *******************************************************/

UTIL.generateCall = (params, fns, type) => go(
  params,
  entriesL,
  filterL(([k, _]) => go(
    split('_', k), 
    filterL(a => a == type),
    head
  ) == type),
  map(([_, v]) => v),
  params => merge(fns[type], params)
);


STATE.INIT = 'init';
STATE.RETRY = 'retry';

STATE.VALUE = STATE.INIT;
STATE.getValue = _ => STATE.VALUE;
STATE.setValue = val => { STATE.VALUE = val }

module.exports = {
  USER, CAMPAIGN, BAPP, NOTICE, NOTIFICATION, RL, EVENT,
  UTIL, HEADER, STATE, MISSION, POSTING
}
