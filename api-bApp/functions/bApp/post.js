Object.assign(global, require('ffp-js'))

const { success, failure } = require('/opt/libs/response-lib')
const { convertEvent2inputData } = require('/opt/libs/api-util-lib')
const { AUTH } = require('/opt/libs/authorizer-lib')

const GenericCaver = require('../utils/klaytn/generic-caver')
const { METADATA } = require('../utils/klaytn/metadata')
const { CONTRACT, ACCOUNTS, KLAY, UTILS } = GenericCaver(process.env.KLAYTN_HOST)

const adminSigner = ACCOUNTS.connect(process.env.KLAYTN_ADMIN_PRIVATE_KEY)
const feePayer = ACCOUNTS.connect(process.env.KLAYTN_FEE_PAYER_PRIVATE_KEY, process.env.KLAYTN_FEE_PAYER_ADDRESS)

/**
 * @param { Object }
 * @access `{ admin, business }`
 * @contract_access : Admin, Business 
 * @contract_call : Campaign
 * @mock 
 *  {
 *    campaignId: 1,
 *    campaignType: 1,     // 0 : group , 1 : regular
 *    productId: 2018050505,
 *    revenueRatio: 10,
 *    totalSupply: 1000,
 *    startAt: timestamp,
 *    endAt: timestamp
 *  }
 */
exports.klaytn_createCampaign = async (event, context) => {
  if (event.source === 'bApp-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.business)) return go({ status: false, message: 'Unauthroized' }, failure(event.headers))

  const data = convertEvent2inputData(event)
  
  try {
    return (!data) 
      ? go({ status: false, message: 'Error params' }, failure(event.headers))
      : await go(
        CONTRACT.writeFeeDelegate(
          adminSigner,
          feePayer,
          METADATA.Campaign,
          'createCampaign(uint256,uint256,uint256,uint256,uint256,uint256,uint256)', 
          data
        ),
        tx => go(
          { 
            status: true, 
            message: '1 rows were recorded on blockchain', 
            receipt: tx
          }, 
          success(event.headers)
        )
      )
  } catch (e) {
    return go({ status: false, message: e.message }, failure(event.headers))
  }
}

/**
 * @param { Object }
 * @access `{ admin, business }`
 * @contract_access : Admin, Business 
 * @contract_call : Campaign
 * @mock 
 *  { 
 *    campaignId: 1
 *  }
 */
exports.klaytn_deleteCampaign = async (event, context) => {
  if (event.source === 'bApp-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.business, AUTH.USER_ROLE.admin)) return go({ status: false, message: 'Unauthroized' }, failure(event.headers))

  const data = convertEvent2inputData(event)

  try {    
    return (!data) 
      ? go({ status: false, message: 'Error params' }, failure(event.headers))
      : await go(
        CONTRACT.writeFeeDelegate(
          adminSigner, 
          feePayer, 
          METADATA.Campaign, 
          'deleteCampaign(uint256)', 
          data
        ),
        tx => go(
          { 
            status: true, 
            message: '1 rows were recorded on blockchain', 
            receipt: tx
          }, 
          success(event.headers)
        )
      )
  } catch (e) {
    return go({ status: false, message: e.message }, failure(event.headers))
  }
}

/**
 * @param { Object }
 * @access `{ admin, business }`
 * @contract_access : Admin, Business 
 * @contract_call : Campaign
 * @mock 
 *  { 
 *    campaignId: 1,
 *    productId: 2018050505,
 *    revenueRatio: 10,
 *    totalSupply: 1000,
 *    startAt: timestamp,
 *    endAt: timestamp
 *  }
 */
exports.klaytn_updateCampaign = async (event, context) => {
  if (event.source === 'bApp-warmer') return 
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.business, AUTH.USER_ROLE.admin)) return go({ status: false, message: 'Unauthroized' }, failure(event.headers))

  const data = convertEvent2inputData(event)

  try {
    return (!data) 
      ? go({ status: false, message: 'Error params' }, failure(event.headers))
      : await go(
        CONTRACT.writeFeeDelegate(
          adminSigner,
          feePayer,
          METADATA.Campaign, 
          'updateCampaign(uint256,uint256,uint256,uint256,uint256,uint256)', 
          data
        ),
        tx => go(
          { 
            status: true, 
            message: '1 rows were recorded on blockchain', 
            receipt: tx
          }, 
          success(event.headers)
        )
      )
  } catch (e) {
    return go({ status: false, message: e.message }, failure(event.headers))
  }
}

