Object.assign(global, require('ffp-js'))

const { POOL } = require('/opt/libs/postgresql-lib')
const { QUERY, VALUES, SQL, CL } = POOL;
const { success, failure } = require('/opt/libs/response-lib')
const { convertEvent2inputData } = require('/opt/libs/api-util-lib')
const { AUTH } = require('/opt/libs/authorizer-lib')
const { APPOINT } = require('./function')
const { S3 } = require('./apis/api')

/**
 * @name createCampaign
 * @description: 캠페인 등록
 * @access `{ admin, business }`
 * @mock `{ create_campaign_data }`
 */
exports.createCampaign = async (event, context) => {
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
    const data = convertEvent2inputData(event)
    return (!data)
      ? go(
        {
          status: false,
          message: 'Error params'
        },
        failure(event.headers)
      )
      : go(
        data,
        a => Object.assign(a, { "registrant_email": event.requestContext.authorizer.email }),
        b => (event.requestContext.authorizer.auth !== 'admin') ? (b.is_confirm = false, b) : b,
        c => (!c.applied_influencers)
          ? QUERY`INSERT INTO campaign ${VALUES(c)} RETURNING *`
          : APPOINT.createCampaign(c),
        success(event.headers)
      );
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
}

exports.deleteCampaign = async (event, context) => {
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
    const { id } = convertEvent2inputData(event)
    return (!id)
      ? go(
        {
          status: false,
          message: 'Error params'
        },
        failure(event.headers)
      )
      : go(
          id,
          a => QUERY`DELETE FROM campaign WHERE id = ${a}`,
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

exports.updateAppliedInfluencer = async (event, context) => {
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
            type, 
            campaign_info -> 'limit_count' AS limit_count, 
            applied_influencers,
            sub_type
          FROM 
            campaign 
          WHERE 
            id = ${data.id}
        `,
        first,
        campaign => go(
          campaign.applied_influencers,
          list => list.some(user => (user.id === data.applied_influencers.id && !user.isAppointed)),
          res => res
            ? go(
              {
                status: false,
                message: 'Same influencer'
              },
              failure(event.headers)
            )
            : go(
              campaign,
              match
                .case(a => a.applied_influencers.some(user => user.id === data.applied_influencers.id && user.isAppointed))
                (_ => APPOINT.applyCampaign(data))
                .case(a => a.sub_type === 'selection')
                (a => {
                  data.applied_influencers.is_hidden = true
                  return true
                })
                .case(a => a.type === 'group' && a.sub_type !== 'selection')
                (a => a.limit_count > go(a.applied_influencers, filter(user => user.email && !user.isAppointed), list => list.length))
                .else(_ => true),
              bool => bool
                ? go(
                  QUERY`
                    UPDATE
                      campaign
                    SET
                      applied_influencers = applied_influencers || ${data.applied_influencers},
                      updated_at = ${data.updated_at}
                    WHERE
                      id=${data.id}`,
                      success(event.headers)
                )
                : go(
                  {
                    status: false,
                    message: 'Error limit'
                  },
                  failure(event.headers)
                )
            )
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

/**
 * @param {*} string
 * @description : . * + ? ^ $ ' " { } ( ) | [ ] \n 에 해당하는 문자를 만나면 escape 처리해주는 함수
 */
const escapeSpecialCharacters = string => string
  .replace(/[\\]/g, '\\$&')
  .replace(/["']/g, '\\"')
  .replace(/[\n]/g, '\\n')


/**
 * @name updatePostingUrl
 * @description: `influencer`의 My Shop에 들어가는 메세지, Comment 작성
 * @access `{ influencer }`
 * @mock `{ id, index, posting_url, updated_at }`
 * @todo: 현재 json_set method를 사용하여 applied influencer 의 index를 통해 관리하는데, 이를 email기반으로 관리할 필요가 있음
 */
exports.updatePostingUrl = async (event, context) => {
  if (event.source === 'campaign-warmer') return ;
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.influencer))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )

  try {
    const data = convertEvent2inputData(event);
    const postingURLExpression = `{"${data.index}", "posting_url"}`;
    const postingURL = `["${data.posting_url.join('" , "')}"]`

    return (!data)
      ? go(
        {
          status: false,
          message: 'Error params'
        },
        failure(event.headers)
      )
      : go(
          data,
          a => QUERY`
            UPDATE 
              campaign 
            SET 
              applied_influencers = jsonb_set(applied_influencers, ${postingURLExpression}, ${postingURL}) , updated_at = ${a.updated_at} 
            WHERE 
              id = ${a.id}
            RETURNING
              applied_influencers
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
}


/**
 * @name updateAppliedInfluencersAttributes
 * @description: 캠페인 `id`에 신청한 인플루언서 들의 속성값들을 변경하는 API
 * @access `{ admin, business }`
 * @mock `{ id, influencers: { email, key: value, ... } }`
 */
exports.updateAppliedInfluencersAttributes = async (event, context) => {
  if (event.source === 'campaign-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin, AUTH.USER_ROLE.business))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )
  const { TRANSACTION } = POOL;
  const TR = await TRANSACTION();
  try {
    const { id, influencers } = convertEvent2inputData(event)
    const getPathInAppliedInfluencers = (campaign_id, email, selectSql) => SQL`
      SELECT
        ${selectSql}
      FROM
        campaign,
        jsonb_array_elements(applied_influencers) 
        WITH ORDINALITY AS arr(applied_influencer, index)
      WHERE
        id = ${campaign_id} AND 
        applied_influencer->>'email' = ${email}::TEXT
    `;

    return (!id && !influencers)
      ? go(
        {
          status: false,
          message: 'Error params'
        },
        failure(event.headers)
      )
      : go(
        influencers,
        mapC(({ email, ...attr }) => go(
          attr,
          entries,
          attrArr => reduce((a, [ k, v ]) => SQL`
            jsonb_set(
              ${a},
              (${getPathInAppliedInfluencers(id, email,
                SQL`
                  ('{'||index-1||', ${CL(k)}}')::TEXT[] AS attr
                `
              )}),
              TO_JSONB(${go(
                v,
                match
                  .case(value => Array.isArray(value))(value => SQL`${value}::TEXT[]`)
                  .case(value => typeof(value) === 'object')(value => SQL`${value}::JSONB`)
                  .case(value => typeof(value) === 'boolean')(value => SQL`${value}::BOOLEAN`)
                  .else(value => SQL`${value}::TEXT`)
              )})
            )
          `, SQL`applied_influencers`, attrArr),
          jsonbSet => TR.QUERY`
            UPDATE campaign
            SET
              applied_influencers = COALESCE(${jsonbSet}, applied_influencers),
              updated_at = NOW()
            WHERE 
              id = ${id}
            RETURNING
              applied_influencers -> (${getPathInAppliedInfluencers(id, email, SQL`index-1`)})::INT AS influencer
          `
        )),
        tap(_ => TR.COMMIT()),
        success(event.headers)
      )
  } catch (e) {
    log(e)
    await TR.ROLLBACK()
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
 * @name updateSaleEnd
 * @description: 캠페인 강제종료
 * @access `{ admin, business }`
 * @mock `{ id, sale_end_date, updated_at }`
 * @todo: 현재는 admin역할 만 종료할 수 있게 적용. business 도 종료할 수 있을지도 모름
 */
exports.updateSaleEnd = async (event, context) => {
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
    const data = convertEvent2inputData(event)
    return (!data)
      ? go(
        {
          status: false,
          message: 'Error params'
        },
        failure(event.headers)
      )
      : go(
          data,
          a => QUERY`
            UPDATE 
              campaign 
            SET 
              campaign_info = campaign_info || jsonb_build_object('sale_end_date', ${a.sale_end_date}::TEXT), updated_at = ${a.updated_at} 
            WHERE 
              id=${a.id}
            RETURNING
            campaign_info ->> 'sale_end_date' AS sale_end_date
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

/**
 * @name updateCancelInfluencer
 * @description: 신청한 인플루언서 취소
 * @access `{ admin, business }`
 * @mock `{ id, influencer_id, updated_at }`
 */
exports.updateCancelInfluencer = async (event, context) => {
  if (event.source === 'campaign-warmer') return
  try {
    const data = convertEvent2inputData(event)
    const subQuery_removedAppliedInfluencers = SQL`
      SELECT 
        jsonb_agg(applied_influencers) applied_influencers
      FROM 
        (
          SELECT 
            jsonb_array_elements(applied_influencers) AS applied_influencers 
          FROM 
            campaign 
          WHERE 
            id = ${data.id}
        ) AS list 
      WHERE 
        NOT(applied_influencers @> CONCAT('{"email":"', ${data.email || event.requestContext.authorizer.email}::TEXT, '"}')::JSONB)
    `
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
            UPDATE 
              campaign 
            SET 
              applied_influencers = COALESCE((${subQuery_removedAppliedInfluencers}), '[]'::JSONB) , updated_at = ${data.updated_at} 
            WHERE 
              id = ${data.id}
            RETURNING 
              applied_influencers
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

/**
 * @name updateCampaign
 * @description: 캠페인 정보 변경
 * @access `{ admin, business }`
 * @mock `{ id, campaign_data, updated_at }`
 * @todo: error handling UPDATE query 결과 0 이면 권한에러 설정...
 */
exports.updateCampaign = async (event, context) => {
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
    const data = convertEvent2inputData(event);

    const campaignNotice = !data.notice ? null : data.notice;
    const limitTarget = event.requestContext.authorizer.auth === 'business'
      ? SQL`AND registrant_email = ${event.requestContext.authorizer.email}`
      : SQL`AND true`

    return (!data)
      ? go(
        {
          status: false,
          message: 'Error params'
        },
        failure(event.headers)
      )
      : go(
        data,
        a => QUERY`
          UPDATE 
            campaign 
          SET 
            type = ${a.type}, 
            name = ${a.name}, 
            main_img = ${a.main_img},
            image_list = image_list - '*' || ${a.image_list},
            sub_type = ${a.sub_type},
            updated_at = ${a.updated_at},
            notice = ${campaignNotice},
            is_confirm = ${a.is_confirm || false},
            campaign_info = campaign_info - '*' || ${a.campaign_info}
          WHERE 
            id = ${a.id} ${limitTarget}
        `,
        _ => (data.sub_type === 'private') && APPOINT.updateCampaign(data),
        success(event.headers)
      );
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
}

/**
 * @name updateIsConfirm
 * @description: 캠페인 승인정보 변경
 * @access `{ admin }`
 * @mock `{ id }`
 */
exports.updateIsConfirm = async (event, context) => {
  if (event.source === 'campaign-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )

  try {
    const { id, is_confirm } = convertEvent2inputData(event);

    return (!id)
      ? go(
        {
          status: false,
          message: 'Error params'
        },
        failure(event.headers)
      )
      : go(
        QUERY`
          UPDATE 
            campaign 
          SET 
            is_confirm = ${is_confirm || false}
          WHERE 
            id = ${id}
          RETURNING
            is_confirm
        `,
        first,
        success(event.headers)
      );
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
}


exports.updateRewardPriceInfluencer = async (event, context) => {
  if (event.source === 'campaign-warmer') return;
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.admin))
    return go(
      {
        status: false,
        message: 'Unauthroized'
      },
      failure(event.headers)
    )

  try {
    const data = convertEvent2inputData(event);
    return (!data)
      ? go(
        {
          status: false,
          message: 'Error params'
        },
        failure(event.headers)
      )
      : go(
        data,
        a => QUERY `
        UPDATE
          campaign
        SET
          applied_influencers = jsonb_set(applied_influencers, ${`{"${data.index}", "reward_price"}`}, ${data.reward_price}),
          updated_at = ${a.updated_at}
        WHERE
          id = ${a.id}
        RETURNING
          applied_influencers
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

exports.rejectCampaign = async (event, context) => {
  if (event.source === 'campaign-warmer') return
  if (!AUTH.isAuthorized(event, AUTH.USER_ROLE.influencer))
    return  go(
      {
        status: false,
        message: 'Unauthorized'
      },
      failure(event.headers)
    )

  try {
    const data = convertEvent2inputData(event)
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
        WITH influencer AS (
        SELECT
          ('{'|| index-1 ||',isReject}')::TEXT[] AS is_reject
        FROM
          campaign,
          jsonb_array_elements(applied_influencers)
          WITH ORDINALITY AS arr(applied_influencer, index)
        WHERE
          id = ${data.campaignId} AND
          applied_influencer ->> 'id' = ${data.influencerId}::TEXT 
        )
        UPDATE
          campaign
        SET
          applied_influencers = jsonb_set(
          applied_influencers,
          influencer.is_reject,
          ${data.is_reject}
          )
        FROM
          influencer
        WHERE
          id = ${data.campaignId}
        RETURNING
          influencer
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
