Object.assign(global, require('ffp-js'))

const moment = require('moment')
require('moment-timezone')
moment.tz.setDefault('Asia/Seoul')

const { success, failure } = require('/opt/libs/response-lib')
const { convertEvent2inputData } = require('/opt/libs/api-util-lib')
const { AUTH } = require('/opt/libs/authorizer-lib')

const GenericCaver = require('../utils/klaytn/generic-caver')
const { METADATA } = require('../utils/klaytn/metadata')
const { CONTRACT, ACCOUNTS, KLAY, UTILS } = GenericCaver(process.env.KLAYTN_HOST)

/**
 * @param { QueryString } campaignId
 * @contract_call : Campaign
 */
exports.klaytn_getCampaign = async (event, context) => {
  if (event.source === 'bApp-warmer') return
  try {
    const data = convertEvent2inputData(event)
    const ks = [
      'campaign_type',
      'product_id', 
      'revenue_ratio', 
      'total_supply', 
      'applied_influencers', 
      'start_at', 
      'end_at', 
      'created_at'
    ]

    return (!data) 
    ? go({ status: false, message: 'Error params' }, failure(event.headers))
    : go(
        data,
        params => CONTRACT.read(METADATA.Campaign, 'getCampaign(uint256)', params),
        vs => merge(ks, vs),
        object,
        success(event.headers)
      )
  } catch (e) {
    return go({ status: false, message: e.message }, failure(event.headers))
  }
}

/**
 * @param { QueryString } revenueLedgerId
 * @contract_call : RevenueLedger
 */
exports.klaytn_getRevenueLedger = async (event, context) => {
  if (event.source === 'bApp-warmer') return
  try {
    const data = convertEvent2inputData(event)
    const ks = [
      'campaign_id',
      'influencer_id',
      'sales_amount',
      'sales_price',
      'profit',
      'revenue_ratio',
      'spin_ratio',
      'fiat_ratio',
      'is_account'
    ]

    return (!data) 
    ? go({ status: false, message: 'Error params' }, failure(event.headers))
    : go(
        data,
        params => CONTRACT.read(METADATA.RevenueLedger, 'getRevenueLedger(uint256)', params),
        vs => merge(ks, vs),
        object,
        success(event.headers)
      )
  } catch (e) {
    return go({ status: false, message: e.message }, failure(event.headers))
  }
}

/**
 * @param { Object }
 * @contract_call : Product
 * @mock
 * {
 *  category : "womanstalk",
 *  productId : 1
 * }
 */
exports.klaytn_getProductData = async (event, context) => {
  if (event.source === 'bApp-warmer') return
  try {
    const data = convertEvent2inputData(event)
    const ks = [
      'viewCount',
      'purchaseCount'
    ]

    return (!data) 
    ? go({ status: false, message: 'Error params' }, failure(event.headers))
    : go(
        data,
        params => CONTRACT.read(METADATA.Product, 'getProductData(string,uint256)', params),
        vs => merge(ks, vs),
        object,
        success(event.headers)
      )
  } catch (e) {
    return go({ status: false, message: e.message }, failure(event.headers))
  }
}

 /**
 * @param { Object }
 * @contract_call : Product
 * @mock
 * {
 *  category : "womanstalk" || null,
 *  productId : 1 || null,
 *  memberNo : 1 || null
 *  dateFilter : "month" || "day" || "hour" || null
 * }
 */
