Object.assign(global, require('ffp-js'))
const { POOL } = require('/opt/libs/postgresql-lib')
const { QUERY, VALUES } = POOL;
const APPOINT = {}

/**
 * @name createCampaign
 * @description 지정형 캠페인 등록
 * @param data (캠페인 등록 데이터)
 * @condition applied_influencers 에 데이터가 있을 시
 * */
APPOINT.createCampaign = data => go(
  data,
  remove('applied_influencers'),
  c => QUERY`INSERT INTO campaign ${VALUES(c)} RETURNING *`,
  ([rows]) => go(
    data.applied_influencers,
    applied_influencers => QUERY`
    UPDATE
      campaign
    SET 
      applied_influencers = COALESCE((
        SELECT 
          to_jsonb(array_agg(list)) AS jsonb 
        FROM 
          ( 
            SELECT 
              jsonb_array_elements(${JSON.stringify(applied_influencers)}::jsonb) 
            AS 
              list 
          ) t
        ), '[]'::JSONB)
    WHERE 
      id = ${rows.id}`,
    _ => rows
  )
)

/**
 * @name applyCampaign
 * @description 지정된 인플루언서 인 경우 캠페인 신청전 applied_influencers값에 등록시 저장된 해당 인플루언서 데이터를 삭제
 * @param data (캠페인 신청 데이터)
 * @condition 해당 유저가 지정형 인플루언서인지
 * */
APPOINT.applyCampaign = data => QUERY`
  UPDATE
    campaign
  SET
    applied_influencers = COALESCE(
    (
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
        NOT(applied_influencers @> jsonb_build_object('id', ${data.applied_influencers.id}::INT))
    ),
    '[]'::JSONB)
  WHERE
    id = ${data.id}
  `

/**
 * @name getCampaignByUser
 * @description
 * 캠페인 리스트에 지정된 인플루언서인경우 판매 시작기간전까지 캠페인 노출
 * 모집인원이 0인 캠페인은 지정된 인플루언서가 아니면 노출 x
 */
APPOINT.getCampaignByUser = (campaignList, userId, email) => go(
  QUERY`
  SELECT
	*
  FROM
    campaign,
    jsonb_array_elements(applied_influencers) AS influencer
  WHERE
    (campaign_info ->> 'apply_end_date')::TIMESTAMPTZ < NOW()
    AND is_confirm = true
    AND (campaign_info ->> 'sale_start_date')::TIMESTAMPTZ  > NOW()
    AND influencer ->> 'id' = ${userId}
    AND NOT(influencer @> jsonb_build_object('email', ${email}::TEXT))`,
  list => (list.length !== 0)
    ? campaignList.concat(list)
    : campaignList,
  filter(({ campaign_info: { limit_count }, applied_influencers }) => parseInt(limit_count) !== 0 || applied_influencers.some(user => user.id === Number(userId)))
)

/**
 * @name updateCampaign
 * @description 수정된 지정형 인플루언서 업데이트
 * @condition appoint_influencers가 있을시
 * */
APPOINT.updateCampaign = (data) => QUERY`
  UPDATE
    campaign
  SET 
    applied_influencers = (
      SELECT 
        to_jsonb(array_agg(list)) AS jsonb 
      FROM 
        ( 
          SELECT 
            jsonb_array_elements(${JSON.stringify(data.appoint_influencers)}::jsonb) 
          AS 
            list 
        ) t
      )
  WHERE 
    id = ${data.id}`

module.exports = {
  APPOINT
}