/**
 * @param { Object }
 * @access `{ admin, business }`
 * @contract_access : Admin, Business 
 * @contract_call : Campaign
 * @mock 
 *  { 
 *    campaignId: 1,
 *    endAt: timestamp
 *  }
 */
exports.klaytn_updateSaleEnd = async (event, context) => {
  if (event.source === 'bApp-warmer') return 
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.business)) return go({ status: false, message: 'Unauthroized' }, failure(event.headers))

  const data = convertEvent2inputData(event)
  
  try {
    return (!data) 
      ? go({ status: false, message: 'Error params' }, failure(event.headers))
      : await go(
        CONTRACT.writeFeeDelegate(
          adminSigner,
          feePayer,
          METADATA.Campaign, 
          'updateSaleEnd(uint256,uint256)', 
          data
        ),
        tx => go(
          { 
            status: true, 
            message: '1 rows were recorded on blockchain', 
            receipt: tx
          }, 
          success(event.headers)
        )
      )
  } catch (e) {
    return go({ status: false, message: e.message }, failure(event.headers))
  }
}


/**
 * @param { Object }
 * @todo: need admin
 * @contract_access : Admin, Influencer 
 * @contract_call : Campaign
 * @mock 
 *  { 
 *    campaignId: 1,
 *    influencerId: 1
 *  }
 */
exports.klaytn_cancelCampaign = async (event, context) => {
  if (event.source === 'bApp-warmer') return 
  const data = convertEvent2inputData(event)
  
  try {
    return (!data) 
      ? go({ status: false, message: 'Error params' }, failure(event.headers))
      : await go(
        CONTRACT.writeFeeDelegate(
          adminSigner,
          feePayer,
          METADATA.Campaign, 
          'cancelCampaign(uint256,uint256)', 
          data
        ),
        tx => go(
          { 
            status: true, 
            message: '1 rows were recorded on blockchain', 
            receipt: tx
          }, 
          success(event.headers)
        )
      )
  } catch (e) {
    return go({ status: false, message: e.message }, failure(event.headers))
  }
}


/**
 * @param { Object }
 * @access `{ admin }`
 * @contract_access : Admin
 * @contract_call : RevenueLedger
 * @mock
 * { 
 *    revenueLedgerId: 1,
 *    campaignId: 1,
 *    influencerId: 1,
 *    salesAmount: 5,
 *    salesPrice: 5000,
 *    profit: 500,
 *    revenueRatio: 10,
 *    spinRatio: 70,
 *    fiatRatio: 30
 * }
 */
exports.klaytn_createRevenueLedger = async (event, context) => {
  if (event.source === 'bApp-warmer') return 
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.master)) return go({ status: false, message: 'Unauthroized' }, failure(event.headers))

  const data = convertEvent2inputData(event)

  try {
    return (!data)
      ? go({ status: false, message: 'Error params' }, failure(event.headers))
      : await go(
        CONTRACT.writeFeeDelegate(
          adminSigner, 
          feePayer, 
          METADATA.RevenueLedger, 
          'createRevenueLedger(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)',
          data
        ),
        tx => go(
          { 
            status: true, 
            message: '1 rows were recorded on blockchain', 
            receipt: tx
          }, 
          success(event.headers)
        )
      )
  } catch (e) {
    return go({ status: false, message: e.message }, failure(event.headers))
  }
}

/**
 * @param { Object }
 * @access `{ admin }`
 * @contract_access : Admin
 * @contract_call : RevenueLedger
 * @mock 
 *  { 
 *    revenueLedgerId: 1
 *  }
 */