exports.klaytn_getProductPurchase_History = async (event, context) => {
  if (event.source === 'bApp-warmer') return
  try {
    const { category, productId, memberNo, dateFilter } = convertEvent2inputData(event)

    const categoryList = ['womanstalk', 'default']
    const categoryKeys = map(a => ({ name : a, hash : UTILS.toSha3(a) }), categoryList)

    const categoryToStr = hash => go(
      categoryKeys,
      filter(a => a.hash === hash),
      first,
      categoryKey => (!categoryKey) ? hash : categoryKey.name
    )

    const filterDate = (historyList, filterFormat) => {
      let result = {}

      return go(
        historyList,
        map(obj => {
          const date = moment( Number(obj.updatedAt) * 1000 ).format(filterFormat)
          if(result[date] === undefined) result[date] = []
          result[date].push(obj)
        }),
        _ => result
      )
    }

    return go(
          METADATA.Product.getPastEvents('PurchaseAdd',
            {
              filter : { category, productId, memberNo },
              fromBlock : 8975575,
              toBlock : 'latest'
            }),
          map(({ returnValues }) => go(
            returnValues,
              pick(['category', 'productId', 'memberNo', 'count', 'updatedAt']),
              obj => {
                obj.category = categoryToStr(obj.category)
                obj.date = moment( Number(obj.updatedAt) * 1000 ).format('YYYY-MM-DD HH:mm:ss')
                return obj
              }
          )),
          historyList => match(dateFilter)
            .case(dateFilter => dateFilter === 'month')(_ => filterDate(historyList,'YYYY-MM'))
            .case(dateFilter => dateFilter === 'day')(_ => filterDate(historyList,'YYYY-MM-DD'))
            .case(dateFilter => dateFilter === 'hour')(_ => filterDate(historyList,'YYYY-MM-DD_HH'))
            .else(_ => historyList),
          success(event.headers)
      )
  } catch (e) {
    return go({ status: false, message: e.message }, failure(event.headers))
  }
}

/**
 * @param { Object }
 * @contract_call : Product
 * @mock
 * {
 *  category : "womanstalk" || null,
 *  productId : 1 || null,
 *  momberNo : 1 || null
 *  dateFilter : "month" || "day" || "hour" || null
 * }
 */
exports.klaytn_getProductView_History = async (event, context) => {
  if (event.source === 'bApp-warmer') return
  try {
    const { category, productId, memberNo, dateFilter } = convertEvent2inputData(event)

    const categoryList = ['womanstalk', 'default']
    const categoryKeys = map(a => ({ name : a, hash : UTILS.toSha3(a) }), categoryList)

    const categoryToStr = hash => go(
      categoryKeys,
      filter(a => a.hash === hash),
      first,
      categoryKey => (!categoryKey) ? hash : categoryKey.name
    )

    const filterDate = (historyList, filterFormat) => {
      let result = {}

      return go(
        historyList,
        map(obj => {
          const date = moment( Number(obj.updatedAt) * 1000 ).format(filterFormat)
          if(result[date] === undefined) result[date] = []
          result[date].push(obj)
        }),
        _ => result
      )
    }

    return go(
          METADATA.Product.getPastEvents('ViewProduct',
            {
              filter : { category, productId, memberNo },
              fromBlock : 8975575,
              toBlock : 'latest'
            }),
          map(({ returnValues }) => go(
              returnValues,
              pick(['category', 'productId', 'memberNo', 'updatedAt']),
              obj => {
                obj.category = categoryToStr(obj.category)
                obj.date = moment( Number(obj.updatedAt) * 1000 ).format('YYYY-MM-DD HH:mm:ss')
                return obj
              }
          )),
          historyList => match(dateFilter)
            .case(dateFilter => dateFilter === 'month')(_ => filterDate(historyList,'YYYY-MM'))
            .case(dateFilter => dateFilter === 'day')(_ => filterDate(historyList,'YYYY-MM-DD'))
            .case(dateFilter => dateFilter === 'hour')(_ => filterDate(historyList,'YYYY-MM-DD_HH'))
            .else(_ => historyList),
          success(event.headers)
      )
  } catch (e) {
    return go({ status: false, message: e.message }, failure(event.headers))
  }
}


/**
 * @param { QueryString } referralLedgerId
 * @contract_call : ReferralLedger
 */
exports.klaytn_getReferralLedger = async (event, context) => {
  if (event.source === 'bApp-warmer') return
  try {
    const data = convertEvent2inputData(event)
    const ks = [
      'revenueLedgerId',
      'amount',
      'fromReferralUser',
      'toReferralUser',
      'isAccount'
    ]

    return (!data) 
    ? go({ status: false, message: 'Error params' }, failure(event.headers))
    : go(
        data,
        params => CONTRACT.read(METADATA.ReferralLedger, 'getReferralLedger(uint256)', params),
        vs => merge(ks, vs),
        object,
        success(event.headers)
      )
  } catch (e) {
    return go({ status: false, message: e.message }, failure(event.headers))
  }
}
