Object.assign(global, require('ffp-js'))

const { POOL } = require('/opt/libs/postgresql-lib')
const { QUERY, SQL } = POOL
const { success, failure } = require('/opt/libs/response-lib')
const { convertEvent2inputData } = require('/opt/libs/api-util-lib')
const { AUTH } = require('/opt/libs/authorizer-lib')
const { APPOINT } =require('./function')
const moment = require('moment')

const searchState = (state, email = null) => {
  switch (state) {
    case 'waiting':
      return email
        ? SQL`AND (
          (campaign_info ->> 'announcement_date')::TIMESTAMPTZ >= NOW()
          OR (
            (campaign_info ->> 'announcement_date')::TIMESTAMPTZ < NOW()
            AND (campaign_info ->> 'sale_start_date')::TIMESTAMPTZ > NOW() 
            AND applied_influencers @> jsonb_build_array(jsonb_build_object('email', ${email}::TEXT, 'is_selection', true))
          )
        )`
        : SQL`AND (campaign_info ->> 'sale_start_date')::TIMESTAMPTZ > NOW()`;
    case 'progress':
      return SQL`
        AND (campaign_info ->> 'sale_start_date')::TIMESTAMPTZ <= NOW() 
        AND NOW() < (campaign_info ->> 'sale_end_date')::TIMESTAMPTZ
        AND ${email ? SQL`applied_influencers @> jsonb_build_array(jsonb_build_object('email', ${email}::TEXT, 'is_selection', true))` : true}
      `
    case 'complete':
      return email
        ? SQL`AND(
          NOW() > (campaign_info ->> 'sale_end_date')::TIMESTAMPTZ
          OR (
            NOW() > (campaign_info ->> 'announcement_date')::TIMESTAMPTZ 
            AND applied_influencers @> jsonb_build_array(jsonb_build_object('email', ${email}::TEXT, 'is_selection', false))
          )
        )`
        : SQL`AND NOW() >= (campaign_info ->> 'sale_end_date')::TIMESTAMPTZ`
    default:
      return SQL`AND true`
  }
};

/**
 * @name getCampaign
 * @description: 캠페인 `id`로 캠페인 상세정보 조회
 * @access `{ all }`
 * @mock `{ id }`
 */
