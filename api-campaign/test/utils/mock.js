const { addDay } = require('./format')

module.exports = {
  id: (process.env.STAGE === 'prod') ? 208 : 10024,
  campaign_data: {
    name: '테스트 mock 캠페인',
    gender: '테스트 성별',
    hash_tag: '테스트 해시태그',
    product_code: '테스트 상품 코드',
    type: '테스트 타입',
    product_price: 0,
    revenue_ratio: '테스트 수익률',
    total_supply: '0',
    apply_start_date: new Date(),
    apply_end_date: addDay(new Date(), 1),
    sale_start_date: addDay(new Date(), 2),
    sale_end_date: addDay(new Date(), 3),
    shipping_date: addDay(new Date(), 4),
    campaign_description: '테스트 설명',
    mission_description: '테스트 미션',
    limit_count: '20',
    offer: '테스트 제공내역',
    guide: '테스트 안내사항',
    main_img: 'https://img.womanstalk.co.kr/upload/product/20170619/prodImg3/2017061900002_view_mobile_1562029442.jpg',
    created_at: new Date()
  },
  inf_data: {
    id: 0,
    applied_influencers: {
      id: process.env.STAGE === 'prod' ? 468 :5679,
      email: 'mwoo526@naver.com',
      nickname: '테스트 닉네임',
      name: '테스트 이름',
      business_account: {},
      product_comment: '',
      influencer_comment: '',
      posting_url: [],
      spin_ratio: 100,
      fiat_ratio: 0,
      post_code: '테스트 우편번호',
      address: '테스트 주소',
      detail_address: '테스트 상세 주소',
      phone: '테스트 전화 번호',
      is_hidden: false,
      is_stop: false
    },
    'updated_at': new Date()
  },
  index: 0,
  product_comment: '상품 설명',
  product_image: ['상품 이미지'],
  influencer_comment: '인플루언서 상세 설명',
  posting_url: ['https://celebplus.com'],
  is_check: true,
  is_posting: true,
  email: 'mwoo526@naver.com',
  page: 1,
  count: 10,
  state: 'complete',
  registrant_email: 'admin@celebplus.io',
  sale_end_date: new Date(),
  updated_at: new Date(),
  is_hidden: true,
  is_stop: true,
  test_key: {
    name: 'celeb-test', 
    auth: 'test', 
    email: 'mwoo526@naver.com'
  }
}
