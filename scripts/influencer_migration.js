const AWS = require('/opt/node_modules/aws-sdk');
const { go, map, log, tap, filter, mapL, take, takeL, takeAll, find } = require('/opt/node_modules/ffp-js');
const Credentials = require('./config/credentials');

const stage = "prod";
const mysql = require('/opt/node_modules/serverless-mysql')({
  config: {
    host     : Credentials[stage].wtDB.host,
    database: Credentials[stage].wtDB.database,
    user: Credentials[stage].wtDB.user,
    password: Credentials[stage].wtDB.password
  }
});

AWS.config.region = Credentials[stage].region;
const cognitoCall = (method, params) => {
  const cognito = new AWS.CognitoIdentityServiceProvider();
  return cognito[method](params).promise()
}
const dynamoDBCall = (method, params) => {
  const dynamoDB = new AWS.DynamoDB.DocumentClient();
  return dynamoDB[method](params).promise()
}

function convertInfluencerSchema(data) {
  data = JSON.parse(JSON.stringify(data));
  return {
    id: data.email,
    user_info: {
      wt_eh_list_idx: data.idx,
      rank: 100000,
      name: data.real_name || null,
      nickname: data.host_name || null,
      post_code: data.postcode || null,
      address: data.address || null,
      detail_address: data.address_extra || null,
      phone: data.telephone || null,
      shop_info: {
        shop_name: data.host_title || null,
        shop_description: data.host_message || null
      },
      bank_info: {},
      instagram_info: {}
    },
    auth: 'influencer'
  };
}

async function getWtInfluencerList() {
  try {
    console.log('\n\rFetching influencer list from WT eh_list table...');
    let response = await mysql.query(`SELECT * FROM eh_list where is_active='Y' and is_celeb='Y'`);
    await mysql.quit();
    return response;
  } catch (e) {
    console.log('getWtInfluencerList#Error:', e);
    Promise.reject('Cannot fetch eh_list table from womanstdb!');
  }
}

function createInfluencerOnUserPool(data) {
  const influencer = {
    email: data.email,
    name: data.real_name || '',
    nickname: data.host_name || ''
  };
  return createCognitoUser(influencer)
}

const createCognitoUser = async (data) => {
  const params = {
    UserPoolId: Credentials[stage].cognito_user_pool_id,// process.env.userPoolId,
    Username: data.email,
    DesiredDeliveryMediums: ['EMAIL'],
    TemporaryPassword: `q${Math.ceil(Math.random() * Math.pow(10, 8))}!`,
    // TemporaryPassword: `qwer123!@#`, // TODO: remove in real migration
    // MessageAction: 'SUPPRESS', // TODO: remove in real migration
    UserAttributes: [
      {
        Name: 'email',
        Value: data.email
      },
      {
        Name: 'email_verified',
        Value: 'true'
      },
      {
        Name: 'name',
        Value: data.name
      },
      {
        Name: 'nickname',
        Value: data.nickname
      },
      {
        Name: 'custom:auth',
        Value: 'influencer'
      }
    ]
  };
  return await cognitoCall('adminCreateUser', params);
}

const migrateInfluencer = async influencerList => {
  try {
    let count = 0
    await go(
      influencerList,
      map(influencer => setTimeout(async _ => {
        log(`WT Influencer[${influencer.email}]\n`);
        createInfluencerOnUserPool(influencer);
        await dynamoDBCall('put', {
          TableName: Credentials[stage].dynamoDB_table_name,
          Item: convertInfluencerSchema(influencer)
        })
      }, 0 + 400 * (count++) ))
    )
  } catch (e) {
    log(e)
  }
}

const getUsersInCognito = async (condition) => {
  let userList = [];
  let paginationToken = null;
  do {
    let list = await cognitoCall('listUsers', {
      UserPoolId: Credentials[stage].cognito_user_pool_id,
      PaginationToken: paginationToken
    })
    paginationToken = list.PaginationToken;
    userList = userList.concat(go(list.Users, filter(condition), map(a => {
      return go(a.Attributes, filter(f => f.Name === 'email'), ([b]) => b.Value)
    })))
  } while (!!paginationToken)

  return userList;
}

/** 이 함수는 우먼스톡의 유저 리스트와 코그니토의 유저 리스트를 비교하여 우먼스톡 유저 중 현재 코그니토 유저풀에 들어온 유저 리스트를 반환 */
const getMigratedUserList = async _ => {
  // Count 변수
  let womanstalkUserCount = 0;
  let cognitoUserCount = 0;
  let resultCount = 0;

  // Cognito User List 에서 CONFIRMED 된 유저를 가져옴
  let userList = await getUsersInCognito(inf => inf.UserStatus === "CONFIRMED");
  cognitoUserCount = userList.length

  // Womanstalk User List 모두 가져옴
  let influencerList = await getWtInfluencerList();
  womanstalkUserCount = influencerList.length

  // Womanstalk User List 중 Cognito User List 에서 가져온 이메일과 일치하는 유저를 반환
  influencerList = go(influencerList, filter(a => { return userList.some(email => email === a.email) }))

  resultCount = influencerList.length
  // log(influencerList)
  log("\n---------------------------------------")
  log("Womanstalk User Count : " + womanstalkUserCount)
  log("Cognito Confirmed User Count : " + cognitoUserCount)
  log("Migrated Womanstalk User Count : " + resultCount)
  log("---------------------------------------\n")

  return influencerList
}