exports.klaytn_deleteRevenueLedger = async (event, context) => {
  if (event.source === 'bApp-warmer') return 'Lambda is warm!'
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.master)) return go({ status: false, message: 'Unauthroized' }, failure(event.headers))

  const data = convertEvent2inputData(event)
  
  try {
    return (!data) 
      ? go({ status: false, message: 'Error params' }, failure(event.headers))
      : await go(
        CONTRACT.writeFeeDelegate(
          adminSigner,
          feePayer,
          METADATA.RevenueLedger, 
          'deleteRevenueLedger(uint256)', 
          data
        ),
        tx => go(
          { 
            status: true, 
            message: '1 rows were recorded on blockchain', 
            receipt: tx
          }, 
          success(event.headers)
        )
      )
  } catch (e) {
    return go({ status: false, message: e.message }, failure(event.headers))
  }
}

/**
 * @param { Object }
 * @access `{ admin }`
 * @contract_access : Admin
 * @contract_call : RevenueLedger
 * @mock
 * { 
 *  _revenueLedgerId : 1,
 *  _to : "0x1ea4c58b01c9934d6d9e7d736f072f6f3e3c44a5",
 *  _spinAmount : 10000,
 *  _marketPrice : 1550, (price(15.5) * 100)
 *  _rounding : 2
 * }
 */
exports.klaytn_revenueShare = async (event, context) => {
  if (event.source === 'bApp-warmer') return 
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.master)) return go({ status: false, message: 'Unauthroized' }, failure(event.headers))

  const data = convertEvent2inputData(event)

  try {  
    return (!data) 
      ? go({ status: false, message: 'Error params' }, failure(event.headers))
      : await go(
        CONTRACT.writeFeeDelegate(
          adminSigner,
          feePayer,
          METADATA.RevenueLedger, 
          'revenueShare(uint256,address,uint256,uint256,uint256)', 
          data
        ),
        tx => go(
          { 
            status: true, 
            message: '1 rows were recorded on blockchain', 
            receipt: tx
          }, 
          success(event.headers)
        )
      )
  } catch (e) {
    return go({ status: false, message: e.message }, failure(event.headers))
  }
}


/**
 * @param { Object }
 * @access `{ all }`
 * @contract_access : User
 * @contract_call : Event
 * @mock
 * {
 *  eventId : 1,
 *  email : "abc@naver.com",
 *  amount : 200
 * }
 */
exports.klaytn_pushHistory = async (event, context) => {
  if (event.source === 'bApp-warmer') return 
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.all)) return go({ status: false, message: 'Unauthroized' }, failure(event.headers))

  const data = convertEvent2inputData(event)

  try {
    return (!data) 
      ? go({ status: false, message: 'Error params' }, failure(event.headers))
      : await go(
        CONTRACT.writeFeeDelegate(
          adminSigner,
          feePayer,
          METADATA.Event, 
          'pushHistory(uint256,string,uint256)', 
          data
        ),
        tx => go(
          { 
            status: true, 
            message: '1 rows were recorded on blockchain', 
            receipt: tx
          }, 
          success(event.headers)
        )
      )
  } catch (e) {
    return go({ status: false, message: e.message }, failure(event.headers))
  }
}

/**
 * @param { Object }
 * @access `{ admin }`
 * @contract_access : Admin
 * @contract_call : Event
 * @mock Array value index must match
 * {
 *  _eventId : 1,
 *  _userId : ["abc@naver.com","abc@naver.com"],
 *  _userWallet : ["0x000000000000000000000000","0x000000000000000000000000"], 
 *  _rewardAmount : [200000000000,1000000000000]
 * }
 */
exports.klaytn_sendReward = async (event, context) => {
  if (event.source === 'bApp-warmer') return 
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.master)) return go({ status: false, message: 'Unauthroized' }, failure(event.headers))

  const data = convertEvent2inputData(event)

  try {
    return (!data) 
      ? go({ status: false, message: 'Error params' }, failure(event.headers))
      : await go(
        CONTRACT.writeFeeDelegate(
          adminSigner,
          feePayer,
          METADATA.Event, 
          'sendReward(uint256,string[],address[],uint256[])', 
          data
        ),
        tx => go(
          { 
            status: true, 
            message: '1 rows were recorded on blockchain', 
            receipt: tx
          }, 
          success(event.headers)
        )
      )
  } catch (e) {
    return go({ status: false, message: e.message }, failure(event.headers))
  }
}


