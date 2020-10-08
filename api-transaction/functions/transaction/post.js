Object.assign(global, require('ffp-js'))

const { success, failure } = require('/opt/libs/response-lib')
const { convertEvent2inputData } = require('/opt/libs/api-util-lib')
const { AUTH } = require('/opt/libs/authorizer-lib')
const {
  USER, CAMPAIGN, BAPP, NOTICE, NOTIFICATION, RL, EVENT,
  UTIL, HEADER, STATE, MISSION, POSTING
} = require('./APIs')

/** for sign up */
exports.tx_createUser = async (event, context) => {
  if (event.source === 'transaction-warmer') return

  const data = convertEvent2inputData(event)
  const fns = {
    tx: [
      USER.createCognitoUser,
      USER.createUser
    ],
    rb: [
      USER.deleteCognitoUser,
      USER.deleteUser
    ]
  }

  try {
    return await go(
      UTIL.generateCall(data, fns, 'tx'),
      calls => go(
        head(calls),
        ([ fn, params ]) => fn(params),
        _ => calls.slice(1)
      ),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: true,
          result: go(res, map(a => a.data))
        },
        success(event.headers)
      )
    )
  } catch (e) {
    log(e.config)
    return match(e.response.data.result)
      .case(e => e === 'An account with the given email already exists.')(
        _ => ({
          status: false,
          message: 'already existed user'
        }),
        failure(event.headers)
      )
      .case(e => e === 'Username should be an email.')(
        _ => ({
          status: false,
          message: 'wrong format email'
        }),
        failure(event.headers)
      )
      .case(e => e && (e.includes('password') || e.includes('Password')))(
        _ =>  ({
          status: false,
          message: 'wrong format password'
        }),
        failure(event.headers)
      )
      .else(
        _ => UTIL.generateCall(data, fns, 'rb'),
        tap(delay(3000)),
        mapC(([ fn, param ]) => fn(param).catch(e => { return {} })),
        _ => go(
          {
            status: false,
            message: e.response.data.result
          },
          failure(event.headers)
        )
      )
  }
}

/** for sign up */
exports.tx_createBusiness = async (event, context) => {
  if (event.source === 'transaction-warmer') return
  if (STATE.getValue() === STATE.RETRY) {
    return go(
      STATE.setValue(STATE.INIT),
      failure(event.headers)
    )
  }

  const data = convertEvent2inputData(event)
  const fns = {
    tx: [
      USER.createCognitoUser,
      USER.createUser
    ],
    rb: [
      USER.deleteCognitoUser,
      USER.deleteUser
    ]
  }

  try {
    return await go(
      UTIL.generateCall(data, fns, 'tx'),
      calls => go(
        head(calls),
        ([ fn, params ]) => fn(params),
        _ => calls.slice(1)
      ),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: true,
          result: go(res, map(a => a.data))
        },
        success(event.headers)
      )
    )
  } catch (e) {
    log(e.config)
    return match(e.response.data.result)
      .case(e => e === 'An account with the given email already exists.')(
        _ => ({
          status: false,
          message: 'already existed user'
        }),
        failure(event.headers)
      )
      .case(e => e === 'Username should be an email.')(
        _ => ({
          status: false,
          message: 'wrong format email'
        }),
        failure(event.headers)
      )
      .case(e => e.includes('password') || e.includes('Password'))(
        _ => ({
          status: false,
          message: 'wrong format password'
        }),
        failure(event.headers)
      )
      .else(
        _ => STATE.setValue(STATE.RETRY),
        _ => UTIL.generateCall(data, fns, 'rb'),
        tap(delay(3000)),
        mapC(([ fn, param ]) => fn(param).catch(e => { return {} })),
        _ => go(
          {
            status: false,
            message: e.response.data.result
          },
          failure(event.headers)
        )
      )
  }
}

/**
 * @name tx_createCampaign
 * @description: 캠페인 등록 spin, bapp 및 notification 생성. 실패시 rollback
 * @access `{ admin, business }`
 * @mock `{ tx: create_campaign_data, rb: rollback_data }`
 */