exports.getCampaign = async (event, context) => {
  if (event.source === 'campaign-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.all))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )

  try {
    const { id } = convertEvent2inputData(event)
    const defaultSelectOption = SQL`
      id,
      type,
      sub_type,
      name,
      main_img,
      notice,
      created_at,
      updated_at,
      registrant_email,
      image_list,
      on_chain
    `
    const limitSelectOption = (event.requestContext.authorizer.auth === 'womanstalk')
      ? SQL`
        ${defaultSelectOption},
        applied_influencers,
        campaign_info ->> 'gender' AS gender,
        campaign_info ->> 'product_code' AS product_code,
        campaign_info ->> 'revenue_ratio' AS revenue_ratio,
        campaign_info ->> 'limit_count' AS limit_count,
        campaign_info ->> 'campaign_description' AS campaign_description,
        campaign_info ->> 'mission_description' AS mission_description,
        campaign_info ->> 'offer' AS offer,
        campaign_info ->> 'hash_tag' AS hash_tag,
        campaign_info ->> 'guide' AS guide,
        campaign_info ->> 'apply_start_date' AS apply_start_date,
        campaign_info ->> 'apply_end_date' AS apply_end_date,
        campaign_info ->> 'shipping_date' AS shipping_date,
        campaign_info ->> 'sale_start_date' AS sale_start_date,
        campaign_info ->> 'sale_end_date' AS sale_end_date,
        campaign_info ->> 'product_price' AS product_price,
        campaign_info ->> 'total_supply' AS total_supply,
        campaign_info ->> 'main_influencers' AS main_influencers
      `
      : SQL`
        ${defaultSelectOption},
        campaign_info,
        is_confirm,
        COALESCE(
          TO_JSONB((
            SELECT
              json_agg(
                inf || 
                jsonb_build_object(
                  'posting_url', COALESCE(
                    (
                      SELECT
                        posting_url
                      FROM
                        posting
                      WHERE
                        campaign_id = campaign.id AND influencer_id = (inf->>'id')::INT
                    ),
                    '[]'
                  ),
                  'user_info', (
                    SELECT user_info FROM users WHERE id = (inf->>'id')::INT
                  )
                )
              )
            FROM
              campaign,
              jsonb_array_elements(applied_influencers) AS inf
            WHERE
              campaign.id = ${id}
          )), 
          applied_influencers
        ) AS applied_influencers
      `
    const limitSearchOption = (event.requestContext.authorizer.auth === 'womanstalk' || event.requestContext.authorizer.auth === 'influencer')
      ? SQL`AND is_confirm = true`
      : SQL``
    return (!id)
      ? go(
        {
          status: false,
          message: 'Error params'
        },
        failure(event.headers)
      )
      : go(
        QUERY`SELECT ${limitSelectOption} FROM campaign WHERE id=${id} ${limitSearchOption}`,
        success(event.headers)
      )
  } catch (e) {
    log(e)
    return go(
      {
        status: false,
        message: e.message
      },
      failure(event.headers)
    )
  }
};

/**
 * @name getCampaignForMarketing
 * @description: 캠페인 `id`로 캠페인 상세정보 조회
 * @access `{ all }`
 * @mock `{ id }`
 */
exports.getCampaignForMarketing = async (event, context) => {
  if (event.source === 'campaign-warmer') return
  try {
    const { id } = convertEvent2inputData(event)
    return !id
      ? go(
        {
          status: false,
          message: 'Error params'
        },
        failure(event.headers)
      )
      : go(
        QUERY`SELECT * FROM campaign WHERE id=${id}`,
        success(event.headers)
      );
  } catch (e) {
    return go(
      {
        status: false,
        message: e.message
      },
      failure(event.headers)
    )
  }
};

/**
 * @name getCampaignListByUser
 * @description: 신청을 위한 캠페인 리스트 목록을 가져옴
 * @access `{ all }`
 * @mock `{ email, page, count }`
 */
exports.getCampaignListByUser = async (event, context) => {
  if (event.source === 'campaign-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.all))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )

  try {
    const data = convertEvent2inputData(event)
    const userExpression = `[{"email": "${event.requestContext.authorizer.email}"}]`
    let start = (data.page - 1) * data.count
    if (start < 0) start = 0;
    const campaignByType =
      data.type === 'regular'
        ? SQL`AND (campaign_info ->> 'sale_end_date')::TIMESTAMPTZ >= NOW()`
        : SQL`AND TRUE`;

    return (!data)
      ? go(
        {
          status: false,
          message: 'Error params'
        },
        failure(event.headers)
      )
      : go(
          QUERY`
          SELECT
            *
          FROM
            campaign
          WHERE
            (campaign_info ->> 'apply_start_date')::TIMESTAMPTZ <= NOW()
            AND (campaign_info ->> 'apply_end_date')::TIMESTAMPTZ >= NOW()
            AND NOT(applied_influencers @> ${userExpression})
            AND type = ${data.type}
            AND is_confirm = true
            ${campaignByType}
          ORDER BY
            id DESC LIMIT ${data.count} OFFSET ${start}`,
          campaignList => APPOINT.getCampaignByUser(campaignList, data.user_id, event.requestContext.authorizer.email),
          async campaignList => {
            const count = await go(
              QUERY`
                SELECT 
                  COUNT(*) totalCount 
                FROM 
                  campaign 
                WHERE 
                  (campaign_info ->> 'apply_start_date')::TIMESTAMPTZ <= NOW() 
                  AND (campaign_info ->> 'apply_end_date')::TIMESTAMPTZ >= NOW() 
                  AND NOT(applied_influencers @> ${userExpression})
                  AND type = ${data.type} 
                  AND is_confirm = true
                  ${campaignByType}
              `,
              first,
              campaignCount => campaignCount.totalcount
            );
            campaignList.campaignCount = count
            return campaignList
          },
          res =>
            go(
              {
                status: true,
                list: res,
                count: res.campaignCount
              },
              success(event.headers)
            )
        );
  } catch (e) {
    return go(
      {
        status: false,
        message: e.message
      },
      failure(event.headers)
    )
  }
};

/**
 * @name getCampaignList
 * @description: 검색조건에 맞는 캠페인 리스트를 반환
 * @access `{ admin }`
 * @mock `{ page, count, state, startDate, endDate, searchTerm, company, type, registrant_email }`
 */
exports.getCampaignList = async (event, context) => {
  if (event.source === 'campaign-warmer') return ;
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.business))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )

  try {
    const {
      page,
      count,
      state,
      startDate,
      endDate,
      searchTerm,
      registrant_email,
      company,
      type,
      is_confirm,
      business
    } = convertEvent2inputData(event)

    let limitTarget
    let searchDate = SQL` 1=1`
    let searchTitle = SQL`AND 1=1`
    let searchType = SQL`AND 1=1`
    let searchCompany = SQL`AND 1=1`
    let searchConfirm = SQL`AND 1=1`
    let searchBusiness = SQL`AND 1=1`
    let start = (page - 1) * count
    if (start < 0) start = 0

    startDate && endDate
      ? (searchDate = SQL`(campaignTable.created_at BETWEEN ${startDate} AND ${endDate})`)
      : ''
    searchTerm
      ? (searchTitle = SQL`AND (campaign_info ->> 'product_code' LIKE '%' || ${searchTerm} || '%' OR campaignTable.name LIKE '%' || ${searchTerm} || '%')`)
      : ''
    limitTarget = event.requestContext.authorizer.auth === 'business'
      ? SQL`AND registrant_email = ${event.requestContext.authorizer.email}`
      : registrant_email
        ? SQL`AND registrant_email = ${registrant_email}`
        : SQL`AND true`
    company
      ? (searchCompany = SQL`AND (usersTable.user_info ->> 'company' LIKE '%' || ${company} || '%' )`)
      : ''
    type ? (searchType = SQL`AND (campaignTable.type=${type})`) : ''
    is_confirm !== null && is_confirm !== undefined
      ? (searchConfirm = SQL`AND is_confirm = ${is_confirm}`)
      : ''
    if (business && event.requestContext.authorizer.auth === 'admin'){
      searchBusiness = SQL`AND registrant_email <> ${event.requestContext.authorizer.email}`
    }

    return !(page && count)
      ? go(
        {
          status: false,
          message: 'Error params'
        },
        failure(event.headers)
      )
      : go(
          QUERY`
            SELECT
              campaignTable.*,
              usersTable.user_info ->> 'company' AS company,
              usersTable.user_info ->> 'brand' AS brand
            FROM
              campaign AS campaignTable
            LEFT JOIN
              users AS usersTable
            ON 
              campaignTable.registrant_email = usersTable.email
            WHERE
              ${searchDate} ${searchTitle} ${searchType} ${searchCompany} ${searchState(state)} ${limitTarget} ${searchConfirm} ${searchBusiness}
            ORDER BY id DESC
            LIMIT ${count}
            OFFSET ${start}
          `,
          async campaignList => {
            const count = await go(
              QUERY`
                SELECT
                  COUNT(*) totalCount
                FROM
                  campaign AS campaignTable
                LEFT JOIN
                  users AS usersTable
                ON 
                  campaignTable.registrant_email = usersTable.email
                WHERE
                  ${searchDate} ${searchTitle} ${searchType} ${searchCompany} ${searchState(state)} ${limitTarget} ${searchConfirm} ${searchBusiness}
              `,
              first,
              campaignCount => campaignCount.totalcount
            );
            campaignList.campaignCount = count
            return campaignList
          },
          res =>
            go(
              {
                status: true,
                count: res.campaignCount,
                list: res
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
};

/**
 * @name getCampaignListAfterAnnouncementDate
 * @description: 발표일 이후, 캠페인 시작 전의 리스트를 반환 (페이징 기능 제외)
 * @access `{ admin }`
 * @mock `{ page, count, state, startDate, endDate, searchTerm, company, type, registrant_email }`
 */
exports.getCampaignListAfterAnnouncementDate = async (event, context) => {
  if (event.source === 'campaign-warmer') return ;
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.business))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )

  try {
    const limitTarget = event.requestContext.authorizer.auth === 'business'
      ? SQL`AND registrant_email = ${event.requestContext.authorizer.email}`
      : SQL`AND true`

    return !event.requestContext.authorizer.auth
      ? go(
        {
          status: false,
          message: 'Error params'
        },
        failure(event.headers)
      )
      : go(
          QUERY`
            SELECT
              *
            FROM
              campaign AS campaignTable
            WHERE
              (campaign_info ->> 'announcement_date')::TIMESTAMPTZ < NOW() AND
              (campaign_info ->> 'sale_start_date')::TIMESTAMPTZ > NOW()
              ${limitTarget}
            ORDER BY id DESC
          `,
          res =>
            go(
              {
                status: true,
                list: res
              },
              success(event.headers)
            )
        )
  } catch (e) {
    log(e)
    return go(
      {
        status: false,
        message: e.message
      },
      failure(event.headers)
    )
  }
};