/**
 * @param { Object }
 * @access `{ all }`
 * @contract_access : Admin
 * @contract_call : All Contract
 * @mock
 * { 
 *  account : "0x0000000000000000000000000000000",
 *  auth : "business" || "influencer" || "wt"
 * }
 */
exports.klaytn_addAuth = async (event, context) => {
  if (event.source === 'bApp-warmer') return 
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.all)) return go({ status: false, message: 'Unauthroized' }, failure(event.headers))

  let { account, auth } = convertEvent2inputData(event)

  try {
    return (!account || !auth) 
      ? go({ status: false, message: 'Error params' }, failure(event.headers))
      : (auth === 'admin')
        ? go({ status: false, message: 'Impossible authority' }, failure(event.headers))
        : await go(
          CONTRACT.writeFeeDelegate(
            adminSigner,
            feePayer,
            METADATA.AuthStorage, 
            'addAuth(string,address)', 
            { auth, account }
          ),
          txs => go(
            { 
              status: true, 
              message: `${account} set ${auth} auth on blockchain`, 
              transactionHash: txs.transactionHash
            }, 
            success(event.headers)
          )
        )
  } catch (e) {
    return go({ status: false, message: e.message }, failure(event.headers))
  }
}


/**
 * @param { Object }
 * @access `{ admin }`
 * @contract_access : Admin
 * @contract_call : All Contract
 * @mock
 * { 
 *  account : "0x0000000000000000000000000000000",
 *  auth : "influencer"
 * }
 */
exports.klaytn_removeAuth = async (event, context) => {
  if (event.source === 'bApp-warmer') return 
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.all)) return go({ status: false, message: 'Unauthroized' }, failure(event.headers))

  const { account, auth } = convertEvent2inputData(event)

  try {
    return (!account || !auth) 
      ? go({ status: false, message: 'Error params' }, failure(event.headers))
      : (auth === 'admin') 
        ? go({ status: false, message: 'Impossible authority' }, failure(event.headers))
        : await go(
          CONTRACT.writeFeeDelegate(
            adminSigner,
            feePayer,
            METADATA.AuthStorage, 
            'removeAuth(string,address)', 
            { auth, account }
          ),
          txs => go(
            { 
              status: true, 
              message: `${account} set ${auth} auth on blockchain`, 
              transactionHash: txs.transactionHash
            }, 
            success(event.headers)
          )
        )
  } catch (e) {
    return go({ status: false, message: e.message }, failure(event.headers))
  }
}

/**
* @param { Object }
* @access `{ all }`
* @mock
*  {
*    rawTransaction: 0x...,
*    inputTypes: ['address',...] (option)
*  }
*/
exports.klaytn_sendRawTxFeeDelegated = async (event, context) => {
  if (event.source === 'bApp-warmer') return 
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.all)) return go({ status: false, message: 'Unauthroized' }, failure(event.headers))

  const data = convertEvent2inputData(event)
  try {
    return (!data)
      ? go({ status: false, message: 'Error params' }, failure(event.headers))
      : await go(
        KLAY.SEND.tx(null, data.rawTransaction, feePayer),
        tx => go(
          {
            status: true,
            message: 'Transaction sending was successful.',
            receipt: tx,
            inputData : (!data.inputTypes) ? null : CONTRACT.decodeParameters(data.inputTypes,`0x${tx.input.substring(10)}`)
          },
          success(event.headers)
        )
      )
  } catch (e) {
    return go({ status: false, message: e.message }, failure(event.headers))
  }
}


/**
 * @param { Object }
 * @access `{ admin }`
 * @contract_access : Admin
 * @contract_call : ReferralLedger
 * @mock
 * { 
 *    referralLedgerId: 1,
 *    revenueLedgerId: 1,
 *    amount: 70,
 *    fromReferralUser: 'child'
 *    toReferralUser: 'parent'
 * }
 *
 */