exports.tx_createCampaign = async (event, context) => {
  if (event.source === 'transaction-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.business))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )
  if (STATE.getValue() === STATE.RETRY)
    return go(
      STATE.setValue(STATE.INIT),
      failure(event.headers)
    )

  HEADER.setAuthorization(event.headers || null)

  const data = convertEvent2inputData(event)
  const fns = {
    tx: [
      NOTIFICATION.createNotification,
      CAMPAIGN.createCampaign,
      BAPP.sendRawTxFeeDelegated,
      BAPP.createCampaign
    ],
    rb: [
      NOTIFICATION.deleteNotification,
      CAMPAIGN.deleteCampaign,
      BAPP.sendRawTxFeeDelegated,
      BAPP.deleteCampaign
    ]
  }
  try {
    return await go(
      UTIL.generateCall(data, fns, 'tx'),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: true,
          result: go(res, map(a => a.data))
        },
        success(event.headers)
      )
    )
  } catch (e) {
    log(e.config)
    STATE.setValue(STATE.RETRY)

    return await go(
      UTIL.generateCall(data, fns, 'rb'),
      tap(delay(1000)),
      mapC(([ fn, param ]) => fn(param).catch(e => { log(e); return {} })),
      res => go(
        {
          status: false,
          reason: e.message,
          message: 'createCampaign tx rolled back.',
          result: go(res, map(a => a.data || 'unknown_error'))
        },
        failure(event.headers)
      )
    )
  }
}

/**
 * @name tx_updateCampaign
 * @description: 캠페인 변경 spin, bapp 및 notification 생성. 실패시 rollback
 * @access `{ admin, business }`
 * @mock `{ tx: update_campaign_data, rb: rollback_data }`
 */
exports.tx_updateCampaign = async (event, context) => {
  if (event.source === 'transaction-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.business))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )
  if (STATE.getValue() === STATE.RETRY)
    return go(
      STATE.setValue(STATE.INIT),
      failure(event.headers)
    )

  HEADER.setAuthorization(event.headers || null)

  const data = convertEvent2inputData(event)
  const fns = {
    tx: [
      NOTIFICATION.createNotification,
      CAMPAIGN.updateCampaign,
      BAPP.sendRawTxFeeDelegated,
      BAPP.updateCampaign
    ],
    rb: [
      NOTIFICATION.deleteNotification,
      CAMPAIGN.updateCampaign,
      BAPP.sendRawTxFeeDelegated,
      BAPP.updateCampaign
    ]
  }
  try {
    return await go(
      UTIL.generateCall(data, fns, 'tx'),
      mapC(([fn, param]) => fn(param)),
      res => go(
        {
          status: true,
          result: go(res, map(a => a.data))
        },
        success(event.headers)
      )
    )
  } catch (e) {
    log(e.config)
    STATE.setValue(STATE.RETRY)

    return await go(
      UTIL.generateCall(data, fns, 'rb'),
      tap(delay(1000)),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: false,
          reason: e.message,
          message: 'updateCampaign tx rolled back',
          result: go(res, map(a => a.data))
        },
        failure(event.headers)
      )
    )
  }
}

/**
 * @name tx_applyCampaign
 * @description: 캠페인 신청 spin, bapp. 실패시 rollback
 * @access `{ influencer }`
 * @mock `{ tx: apply_campaign_data, rb: rollback_data }`
 */