/**
 * @name getCampaignListForMarketing
 * @description: 승인된 모든 캠페인 리스트를 반환
 * @access `{ all people }`
 * @mock `{ page, count }`
 */
exports.getCampaignListForMarketing = async (event, context) => {
  if (event.source === 'campaign-warmer') return

  try {
    const { page, count } = convertEvent2inputData(event)

    let start = (page - 1) * count
    if (start < 0) start = 0

    return !(page && count)
      ? go(
        {
          status: false,
          message: 'Error params'
        },
        failure(event.headers)
      )
      : go(
          QUERY`
            SELECT
              *
            FROM
              campaign
            WHERE
              is_confirm = true
            ORDER BY id DESC
            LIMIT ${count}
            OFFSET ${start}
          `,
          async campaignList => {
            const count = await go(
              QUERY`
                SELECT
                  COUNT(*) totalCount
                FROM
                  campaign
                WHERE
                  is_confirm = true
              `,
              first,
              campaignCount => campaignCount.totalcount
            );
            campaignList.campaignCount = count
            return campaignList
          },
          res =>
            go(
              {
                status: true,
                count: res.campaignCount,
                list: res
              },
              success(event.headers)
            )
        );
  } catch (e) {
    return go(
      {
        status: false,
        message: e.message
      },
      failure(event.headers)
    )
  }
};

