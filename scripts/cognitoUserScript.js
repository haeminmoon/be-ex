// tool
const { go, map, log, tap, filter, mapC, first, remove, find, take, takeAll, mapL, takeL, goFirst, entries, head, pick } = require('ffp-js');
const fs = require('fs')
function curry(f) {
  return (a, ..._) => _.length < 1 ? (..._) => f(a, ..._) : f(a, ..._);
}
const searchAttributes = (arr, searchKey) => go(
  arr,
  filter(({ Name, Value }) => Name === searchKey),
  head,
  pick('Value'),
  entries,
  head,
  ([k, v]) => v
)
// AWS
const AWS = require('/opt/node_modules/aws-sdk');
// Credentials
const Credentials = require('./config/credentials');
// Database setting
const { MySQL } = require('fxsql');
const { CONNECT } = MySQL;

const stage = "dev";

const { QUERY, TABLE, VALUES, SQL, MQL_DEBUG } = CONNECT(Credentials[stage].wtDB);

AWS.config.region = Credentials[stage].region;
const cognitoCall = (method, params) => {
  const cognito = new AWS.CognitoIdentityServiceProvider();
  return cognito[method](params).promise()
}

const createCognitoUser = async (data) => {
  const params = {
    UserPoolId: Credentials[stage].cognito_user_pool_id,// process.env.userPoolId,
    Username: data.email,
    DesiredDeliveryMediums: ['EMAIL'],
    TemporaryPassword: `q${Math.ceil(Math.random() * Math.pow(10, 8))}!`, // TODO: remove in real migration
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
  log('create user email : ', data.email)
  return await cognitoCall('adminCreateUser', params);
}

const createCognitoAdmin = async (data) => {
  const params = {
    UserPoolId: Credentials[stage].cognito_user_pool_id,// process.env.userPoolId,
    Username: data.email,
    // DesiredDeliveryMediums: ['EMAIL'],
    TemporaryPassword: `1q2w3e4r!`, // TODO: remove in real migration
    MessageAction: 'SUPPRESS', // TODO: remove in real migration
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
        Value: 'admin'
      }
    ]
  };
  log('create user email : ', data.email)
  return await cognitoCall('adminCreateUser', params);
}

const createCognitoBusiness= async (data) => {
  const params = {
    UserPoolId: Credentials[stage].cognito_user_pool_id,// process.env.userPoolId,
    Username: data.email,
    // DesiredDeliveryMediums: ['EMAIL'],
    TemporaryPassword: `1q2w3e4r!`, // TODO: remove in real migration
    MessageAction: 'SUPPRESS', // TODO: remove in real migration
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
        Value: 'business'
      }
    ]
  };
  log('create user email : ', data.email)
  return await cognitoCall('adminCreateUser', params);
}

const setUserAttrubutes = async (data) => {
  const params = {
    "UserAttributes": [
      {
        "Name": data.attributes.name,
        "Value": data.attributes.value
      }
    ],
    "Username": data.email,
    "UserPoolId": Credentials[stage].cognito_user_pool_id
  }
  log(data.email, ' - ', data.attributes.name, ' = ', data.attributes.value)
  return await cognitoCall('adminUpdateUserAttributes', params);
}


const getICOUsersInCognito = async (condition) => {
  let userList = [];
  let paginationToken = null;
  do {
    let list = await cognitoCall('listUsers', {
      UserPoolId: Credentials[stage].ICO_user_pool_id,
      PaginationToken: paginationToken
    })
    paginationToken = list.PaginationToken;
    userList = userList.concat(go(list.Users, filter(condition), map(a => {
      return go(a.Attributes, filter(f => f.Name === 'email' || f.Name === 'name' || f.Name === 'custom:walletAddress'))
    })))
  } while (!!paginationToken)

  return userList;
}

const getWtInfluencerList = async _ => {
  try {
    console.log('\n\rFetching influencer list from WT eh_list table...');
    let response = await QUERY`SELECT * FROM eh_list where is_active='Y' AND is_celeb='Y'`;
    return response;
  } catch (e) {
    console.log('getWtInfluencerList#Error:', e);
    Promise.reject('Cannot fetch eh_list table from womanstdb!');
  }
}

const getWtInfluencer = async email => {
  try {
    let response = await QUERY`SELECT * FROM eh_list where is_active='Y' AND is_celeb='Y' AND email = ${email}`;
    return response;
  } catch (e) {
    console.log('getWtInfluencerList#Error:', e);
    Promise.reject('Cannot fetch eh_list table from womanstdb!');
  }
}

// let IcoUserCount = 0;
// go(
//   inf => 
//     inf.UserStatus === "CONFIRMED" 
//     && go(
//       ['custom:isWhiteList', 'custom:isAcceptTerms'], 
//       mapC(searchKey => searchAttributes(inf.Attributes, searchKey)), 
//       ([a ,b]) => a === 'true' && b === 'true'
//     ),
//   getICOUsersInCognito,
//   tap(a => IcoUserCount = a.length),
//   map(a => go(
//     a,
//     map(({ Name, Value }) => {
//       return `${Name}: ${Value}`
//     }),
//     b => `{\n\t${b.join(',\n\t')}\n}`
//   )),
//   c => c.join(',\n'),
//   d => `Selected User Count : ${IcoUserCount}\n${d}`,
//   tap(_ => log('file write...')),
//   e => fs.writeFileSync('ICO_user_list.txt', e, 'utf-8'),
//   tap(_ => log('complete write'))
// )

// go(
//   'heroluv1123@naver.com',
//   getWtInfluencer,
//   head,
//   a => Object.assign(a, {
//     name: a.real_name,
//     nickname: a.host_name
//   }),
//   pick(['name', 'nickname', 'email']),
//   createCognitoUser,
//   log
// )

// go(
//   {
//     email: 'lily@celebplus.io',
//     attributes: {
//       name: 'custom:auth',
//       value: 'admin'
//     }
//   },
//   setUserAttrubutes
// )

// go(
//   {
//     email: 'minibk12@nate.com',
//     name: '정보경',
//     nickname: '비케이문'
//   },
//   createCognitoUser
// )

go(
  {
    email: 'yunadev01@gmail.com',
    nickname: '비바퍼블리카',
    name: '신유나'
  },
  createCognitoBusiness
)