exports.tx_applyCampaign = async (event, context) => {
  if (event.source === 'transaction-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.influencer))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )
  if (STATE.getValue() === STATE.RETRY)
    return go(
      STATE.setValue(STATE.INIT),
      failure(event.headers)
    )

  HEADER.setAuthorization(event.headers || null)

  const data = convertEvent2inputData(event)

  const userEmail = event.requestContext.authorizer.email

  const fns = {
    tx: [
      CAMPAIGN.updateAppliedInfluencers,
      BAPP.sendRawTxFeeDelegated,
      BAPP.attendCampaign
    ],
    rb: [
      CAMPAIGN.updateCancelInfluencer,
      BAPP.sendRawTxFeeDelegated,
      BAPP.updateCancelInfluencer
    ]
  }

  try {
    return go(
      UTIL.generateCall(data, fns, 'tx'),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: true,
          result: go(res, map(a => a.data))
        },
        success(event.headers)
      )
    ).catch(
      match
        .case(e => e.response.data.message === 'Same influencer')
        (_ => ({
            status: false,
            message: 'Same influencer'
          }),
        failure(event.headers)
        )
        .case(e => e.response.data.message === 'Error limit')
        (_ => ({
            status: false,
            message: 'Error limit'
          }),
        failure(event.headers)
        )
        .else(e => ({
            status: false,
            message: e.message
          }),
        failure(event.headers)
        )
      )
  } catch (e) {
    STATE.setValue(STATE.RETRY)

    return await go(
      UTIL.generateCall(data, fns, 'rb'),
      // tap(delay(3000)),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: false,
          reason: e.message,
          message: 'applyCampaign tx rolled back',
          result: go(res, map(a => a.data))
        },
        failure(event.headers)
      )
    )
  }
}

/**
 * @name tx_selectMainInfluencer
 * @description: 캠페인 메인 인플루언서 선정. spin. 실패시 rollback
 * @access `{ admin, business }`
 * @mock `{ tx: select_main_influencer_data, rb: rollback_data }`
 */
exports.tx_selectMainInfluencer = async (event, context) => {
  if (event.source === 'transaction-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.business))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )
  if (STATE.getValue() === STATE.RETRY)
    return go(
      STATE.setValue(STATE.INIT),
      failure(event.headers)
    )

  HEADER.setAuthorization(event.headers || null)

  const data = convertEvent2inputData(event)
  const fns = {
    tx: [
      NOTIFICATION.createNotification,
      CAMPAIGN.updateMainInfluencer
    ],
    rb: [
      NOTIFICATION.deleteNotification,
      CAMPAIGN.updateCancelMainInfluencer
    ]
  }
  try {
    return await go(
      UTIL.generateCall(data, fns, 'tx'),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: true,
          result: go(res, map(a => a.data))
        },
        success(event.headers)
      )
    )
  } catch (e) {
    log(e.config)
    STATE.setValue(STATE.RETRY)

    return await go(
      UTIL.generateCall(data, fns, 'rb'),
      tap(delay(3000)),
      mapC(([fn, param]) => fn(param)),
      res => go(
        {
          status: false,
          reason: e.message,
          message: 'selected Main Influencer tx rolled back',
          result: go(res, map(a => a.data))
        },
        failure(event.headers)
      )
    )
  }
}

/**
 * @name tx_updateEndSale
 * @description: 캠페인 강제 종료. spin, bapp. 실패시 rollback
 * @access `{ admin, business }`
 * @mock `{ tx: end_sale_data, rb: rollback_data }`
 */
exports.tx_updateEndSale = async (event, context) => {
  if (event.source === 'transaction-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.business))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )
  if (STATE.getValue() === STATE.RETRY)
    return go(
      STATE.setValue(STATE.INIT),
      failure(event.headers)
    )

  HEADER.setAuthorization(event.headers || null)

  const data = convertEvent2inputData(event)
  const fns = {
    tx: [
      CAMPAIGN.updateSaleEnd,
      // BAPP.sendRawTxFeeDelegated
      // BAPP.updateSaleEnd
    ],
    rb: [
      CAMPAIGN.updateSaleEnd,
      // BAPP.sendRawTxFeeDelegated
      // BAPP.updateSaleEnd
    ]
  }
  try {
    return await go(
      UTIL.generateCall(data, fns, 'tx'),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: true,
          result: go(res, map(a => a.data))
        },
        success(event.headers)
      )
    )
  } catch (e) {
    log(e.config)
    STATE.setValue(STATE.RETRY)

    return await go(
      UTIL.generateCall(data, fns, 'rb'),
      // tap(delay(3000)),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: false,
          reason: e.message,
          message: 'update end sale tx rolled back',
          result: go(res, map(a => a.data))
        },
        failure(event.headers)
      )
    )
  }
}

