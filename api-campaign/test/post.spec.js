Object.assign(global, require('ffp-js'))
const { SSM } = require('/opt/libs/ssm-lib')
const { AUTH, CAMPAIGN } = require('./utils/apis')
let {
  id,
  email,
  campaign_data,
  inf_data,
  product_image,
  influencer_comment,
  index,
  posting_url,
  is_check,
  is_posting,
  sale_end_date,
  updated_at,
  is_hidden,
  is_stop
} = require('./utils/mock')

const notPick = (keys, obj) => Object
  .keys(obj)
  .filter(key => !keys.includes(key))
  .map((key) => ({ [key]: obj[key]}))
  .reduce((acc, obj) => Object.assign(acc, obj))

describe('post campaign api', () => {
  beforeAll(() => go(
    SSM.getParameter(`/${process.env.STAGE || 'dev'}/accessKey/celebTestKey`),
    ssm => AUTH.setHeadersAuthorization(ssm),
    _ => CAMPAIGN.createCampaign(campaign_data),
    ({ status, data }) => go(
      data,
      first,
      tap((data) => { id = inf_data.id = data.id}),
      data => expect(data).toEqual(expect.objectContaining(
        notPick([
          'apply_start_date',
          'apply_end_date',
          'sale_start_date',
          'sale_end_date',
          'shipping_date',
          'created_at'],
          campaign_data))),
      _ => CAMPAIGN.updateAppliedInfluencer(inf_data)
    )
  ))

  afterAll(() => go(
    CAMPAIGN.deleteCampaign({ id })
  ))

  it('updateComment api', async () => {
    const { status, data } = await CAMPAIGN.updateComment({
      id,
      product_image,
      influencer_comment,
    })
    // log(data)
    expect(data).toBeDefined()
    expect(status).toEqual(200)
  })

  it('updatePostingUrl api', async () => {
    const { status, data: [{applied_influencers: data}] } = await CAMPAIGN.updatePostingUrl({
      id,
      index,
      posting_url,
      updated_at
    })
    // log(data)
    expect(data).toContainEqual(expect.objectContaining({ posting_url }))
    expect(status).toEqual(200)
  })

  it('updateInfluencerCheck api', async () => {
    const { status, data: [{applied_influencers: data}]} = await CAMPAIGN.updateInfluencerCheck({
      id,
      is_check,
      updated_at
    })
    // log(data)
    expect(data).toContainEqual(expect.objectContaining({ is_check }))
    expect(status).toEqual(200)
  })

  it('updateInfluencerPosting api', async () => {
    const { status, data: [{applied_influencers: data}] } = await CAMPAIGN.updateInfluecnerPosting({
      id,
      index,
      is_posting
    })
    // log(data)
    expect(data).toContainEqual(expect.objectContaining({ content_is_posting: is_posting }))
    expect(status).toEqual(200)
  })

  it('updateSaleEnd api', async () => {
    const { status, data } = await CAMPAIGN.updateSaleEnd({
      id,
      sale_end_date,
      updated_at
    })
    expect(data).toContainEqual(expect.objectContaining({ sale_end_date: expect.any(String) }))
    expect(status).toEqual(200)
  })

  it('updateMainInfluencer api', async () => {
    const { status, data: [ data ] } = await CAMPAIGN.updateMainInfluencer({
      id,
      influencer_id: inf_data.applied_influencers.id,
      updated_at
    })
    const [ mainInf ] = data.main_influencers
    expect(mainInf).toEqual(inf_data.applied_influencers.id)
    expect(status).toEqual(200)
  })

  it('updateHiddenInfluencer api', async () => {
    const { status, data } = await CAMPAIGN.updateHiddenInfluencer({
      id,
      index,
      is_hidden
    })
    // expect(applied_influencers).toContainEqual(expect.objectContaining({'email': email, is_hidden}))
    expect(status).toEqual(200)
  })

  it('updateStopInfluencer api', async () => {
    const { status, data: [{ applied_influencers }] } = await CAMPAIGN.updateStopInfluencer({
      id,
      is_stop
    })
    // log(applied_influencers)
    expect(applied_influencers).toContainEqual(expect.objectContaining({ email: email, is_stop }))
    expect(status).toEqual(200)
  })

  it('updateCancelInfluencer api ', async () => {
    const { status, data: [{ applied_influencers: data }]} = await CAMPAIGN.updateCancelInfluencer({
      id,
      updated_at
    })
    // log(data)
    expect(data).toBeDefined()
    expect(status).toEqual(200)
  })

})