/** 이 함수는 우먼스톡의 유저 리스트와 코그니토의 유저 리스트를 비교하여 우먼스톡 유저 중 현재 코그니토 유저풀에 Confirm 상태가 아닌 유저 목록을 반환 */
const getNotMigratedUserList = async _ => {
  // Count 변수
  let womanstalkUserCount = 0;
  let cognitoUserCount = 0;
  let resultCount = 0;

  // Cognito User List 에서 FORCE_CHANGE_PASSWORD 상태인 유저를 가져옴
  let userList = await getUsersInCognito(inf => inf.UserStatus === "FORCE_CHANGE_PASSWORD");
  cognitoUserCount = userList.length

  // Womanstalk User List 모두 가져옴
  let influencerList = await getWtInfluencerList();
  womanstalkUserCount = influencerList.length

  // Womanstalk User List 중 Cognito User List 에서 가져온 이메일과 일치하는 유저를 반환
  influencerList = go(influencerList, filter(a => { return userList.some(email => email === a.email) }))

  resultCount = influencerList.length
  // log(influencerList)
  log("\n---------------------------------------")
  log("Womanstalk User Count : " + womanstalkUserCount)
  log("Cognito Force_Change_Password State User Count : " + cognitoUserCount)
  log("Not Confirmed Womanstalk User Count : " + resultCount)
  log("---------------------------------------\n")

  return influencerList
}

/** 이 함수는 우먼스톡 유저목록에는 존재하지만 사용자 풀에 존재하지 않는 사용자들에게 다시 초대 메세지를 보내는 용도로 쓰임
  * 이미 가입되어있는 유저에게 다시 메일을 보낼 경우, 사용자풀에서 해당 유저들을 제거하고 이 함수를 실행시키면 됨
 */
const resendInviteMessage = async _ => {
  // Count 변수
  let womanstalkUserCount = 0;
  let cognitoUserCount = 0;
  let resultCount = 0;

  // Cognito User List 모두 가져옴
  let userList = await getUsersInCognito(_ => true);
  cognitoUserCount = userList.length

  // Womanstalk User List 모두 가져옴
  let influencerList = await getWtInfluencerList();
  womanstalkUserCount = influencerList.length

  go(
    influencerList,
    filter(a => a.email === 'sonsuhan.kr@gmail.com'),
    log
  )
  go(
    userList,
    filter(a => a === 'sonsuhan.kr@gmail.com'),
    log
  )

  // Womanstalk User List 중 Cognito User List 에서 가져온 이메일과 일치하는 유저를 제외 (일치하지 않는 유저를 반환) 
  // -> 우먼스톡엔 존재하지만 코그니토에는 없는 유저를 반환
  influencerList = go(influencerList, filter(a => { return !userList.some(email => email === a.email) }))

  resultCount = influencerList.length
  log("\n---------------------------------------")
  log("Womanstalk User Count : " + womanstalkUserCount)
  log("Cognito User Count : " + cognitoUserCount)
  log("Not Migrated Womanstalk User Count : " + resultCount)
  log("---------------------------------------\n")

  // Migration 실행
  // 아래 Commend Line 을 주석처리하면 리스트만 볼 수 있음
  await migrateInfluencer(influencerList)
  // console.log(influencerList)
  
  return influencerList
}

const specificUsersInvite = async _ => {
  // 특정 유저들 코그니토와 dynamo db에 생성. [ {...}, {...}, {...} ] 이와같은 형식으로 입력
  const influencerList = []
  await migrateInfluencer(influencerList)

  return influencerList
}

const excuteFunction = async _ => {
  // specificUsersInvite()
  resendInviteMessage()
  // getMigratedUserList()
  // let deleteList = await getUsersInCognito(inf => inf.UserStatus === "FORCE_CHANGE_PASSWORD");
  // console.log(deleteList.length)
  // let count = 0;
  // await go(
  //   deleteList,
  //   map(userSub => setTimeout(_ => {
  //     console.log('delete user sub : '+userSub)
  //     let params = {
  //       UserPoolId: Credentials[stage].cognito_user_pool_id,
  //       Username: userSub
  //     }
  //     cognitoCall('adminDeleteUser', params)
  //   }, 0+400*count++))
  // )
  /** CREATE USERS */
  // createCognitoUser({
  //   email: 'seolhoman@naver.com',
  //   nickname: '다니엘',
  //   name: '유설호'
  // })
}

excuteFunction();