/**
 * @name tx_updateCampaignNotice
 * @description: 캠페인 공지 등록 및 notificaion 생성. spin. 실패시 rollback
 * @access `{ admin, business }`
 * @mock `{ tx: apply_campaign_data, rb: rollback_data }`
 */
exports.tx_updateCampaignNotice = async (event, context) => {
  if (event.source === 'transaction-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.business))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )
  if (STATE.getValue() === STATE.RETRY)
    return go(
      STATE.setValue(STATE.INIT),
      failure(event.headers)
    )

  HEADER.setAuthorization(event.headers || null)

  const data = convertEvent2inputData(event)
  const fns = {
    tx: [
      NOTIFICATION.createNotification,
      CAMPAIGN.updateCampaign
    ],
    rb: [
      NOTIFICATION.deleteNotification,
      CAMPAIGN.updateCampaign
    ]
  }
  try {
    return await go(
      UTIL.generateCall(data, fns, 'tx'),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: true,
          result: go(res, map(a => a.data))
        },
        success(event.headers)
      )
    )
  } catch (e) {
    log(e.config)
    STATE.setValue(STATE.RETRY)

    return await go(
      UTIL.generateCall(data, fns, 'rb'),
      tap(delay(3000)),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: false,
          reason: e.message,
          message: 'update campaign notice tx rolled back',
          result: go(res, map(a => a.data))
        },
        failure(event.headers)
      )
    )
  }
}

/**
 * @name tx_referralPayment
 * @description: 추천인 리워드 정산. spin, bapp. 실패시 rollback
 * @access `{ admin }`
 * @mock `{ tx: referral_payment_data, rb: rollback_data }`
 */
exports.tx_referralPayment = async (event, context) => {
  if (event.source === 'transaction-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.master))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )
  if (STATE.getValue() === STATE.RETRY)
    return go(
      STATE.setValue(STATE.INIT),
      failure(event.headers)
    )

  HEADER.setAuthorization(event.headers || null)

  const data = convertEvent2inputData(event)

  const fns = {
    tx: [
      BAPP.createReferralLedger,
      RL.updateReferralLedger
    ],
    rb: [
      BAPP.deleteReferralLedger,
      RL.updateReferralLedger
    ]
  }
  try {
    return await go(
      UTIL.generateCall(data, fns, 'tx'),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: true,
          result: go(res, map(a => a.data))
        },
        success(event.headers)
      )
    )
  } catch (e) {
    log(e.config)
    STATE.setValue(STATE.RETRY)

    return await go(
      UTIL.generateCall(data, fns, 'rb'),
      tap(delay(3000)),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: false,
          reason: e.message,
          message: 'referral payment tx rolled back',
          result: go(res, map(a => a.data))
        },
        failure(event.headers)
      )
    )
  }
}

/**
 * @name tx_createNotice
 * @description: 공지 및 notification 생성. spin. 실패시 rollback
 * @access `{ admin }`
 * @mock `{ tx: notice_data, rb: rollback_data }`
 */
