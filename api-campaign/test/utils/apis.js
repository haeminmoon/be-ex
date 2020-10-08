Object.assign(global, require('ffp-js'))

const axios = require('axios')
const celebURL = go(
  process.env.STAGE,
  match
    .case(_ => process.env.LOCAL === 'true')(
      _ => 'http://localhost:3001'
    )
    .case(stage => stage === 'prod')(
      _ => 'https://api.celebplus.io'
    )
    .case(stage => stage === 'dev')(
      _ => 'https://api.dev.celeb-plus.io'
    )
    .case(stage => stage === 'staging')(
      _ => 'https://api.staging.celeb-plus.io'
    )
    .else(_ => 'https://api.dev.celeb-plus.io')
)

const celebRequest = axios.create({ baseURL: celebURL, timeout: 20000 })
celebRequest.interceptors.request.use(config => {
  if (process.env.LOCAL === 'true') {
    config.headers.email = AUTH.token.email
    config.headers.auth = AUTH.token.auth
  }
  else config.headers.Authorization = AUTH.token
  return config
})

const AUTH = {}
AUTH.token = null
AUTH.setHeadersAuthorization = authorizationToken => {
  if (process.env.LOCAL === 'true') {
    AUTH.token = {
      email: test_key.email,
      auth: test_key.auth
    }
  } 
  else AUTH.token = authorizationToken
}

const CAMPAIGN = {}

CAMPAIGN.getCampaign = id => celebRequest.get('/campaign/get_campaign', { params: { id }})
CAMPAIGN.getCampaignListByUser = params => celebRequest.get('/campaign/get_campaign_list_by_user', { params })
CAMPAIGN.getCampaignList = params => celebRequest.get('/campaign/get_campaign_list', { params })
CAMPAIGN.getCampaignCount = () => celebRequest.get('/campaign/get_campaign_count')
CAMPAIGN.getAppliedCampaignList = params => celebRequest.get('/campaign/get_applied_campaign_list', { params })
CAMPAIGN.getAppliedCampaignCount = () => celebRequest.get('/campaign/get_applied_campaign_count')
CAMPAIGN.getCampaignState = id => celebRequest.get('/campaign/get_campaign_state', { params: { id }})
CAMPAIGN.getCampaignCountByUser = () => celebRequest.get('/campaign/get_campaign_count_by_user')
CAMPAIGN.getCampaignId = id => celebRequest.get('/campaign/get_campaign_id', { params: { id }})

CAMPAIGN.createCampaign = body => celebRequest.post('/campaign/create_campaign', body)

CAMPAIGN.updateAppliedInfluencer = body => celebRequest.post('/campaign/update_applied_influencer', body)
CAMPAIGN.updateCancelInfluencer = body => celebRequest.post('/campaign/update_cancel_influencer', body)
CAMPAIGN.updateComment = body => celebRequest.post('/campaign/update_comment', body)
CAMPAIGN.updatePostingUrl = body => celebRequest.post('/campaign/update_postingUrl', body)
CAMPAIGN.updateInfluencerCheck = body => celebRequest.post('/campaign/update_influencer_check', body)
CAMPAIGN.updateInfluecnerPosting = body => celebRequest.post('/campaign/update_influencer_is_posting', body)
CAMPAIGN.updateSaleEnd = body => celebRequest.post('/campaign/update_sale_end', body)
CAMPAIGN.updateMainInfluencer = body => celebRequest.post('/campaign/update_main_influencer', body)
CAMPAIGN.updateCampaign = body => celebRequest.post('/campaign/update_campaign', body)
CAMPAIGN.updateHiddenInfluencer = body => celebRequest.post('/campaign/update_influencer_hidden', body)
CAMPAIGN.updateStopInfluencer = body => celebRequest.post('/campaign/update_influencer_stop', body)

CAMPAIGN.deleteCampaign = body => celebRequest.post('/campaign/delete_campaign', body)

module.exports = {
  AUTH,
  CAMPAIGN
}