exports.klaytn_createReferralLedger = async (event, context) => {
  if (event.source === 'bApp-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.master)) return go({ status: false, message: 'Unauthroized' }, failure(event.headers))

  const data = convertEvent2inputData(event)

  try {
    data.amount = UTILS.toKLAY(String(data.amount))

    return (!data)
      ? go({ status: false, message: 'Error params' }, failure(event.headers))
      : await go(
        CONTRACT.writeFeeDelegate(
          adminSigner, 
          feePayer, 
          METADATA.ReferralLedger, 
          'createReferralLedger(uint256,uint256,uint256,string,string)',
          data
        ),
        tx => go(
          { 
            status: true, 
            message: '1 rows were recorded on blockchain', 
            receipt: tx
          }, 
          success(event.headers)
        )
      )
  } catch (e) {
    return go({ status: false, message: e.message }, failure(event.headers))
  }
}

/**
 * @param { Object }
 * @access `{ admin }`
 * @contract_access : Admin
 * @contract_call : ReferralLedger
 * @mock 
 *  { 
 *    referralLedgerId: 1
 *  }
 */
exports.klaytn_deleteReferralLedger = async (event, context) => {
  if (event.source === 'bApp-warmer') return 'Lambda is warm!'
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.master)) return go({ status: false, message: 'Unauthroized' }, failure)

  const data = convertEvent2inputData(event)
  
  try {
    return (!data) 
      ? go({ status: false, message: 'Error params' }, failure(event.headers))
      : await go(
        CONTRACT.writeFeeDelegate(
          adminSigner,
          feePayer,
          METADATA.ReferralLedger, 
          'deleteReferralLedger(uint256)', 
          data
        ),
        tx => go(
          { 
            status: true, 
            message: '1 rows were recorded on blockchain', 
            receipt: tx
          }, 
          success(event.headers)
        )
      )
  } catch (e) {
    return go({ status: false, message: e.message }, failure(event.headers))
  }
}


/**
 * @param { Object }
 * @access `{ admin }`
 * @contract_access : Admin
 * @contract_call : ReferralLedger
 * @mock
 * { 
 *  referralLedgerId : 1,
 *  toAddr : "0x1ea4c58b01c9934d6d9e7d736f072f6f3e3c44a5",
 * }
 */
exports.klaytn_referralShare = async (event, context) => {
  if (event.source === 'bApp-warmer') return 
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.master)) return go({ status: false, message: 'Unauthroized' }, failure)

  const data = convertEvent2inputData(event)

  try {  
    return (!data) 
      ? go({ status: false, message: 'Error params' }, failure(event.headers))
      : await go(
        CONTRACT.writeFeeDelegate(
          adminSigner,
          feePayer,
          METADATA.ReferralLedger, 
          'referralShare(uint256,address)', 
          data
        ),
        tx => go(
          { 
            status: true, 
            message: '1 rows were recorded on blockchain', 
            receipt: tx
          }, 
          success(event.headers)
        )
      )
  } catch (e) {
    return go({ status: false, message: e.message }, failure(event.headers))
  }
}

/**
 * @param { Object }
 * @access `{ admin }`
 * @contract_access : Admin
 * @contract_call : param pick
 * @mock
 * { 
 *    contract: 'Event',   * Event || RevenueLedger || RefferalLedger
 *    _tokenName: 'SPIN',
 *    _to: '0x00000000000000000000000000000000000',
 *    _amt: 70,
 * }
 */
exports.klaytn_sendTokenInSPINContract = async (event, context) => {
  if (event.source === 'bApp-warmer') return 
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.master)) return go({ status: false, message: 'Unauthroized' }, failure(event.headers))

  const { contract, _tokenName, _to, _amt } = convertEvent2inputData(event)

  try {
    return (!contract)
      ? go({ status: false, message: 'Error params' }, failure(event.headers))
      : await go(
        CONTRACT.writeFeeDelegate(
          adminSigner, 
          feePayer, 
          METADATA[contract], 
          'sendToken(string,address,uint256)',
          {
            _tokenName,
            _to,
            _amt: UTILS.toKLAY(_amt)
          }
        ),
        tx => go(
          { 
            status: true, 
            message: '1 rows were recorded on blockchain', 
            receipt: tx
          }, 
          success(event.headers)
        )
      )
  } catch (e) {
    return go(
      { 
        status: false, 
        message: e.message 
      }, 
        failure(event.headers)
      )
  }
}