exports.tx_createNotice = async (event, context) => {
  if (event.source === 'transaction-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )
  if (STATE.getValue() === STATE.RETRY)
    return go(
      STATE.setValue(STATE.INIT),
      failure(event.headers)
    )

  HEADER.setAuthorization(event.headers || null)

  const data = convertEvent2inputData(event)

  const fns = {
    tx: [
      NOTICE.createNotice,
      NOTIFICATION.createNotification
    ],
    rb: [
      NOTICE.deleteNotice,
      NOTIFICATION.deleteNotification
    ]
  }

  try {
    return await go(
      UTIL.generateCall(data, fns, 'tx'),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: true,
          result: go(res, map(a => a.data))
        },
        success(event.headers)
      )
    )
  } catch (e) {
    log(e.config)
    STATE.setValue(STATE.RETRY)

    return await go(
      UTIL.generateCall(data, fns, 'rb'),
      tap(delay(3000)),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: false,
          reason: e.message,
          message: 'create notice tx rolled back',
          result: go(res, map(a => a.data))
        },
        failure(event.headers)
      )
    )
  }
}

/**
 * @name tx_payment
 * @description: 정산. spin, bapp. 실패시 rollback
 * @access `{ admin }`
 * @mock `{ tx: payment_data, rb: rollback_data }`
 */
exports.tx_payment = async (event, context) => {
  if (event.source === 'transaction-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.master))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )
  if (STATE.getValue() === STATE.RETRY) return go(STATE.setValue(STATE.INIT), failure(event.headers))

  const data = convertEvent2inputData(event)

  HEADER.setAuthorization(event.headers || null)

  const fns = {
    tx: [
      BAPP.createRevenueLedger,
      RL.updateRevenueLedger
    ],
    rb: [
      BAPP.deleteRevenueLedger,
      RL.updateRevenueLedger
    ]
  }
  try {
    return await go(
      UTIL.generateCall(data, fns, 'tx'),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: true,
          result: go(res, map(a => a.data))
        },
        success(event.headers)
      )
    )
  } catch (e) {
    log(e.config)
    STATE.setValue(STATE.RETRY)

    return await go(
      UTIL.generateCall(data, fns, 'rb'),
      tap(delay(3000)),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: false,
          reason: e.message,
          message: 'payment data tx rolled back',
          result: go(res, map(a => a.data))
        },
        failure(event.headers)
      )
    )
  }
}


/**
 * @name tx_sendReward
 * @description: 이벤트 보상 전송.
 * @access `{ admin }`
 * @mock `{ eventId, count }`
 */
exports.tx_sendReward = async (event, context) => {
  if (event.source === 'transaction-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )
  if (STATE.getValue() === STATE.RETRY)
    return go(
      STATE.setValue(STATE.INIT),
      failure(event.headers)
    )

  HEADER.setAuthorization(event.headers || null)

  const { eventId, count } = convertEvent2inputData(event)

  const convertArrayToContractCallData = dataArr => {
    let _userId = []
    let _userWallet = []
    let _rewardAmount = []

    dataArr.forEach(v => {
      _userId.push(v.email)
      _userWallet.push(v.wallet)
      _rewardAmount.push(v.amount)
    })

    return { _eventId, _userId, _userWallet, _rewardAmount }
  }

  try {
    let updateIndex = []

    return (!eventId || !count)
      ? _ => { throw 'Error params' }
      : await go(
        EVENT.getEventHistoryWithIndex(eventId),
        ({ data }) => data,
        filterL(a => !a.detail.share),
        mapL(history => (
          updateIndex.push(Number(history.index - 1)),
          history.detail
        )),
        take(count),
        convertArrayToContractCallData,
        async callData => {
          const { data } = await BAPP.event_sendReward(callData)
          if (data.receipt.status === false) throw 'fail'

          return EVENT.updatePaidHistory(
            {
              eventId,
              indexes: updateIndex
            }
          )
        },
        _ => go({ status: true }, success(event.headers))
      )
  } catch (e) {
    log(e.message)
    STATE.setValue(STATE.RETRY)

    return await go(
      {
        status: false,
        reason: e.message,
        message: 'Send reward fail'
      },
      failure(event.headers)
    )
  }
}

/**
 * @name tx_pushHistory
 * @description: 이벤트 참여
 * @access `{ all }`
 * @mock `{ eventId, email }`
 */
exports.tx_pushHistory = async (event, context) => {
  if (event.source === 'transaction-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )
  if (STATE.getValue() === STATE.RETRY)
    return go(
      STATE.setValue(STATE.INIT),
      failure(event.headers)
    )

  HEADER.setAuthorization(event.headers || null)

  let data = convertEvent2inputData(event)

  const fns = {
    tx: [
      EVENT.pushHistory,
      BAPP.pushHistory
    ],
    rb: [
      EVENT.removeHistory
    ]
  }

  try {
    data.amount = await go(
      EVENT.receivesAmount(
        {
          email: data.email,
          eventId: data.eventId
        }
      ),
      res => res.data
    )

    data = { tx_bapp: data, tx_event: data }

    return await go(
      UTIL.generateCall(data, fns, 'tx'),
      map(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: true,
          result: go(res, map(a => a.data))
        },
        success(event.headers)
      )
    )
  } catch (e) {
    log(e.config)

    data = { rb_bapp: data, rb_event: data }

    if (!e.response.data.status) return await go(
      UTIL.generateCall(data, fns, 'rb'),
      tap(delay(3000)),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: false,
          reason: e.message,
          result: go(res, map(a => a.data))
        },
        failure(event.headers)
      )
    )
    else return await go(
      {
        status: false,
        message: e.response.data.message
      },
      failure(event.headers)
    )
  }
}