/**
 * @name getCampaignCount
 * @description: 캠페인 개수를 반환
 * @access `{ admin, business }`
 * @mock `{}`
 */
exports.getCampaignCount = async (event, context) => {
  if (event.source === 'campaign-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.business))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )

  try {
    const limitCampaign = event.requestContext.authorizer.auth === 'business'
      ? SQL`registrant_email = ${event.requestContext.authorizer.email}`
      : true
    return go(
      QUERY`
        SELECT count(*) as totalCount,
          (SELECT COUNT(*) FROM campaign WHERE NOW() < (campaign_info ->> 'sale_start_date')::TIMESTAMPTZ AND ${limitCampaign}) as waitingCount,
          (SELECT COUNT(*) FROM campaign WHERE NOW() BETWEEN (campaign_info ->> 'sale_start_date')::TIMESTAMPTZ AND (campaign_info ->> 'sale_end_date')::TIMESTAMPTZ AND ${limitCampaign}) as progressCount,
          (SELECT COUNT(*) FROM campaign WHERE NOW() >= (campaign_info ->> 'sale_end_date')::TIMESTAMPTZ AND ${limitCampaign}) as completeCount
        FROM
          campaign
        WHERE
          ${limitCampaign}
      `,
      success(event.headers)
    );
  } catch (e) {
    return go(
      {
        status: false,
        message: e.message
      },
      failure(event.headers)
    )
  }
};

/**
 * @name getAppliedCampaignList
 * @description: 검색조건에 맞는 자신이 신청한 캠페인 리스트를 반환
 * @access `{ influencer, womanstalk }`
 * @mock `{ email, page, count, state, startDate, endDate, searchTerm, type }`
 */
exports.getAppliedCampaignList = async (event, context) => {
  if (event.source === 'campaign-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.influencer, AUTH.USER_ROLE.womanstalk))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )
  try {
    const {
      userId,
      page,
      count,
      state,
      searchTerm,
      type
    } = convertEvent2inputData(event)

    let start = (page - 1) * count
    if (start < 0) start = 0
    let searchTitle = SQL`AND true`
    let searchType = SQL`AND true`
    const userExpression = !event.requestContext.authorizer.email || SQL`applied_influencers @> jsonb_build_array(jsonb_build_object('email', ${event.requestContext.authorizer.email}::TEXT))`

    searchTerm != null
      ? (searchTitle = SQL`AND name LIKE '%' || ${searchTerm} || '%'`)
      : '';
    type != null ? (searchType = SQL`AND (type=${type})`) : '';

    return !(page && count)
      ? go(
        {
          status: false,
          message: 'Error params'
        },
        failure(event.headers)
      )
      : go(
          QUERY`
            SELECT
              campaignTable.id,
              type,
              name,
              campaign_info ->> 'sale_start_date' AS sale_start_date,
              campaign_info ->> 'sale_end_date' AS sale_end_date,
              campaign_info ->> 'posting_limit' AS posting_limit,
              campaign_info ->> 'hash_tag' AS hash_tag,
              campaign_info ->> 'postType' AS post_type,
              campaign_info -> 'post_requirement' AS post_requirement,
              is_confirm,
              on_chain,
              main_img,
              applied_influencers,
              campaign_info ->> 'announcement_date' AS announcement_date,
              sub_type,
              (
                SELECT posting.media_info -> (jsonb_array_length(posting.media_info) - 1) AS media_info 
                FROM posting
                WHERE campaign_id = campaignTable.id AND influencer_id = ${userId}
              ) AS media_info
            FROM
              campaign AS campaignTable
            WHERE
              ${userExpression}
              ${searchTitle}
              ${searchType}
              ${searchState(state, event.requestContext.authorizer.email)}
              AND is_confirm = true
            ORDER BY id DESC
            LIMIT ${count}
            OFFSET ${start}`,
          async campaignList => {
            const count = await go(
              QUERY`
                SELECT
                  COUNT(*) totalCount
                FROM
                  campaign
                WHERE
                  ${userExpression}
                  ${searchTitle}
                  ${searchType}
                  ${searchState(state, event.requestContext.authorizer.email)}
              `,
              first,
              campaignCount => campaignCount.totalcount
            );
            campaignList.campaignCount = count;
            return campaignList;
          },
          res =>
            go(
              {
                status: true,
                list: res,
                count: res.campaignCount
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
};

exports.getAppliedCampaignCount = async (event, context) => {
  if (event.source === 'campaign-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.all))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )

  try {
    const setWhereByAuth = go(
      event.requestContext.authorizer.auth,
      match
        .case(auth => auth === 'influencer')(
          _ => SQL`
            AND is_confirm = true
          `
        )
        .else(_ => SQL`AND true`)
    )
    return go(
      QUERY`
        SELECT 
          count(*) AS totalCount,
          (SELECT
            COUNT(*)
          FROM
            campaign
          WHERE
            NOW() < (campaign_info ->> 'sale_start_date')::TIMESTAMPTZ AND
            applied_influencers @> jsonb_build_array(jsonb_build_object('email', ${event.requestContext.authorizer.email}::TEXT))
            ${setWhereByAuth}
          ) AS waitingCount,
          (
            SELECT
              COUNT(*)
            FROM
              campaign
            WHERE
              NOW() BETWEEN (campaign_info ->> 'sale_start_date')::TIMESTAMPTZ AND (campaign_info ->> 'sale_end_date')::TIMESTAMPTZ AND
              (
                (
                  type = 'regular' AND
                  applied_influencers @> jsonb_build_array(jsonb_build_object('email', ${event.requestContext.authorizer.email}::TEXT, 'is_hidden', false))
                )
                OR
                (
                  type = 'group' AND
                  applied_influencers @> jsonb_build_array(jsonb_build_object('email', ${event.requestContext.authorizer.email}::TEXT))
                )
                OR
                (
                  type = 'advertisement' AND
                  applied_influencers @> jsonb_build_array(jsonb_build_object('email', ${event.requestContext.authorizer.email}::TEXT))
                )
              )
              ${setWhereByAuth}
            ) AS progressCount,
            (
              SELECT
                COUNT(*)
              FROM
                campaign
              WHERE
                applied_influencers @> jsonb_build_array(jsonb_build_object('email', ${event.requestContext.authorizer.email}::TEXT)) AND
                (
                  (
                    type = 'regular' AND
                    applied_influencers @> jsonb_build_array(jsonb_build_object('is_hidden', true))
                  )
                  OR
                  NOW() >= (campaign_info ->> 'sale_end_date')::TIMESTAMPTZ
                )
                ${setWhereByAuth}
            ) AS completeCount
          FROM
            campaign
          WHERE
            applied_influencers @> jsonb_build_array(jsonb_build_object('email', ${event.requestContext.authorizer.email}::TEXT))
            ${setWhereByAuth}
      `,
      success(event.headers)
    )
  } catch (e) {
    log(e)
    return go(
      {
        status: false,
        message: e.message
      },
      failure(event.headers)
    )
  }
};

/** Open API */
exports.getCampaignState = async (event, context) => {
  if (event.source === 'campaign-warmer') return
  try {
    const { id } = convertEvent2inputData(event)

    return go(
      await QUERY`
        SELECT 
          campaign_info ->> 'sale_start_date' AS sale_start_date, 
          campaign_info ->> 'sale_end_date' AS sale_end_date
        FROM
          campaign 
        WHERE
          id=${id}
      `,
      ([{ sale_start_date, sale_end_date }]) => {
        const now = moment()
        const saleStart = moment(sale_start_date)
        const saleEnd = moment(sale_end_date)
        return match(now)
          .case(now => now < saleStart)(_ => 'waiting')
          .case(now => now >= saleEnd)(_ => 'complete')
          .else(_ => 'progress')
      },
      state => ({ state: state }),
      success(event.headers)
    )
  } catch (e) {
    return go(
      match(e.message)
        .case(msg => msg === "Cannot destructure property `sale_start_date` of 'undefined' or 'null'.")(_ => 'Unable to retrieve campaign status')
        .else(msg => msg),
      msg => ({ status: false, message: msg }),
      failure(event.headers)
    )
  }
};

exports.getCampaignCountByUser = async (event, context) => {
  if (event.source === 'campaign-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.all))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )

  try {
    const userExpression = `[{"email": "${event.requestContext.authorizer.email}"}]`
    const count_by = curry(function(f, iter){
      return reduce(
        function(obj, val){
          const type = f(val);
          obj[type] ? obj[type] ++ : obj[type] = 1
          return obj
        },
        {},
        iter
        )
    })

    const err = await go(
      {
        status: false,
        message: 'Error params'
      },
      failure(event.headers)
    )
    const res = await go(
      QUERY `
        SELECT 
          type, 
          applied_influencers 
        FROM 
          campaign 
        WHERE 
          applied_influencers @> ${userExpression} AND 
          (campaign_info ->> 'sale_end_date')::TIMESTAMPTZ > NOW()
      `,
      map(({type, applied_influencers}) => go(
        applied_influencers,
        find(user => user.email === event.requestContext.authorizer.email),
        ({is_hidden}) => ({
          type,
          is_hidden: type ==='regular' ? is_hidden : false // case type
        })
      )),
      filter(({is_hidden}) => !is_hidden),
      count_by(user => user.type),
      success(event.headers)
    )
    return res || err
  } catch (e) {
    return go({
      status: false,
      message: e.message
    },
      failure(event.headers)
    )
  }
}

exports.getCampaignId = async (event, context) => {
  if (event.source === 'campaign-warmer') return
  try {
    return go(
      QUERY `SELECT nextval('campaign_id_seq')`,
      success(event.headers)
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

/**
 * @name: checkAppointedCampaign
 * @description: 유저가 지정되어있는 캠페인이 있는지 체크
 * @access `{ influencer }`
 */
exports.checkAppointedCampaign = async (event, context) => {
  if (event.source === 'campaign-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.influencer))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )

  try {
    const data = convertEvent2inputData(event)
    return !data
      ? go(
        {
          status: false,
          message: 'Error params'
        },
        failure(event.headers)
      )
      : go(
        QUERY`
        SELECT
          id,
          name,
          main_img,
          created_at
        FROM
          campaign,
          jsonb_array_elements(applied_influencers) AS influencer
        WHERE
          (campaign_info ->> 'sale_start_date')::TIMESTAMPTZ > NOW()
          AND (campaign_info ->> 'apply_start_date')::TIMESTAMPTZ < NOW()
          AND campaign.is_confirm = true
          AND influencer ->> 'email' IS NULL
          AND influencer ->> 'id' = ${data.user_id}
          AND influencer ->> 'isAppointed' = 'true'
          AND NOT(influencer ? 'isReject')
        ORDER BY id DESC
        `,
        success(event.headers)
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
