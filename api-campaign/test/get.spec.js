Object.assign(global, require('ffp-js'))
const { SSM } = require('/opt/libs/ssm-lib')
const { AUTH, CAMPAIGN } = require('./utils/apis')
const {
  id,
  email,
  page,
  count,
  state,
  registrant_email
} = require('./utils/mock')

describe('get campaign api', () => {
  beforeAll(() => go(
    SSM.getParameter(`/${process.env.STAGE || 'dev'}/accessKey/celebTestKey`),
    ssm => AUTH.setHeadersAuthorization(ssm)
  ))

  it('getCampaign api', async () => {
    const { status, data } = await CAMPAIGN.getCampaign(id)
    // log(data)
    expect(data).toContainEqual(expect.objectContaining({ id }))
    expect(status).toEqual(200)
  })

  it('getCampaignListByUser api', async () => {
    const { status, data } = await CAMPAIGN.getCampaignListByUser({
      page,
      count
    })
    // log(data)
    expect(data).toEqual(expect.objectContaining({ status: expect.any(Boolean), list: expect.any(Array), count: expect.any(String) }));
    expect(status).toEqual(200);
  });


  it('getCampaignList api', async () => {
    const { status, data } = await CAMPAIGN.getCampaignList({
      page,
      count,
      state,
      registrant_email
    });
    // log(data);
    expect(data).toEqual(expect.objectContaining({ status: expect.any(Boolean), list: expect.any(Array), count: expect.any(String) }));
    expect(status).toEqual(200);
  });

  it('getCampaignCount api', async () => {
    const { status, data } = await CAMPAIGN.getCampaignCount();
    // log(data);
    expect(data).toContainEqual({ totalcount: expect.any(String), waitingcount: expect.any(String), progresscount: expect.any(String), completecount: expect.any(String)});
    expect(status).toEqual(200);
  })

  it('getAppliedCampaignList api', async () => {
    const { status, data } = await CAMPAIGN.getAppliedCampaignList({
      email,
      page,
      count
    })
    // log(data)
    expect(data).toEqual(expect.objectContaining({ status: expect.any(Boolean), list: expect.arrayContaining([expect.objectContaining({ id: expect.any(Number) })]), count: expect.any(String) }))
    expect(status).toEqual(200)
  })

  it('getAppliedCampaignCount api', async () => {
    const { status, data } = await CAMPAIGN.getAppliedCampaignCount()
    // log(data)
    expect(data).toContainEqual({ totalcount: expect.any(String), waitingcount: expect.any(String), progresscount: expect.any(String), completecount: expect.any(String)})
    expect(status).toEqual(200)
  })

  it('getCampaign state', async () => {
    const { status, data } = await CAMPAIGN.getCampaignState(id)
    // log(data)
    expect(data).toEqual({ state: expect.any(String) })
    expect(status).toEqual(200)
  })

  it('getCampaignCountByUser api', async () => {
    const { status, data } = await CAMPAIGN.getCampaignCountByUser()
    // log(data)
    expect(data).toBeDefined()
    expect(status).toEqual(200)
  })

  it('getCampaignId api', async () => {
    const { status, data } = await CAMPAIGN.getCampaignId()
    // log(data)
    expect(data).toContainEqual({ nextval: expect.any(String) })
    expect(status).toEqual(200)
  })
})