/**
 * @name tx_createWallet
 * @description: Contract 권한 부여
 * @access `{ all }`
 * @mock
 * {
 *  account : "0x0000000000000000000000000000000",
 *  auth : "business" || "influencer" || "wt"
 * }
 */
exports.tx_createWallet = async (event, context) => {
  if (event.source === 'transaction-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.all))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )
  if (STATE.getValue() === STATE.RETRY)
    return go(
      STATE.setValue(STATE.INIT),
      failure(event.headers)
    )

  HEADER.setAuthorization(event.headers || null)

  const data = convertEvent2inputData(event)

  const fns = {
    tx: [
      USER.updateWalletAddress,
      BAPP.addAuth
    ],
    rb: [
      USER.updateWalletAddress,
      BAPP.removeAuth
    ]
  }
  try {
    return await go(
      UTIL.generateCall(data, fns, 'tx'),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: true,
          result: go(res, map(a => a.data))
        },
        success(event.headers)
      )
    )
  } catch (e) {
    log(e.config)

    return await go(
      UTIL.generateCall(data, fns, 'rb'),
      tap(delay(3000)),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: false,
          reason: e.message,
          message: 'settle data tx rolled back',
          result: go(res, map(a => a.data))
        },
        failure(event.headers)
      )
    )
  }
}



/**
 * @name: tx_updateCancelInfluencer
 * @description: 신청한 인플루언서 내보내기
 * @access `{ admin }`
 * @mock `{ tx: cancel_inf_data, rb: applied_inf_data }`
 */
exports.tx_updateCancelInfluencer = async (event, context) => {
  if (event.source === 'transaction-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.business))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )

  HEADER.setAuthorization(event.headers || null)

  const data = convertEvent2inputData(event)
  const fns = {
    tx: [
      CAMPAIGN.updateCancelInfluencer,
      BAPP.updateCancelInfluencer
    ],
    rb: [
      CAMPAIGN.updateAppliedInfluencers,
      BAPP.attendCampaign
    ]
  }

  try {
    return await go(
      UTIL.generateCall(data, fns, 'tx'),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: true,
          result: go(res, map(a => a.data))
        },
        success(event.headers)
      )
    )
  } catch (e) {
    log(e.config)
    STATE.setValue(STATE.RETRY)

    return await go(
      UTIL.generateCall(data, fns, 'rb'),
      mapC(([fn, param]) => fn(param)),
      res => go(
        {
          status: false,
          reason: e.message,
          message: 'applyCampaign tx rolled back',
          result: go(res, map(a => a.data))
        },
        failure(event.headers)
      )
    )
  }
}


/**
 * @name: tx_updateStopInfluencer
 * @description: 신청한 인플루언서 판매 종료 요청
 * @access `{ admin, business }`
 * @mock `{ tx: { influencer_stop_data }, rb: { influencer_stop_data } }`
 */
exports.tx_updateStopInfluencer = async (event, context) => {
  if (event.source === 'transaction-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.all))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )

  HEADER.setAuthorization(event.headers || null)

  const data = convertEvent2inputData(event)
  const fns = {
    tx: [
      NOTIFICATION.createNotification,
      CAMPAIGN.updateInfluencerStop
    ],
    rb: [
      NOTIFICATION.deleteNotification,
      CAMPAIGN.updateInfluencerStop
    ]
  }

  try{
    return await go(
      UTIL.generateCall(data, fns, 'tx'),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: true,
          result: go(res, map(a => a.data))
        },
        success(event.headers)
      )
    )
  } catch (e) {
    log(e.config)
    STATE.setValue(STATE.RETRY)

    return await go(
      UTIL.generateCall(data, fns, 'rb'),
      tap(delay(3000)),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: false,
          reason: e.message,
          message: 'StopInfluencer tx rolled back',
          result: go(res, map(a => a.data))
        },
        failure(event.headers)
      )
    )
  }
}


/**
 * @name: tx_updateHiddenInfluencer
 * @description: 신청한 인플루언서 숨기기
 * @access `{ admin, business }`
 * @mock `{ tx: { notification_data, hidden_influencer_data }, rb: { notification_data, hidden_influencer_data } }`
 */
exports.tx_updateHiddenInfluencer = async (event, context) => {
  if (event.source === 'transaction-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.all))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )

  HEADER.setAuthorization(event.headers || null)

  const data = convertEvent2inputData(event)
  const fns = {
    tx: [
      NOTIFICATION.createNotification,
      CAMPAIGN.updateInfluencerHidden
    ],
    rb: [
      NOTIFICATION.deleteNotification,
      CAMPAIGN.updateInfluencerHidden
    ]
  }

  try{
    return await go(
      UTIL.generateCall(data, fns, 'tx'),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: true,
          result: go(res, map(a => a.data))
        },
        success(event.headers)
      )
    )
  } catch (e) {
    log(e.config)
    STATE.setValue(STATE.RETRY)

    return await go(
      UTIL.generateCall(data, fns, 'rb'),
      tap(delay(3000)),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: false,
          reason: e.message,
          message: 'HiddenInfluencer tx rolled back',
          result: go(res, map(a => a.data))
        },
        failure(event.headers)
      )
    )
  }
}

/**
 * @name tx_deleteCampaign
 * @description: 캠페인, BApp 삭제
 * @access `{ admin, business }`
 * @mock `{ tx: delete_campaign_data, rb: rollback_data }`
 */
exports.tx_deleteCampaign = async (event, context) => {
  if (event.source === 'transaction-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.business))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )

  HEADER.setAuthorization(event.headers || null)

  const data = convertEvent2inputData(event)
  const fns = {
    tx: [
      CAMPAIGN.deleteCampaign,
      BAPP.deleteCampaign
    ],
    rb: [
      CAMPAIGN.createCampaign,
      BAPP.createCampaign
    ]
  }

  try {
    return await go(
      UTIL.generateCall(data, fns, 'tx'),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: true,
          result: go(res, map(a => a.data))
        },
        success(event.headers)
      )
    )
  } catch (e) {
    log(e.config)
    return await go(
      UTIL.generateCall(data, fns, 'rb'),
      // tap(delay(3000)),
      mapC(([fn, param]) => fn(param)),
      res => go(
        {
          status: false,
          reason: e.message,
          message: 'deleteCampaign tx rolled back',
          result: go(res, map(a => a.data))
        },
        failure(event.headers)
      )
    )
  }
}


/**
 * @name tx_cancelMainInfluencer
 * @description: 메인 인플루언서 캠페인에서 제외 및 알림
 * @access `{ admin, business }`
 * @mock `{ tx: select_main_influencer_data, rb: rollback_data }`
 */
exports.tx_cancelMainInfluencer = async (event, context) => {
  if (event.source === 'transaction-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.business))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )
  if (STATE.getValue() === STATE.RETRY)
    return go(
      STATE.setValue(STATE.INIT),
      failure(event.headers)
    )

  HEADER.setAuthorization(event.headers || null)

  const data = convertEvent2inputData(event)
  const fns = {
    tx: [
      NOTIFICATION.createNotification,
      CAMPAIGN.updateCancelMainInfluencer,
    ],
    rb: [
      NOTIFICATION.deleteNotification,
      CAMPAIGN.updateMainInfluencer
    ]
  }
  try {
    return await go(
      UTIL.generateCall(data, fns, 'tx'),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: true,
          result: go(res, map(a => a.data))
        },
        success(event.headers)
      )
    )
  } catch (e) {
    log(e.config)
    STATE.setValue(STATE.RETRY)

    return await go(
      UTIL.generateCall(data, fns, 'rb'),
      tap(delay(3000)),
      mapC(([fn, param]) => fn(param)),
      res => go(
        {
          status: false,
          reason: e.message,
          message: 'canceled Main Influencer tx rolled back',
          result: go(res, map(a => a.data))
        },
        failure(event.headers)
      )
    )
  }
}

exports.tx_updatePostingUrl = async (event, context) => {
  if (event.source === 'transaction-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.influencer))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )

  HEADER.setAuthorization(event.headers || null)

  const data = convertEvent2inputData(event)
  const fns = {
    tx: [
      CAMPAIGN.updatePostingUrl,
      POSTING.createPosting,
    ],
    rb: [
      CAMPAIGN.updatePostingUrl,
      POSTING.deletePosting
    ]
  }

  try {
    return await go(
      UTIL.generateCall(data, fns, 'tx'),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: true,
          result: go(res, map(a => a.data))
        },
        success(event.headers)
      )
    )
  } catch (e) {
    log(e.config)

    return await go(
      UTIL.generateCall(data, fns, 'rb'),
      tap(delay(3000)),
      mapC(([fn, param]) => fn(param)),
      res => go(
        {
          status: false,
          reason: e.message,
          message: 'update posting url tx rolled back',
          result: go(res, map(a => a.data))
        },
        failure(event.headers)
      )
    )
  }
}

/**
 * @name tx_cancelMainInfluencer
 * @description: 메인 인플루언서 캠페인에서 제외 및 알림
 * @access `{ admin, business }`
 * @mock `{ tx: select_main_influencer_data, rb: rollback_data }`
 */
exports.tx_updateIsConfirm = async (event, context) => {
  if (event.source === 'transaction-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.business))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )
  if (STATE.getValue() === STATE.RETRY)
    return go(
      STATE.setValue(STATE.INIT),
      failure(event.headers)
    )

  HEADER.setAuthorization(event.headers || null)

  const data = convertEvent2inputData(event)
  const fns = {
    tx: [
      NOTIFICATION.createNotification,
      CAMPAIGN.updateIsConfirm,
    ],
    rb: [
      NOTIFICATION.deleteNotification,
      CAMPAIGN.updateIsConfirm
    ]
  }
  try {
    return await go(
      UTIL.generateCall(data, fns, 'tx'),
      mapC(([ fn, param ]) => fn(param)),
      res => go(
        {
          status: true,
          result: go(res, map(a => a.data))
        },
        success(event.headers)
      )
    )
  } catch (e) {
    log(e.config)
    STATE.setValue(STATE.RETRY)

    return await go(
      UTIL.generateCall(data, fns, 'rb'),
      tap(delay(3000)),
      mapC(([fn, param]) => fn(param)),
      res => go(
        {
          status: false,
          reason: e.message,
          message: 'update is confirm tx rolled back',
          result: go(res, map(a => a.data))
        },
        failure(event.headers)
      )
    )
  }
}
