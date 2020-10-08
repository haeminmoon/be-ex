Object.assign(global, require("ffp-js"));

// set file system
const fs = require('fs');

// set credential
const Credentials = require('../config/credentials');

// set stage
const prodStage = "prod";
const targetStage = process.env.TARGET || "prod";
const targetDB = process.env.DB || "celebDB";
const targetCognitoUserPool = 'celeb_cognito_user_pool_id'

// set AWS
const AWS = require('/opt/node_modules/aws-sdk');

// set Cognito
AWS.config.region = Credentials[targetStage].region;
const cognitoCall = (method, params) => {
  const cognito = new AWS.CognitoIdentityServiceProvider();
  return cognito[method](params).promise()
}

// postgre sql
const { PostgreSQL } = require('fxsql');
const { CONNECT } = PostgreSQL;

const PROD = CONNECT(Credentials[prodStage].spinDB);
const TARGET = CONNECT(Credentials[targetStage][targetDB]);

/** --------------------------------@name UTILS_FUNCTION ------------------------------------------ */

/**
 * @name pop
 * @description: 지정한 el을 arr에서 뽑는 함수 (el값이 없을 경우, 마지막 el을 뽑는다)
 */
const pop = (el, arr) => {
  if (Array.isArray(el)) return el.pop()
  return (Array.isArray(arr)) 
    ? arr.splice(arr.indexOf(el), 1)[0] 
    : arr => arr.splice(arr.indexOf(el), 1)[0]
}

const delay = (resFunction, time = 2000) => {
  return new Promise((res, rej) => {
    setTimeout(_ => {
      try {
        res(resFunction())
      } catch (e) {
        rej(e)
      }
    }, time)
  }) 
}

const writeLogFile = data => {
  const fileName = `migration_${prodStage}_to_${targetStage}_${new Date().toISOString().split('.')[0]}.txt`
  fs.writeFile(
    `./log/${fileName}`, 
    data, 
    'utf8', 
    err => {
      if (err) throw ({ message: 'file write error', body: err })
      else log(`log file writed : ${fileName}`)
    }
  )
}

const sumObjectArray = arr => arr.reduce((prev, next) => {
  if (!prev) return 0;
  for (const key in prev) {
    prev[key] += next[key];
  }
  return prev;
});

/** --------------------------------@name MIGRATION_FUNCTION ------------------------------------------ */

const migration = curry(async (tableName, getQuery) => {
  let total_count = 0;
  // clear table
  await TARGET.QUERY`TRUNCATE TABLE ${TARGET.TABLE(tableName)}`
  return go(
    getQuery,
    tap(a => { total_count = a.length }),
    mapC(async data => await insertTargetDB[tableName](data)),
    countArr => (countArr.length === 0) 
      ? ({ successCount: 0, failureCount: 0, failureLog: '' }) 
      : sumObjectArray(countArr)
    ,
    tap(async _ => await TARGET.QUERY`SELECT setval(${tableName + '_id_seq'}, (SELECT MAX(id) FROM ${TARGET.TABLE(tableName)}))`),
    ({ successCount, failureCount, failureLog }) => {
      log(
        "total_count : ",
        total_count,
        " | successCount : ",
        successCount,
        " | failureCount : ",
        failureCount
      );
      return `@table : ${tableName}\n@result\n  - total_count : ${total_count}\n  - successCount : ${successCount}\n  - failureCount : ${failureCount}\n@failureLog \n${failureLog}`
    }
  );
})

/** ---------------------------------@name COGNITO_FUNCTION ------------------------------------------ */

const getUsersInCognito = async (condition = _ => true) => {
  let userList = [];
  let paginationToken = null;
  do {
    let list = await cognitoCall('listUsers', {
      UserPoolId: Credentials[targetStage][targetCognitoUserPool],
      PaginationToken: paginationToken
    })
    paginationToken = list.PaginationToken;
    userList = userList.concat(
      go(
        list.Users,
        filter(condition), 
        map(a => pickCognitoUserAttributes(['email', 'sub'], a))
      )
    )
  } while (!!paginationToken)
  return userList;
}

const pickCognitoUserAttributes = (attrNameList, user) => go(
  user.Attributes,
  filter(a => attrNameList.some(attr => attr === a.Name)),
  attrList => {
    let obj = {}
    for (const iter of attrList) {
      Object.assign(obj, { [iter.Name]: iter.Value })
    }
    return obj
  }
)

const createCognitoUser = data => {
  const params = {
    UserPoolId: Credentials[targetStage][targetCognitoUserPool],
    Username: data.email,
    DesiredDeliveryMediums: ['EMAIL'],
    TemporaryPassword: `qwer1234!@#$`, // 임시 비밀번호
    MessageAction: 'SUPPRESS', // 메일 안보내는 옵션
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
  return cognitoCall('adminCreateUser', params)
}

const deleteCognitoUser = username => {
  const params = {
    UserPoolId: Credentials[targetStage][targetCognitoUserPool],
    Username: username
  }
  return cognitoCall('adminDeleteUser', params)
}

/** --------------------------------@name INSERT_FUNCTION ------------------------------------------ */

const insertTargetDB = {};

insertTargetDB.users= async user => {
  let successCount = 0;
  let failureCount = 0;
  let failureLog = '';
  try {
    await go(
      TARGET.QUERY`
        INSERT INTO users ${TARGET.VALUES(user)} RETURNING email
      `,
      ([{ email }]) => {
        log("Insert email : ", email);
        successCount++;
        return email
      }
    );
  } catch (e) {
    go(e, ({ message }) =>
      match(message)
        .case(msg => msg.indexOf("users_email_key") >= 0 || msg.indexOf("users_pkey") >= 0)(msg =>{
          log("already exist email : ", user.email)
          failureLog += `already exist email : ${user.email}\n`
        })
        .else(msg => {
          log("error email : ", user.email, "| message : ", msg)
          failureLog += `error email : ${user.email} | message : ${msg}\n`
        })
    );
    failureCount++;
  }
  return ({
    successCount,
    failureCount,
    failureLog
  });
};

insertTargetDB.campaign = async campaign => {
  let successCount = 0;
  let failureCount = 0;
  let failureLog = '';

  const tempId = campaign.id
  const tempAppliedInfluencers = campaign.applied_influencers
  try {
    delete campaign.applied_influencers
    await go(
      TARGET.QUERY`
        INSERT INTO campaign ${TARGET.VALUES(campaign)} RETURNING id
      `,
      ([{ id }]) => go(
        tempAppliedInfluencers,
        mapC(influencer => TARGET.QUERY`
          UPDATE campaign SET applied_influencers = applied_influencers || ${influencer} WHERE id = ${id}
        `),
        _ => id
      ),
      id => {
        log("Insert campaign_id : ", id);
        successCount++;
      }
    );
  } catch (e) {
    go(e, ({ message }) =>
      match(message)
        .else(msg => {
          log("error prod_campaign : ", tempId, "| message : ", msg)
          failureLog += `error prod_campaign : ${tempId} | message : ${msg}\n`
        })
    );
    failureCount++;
  }
  return {
    successCount,
    failureCount,
    failureLog
  };
}

insertTargetDB.event = async event => {
  let successCount = 0;
  let failureCount = 0;
  let failureLog = '';

  const tempId = event.id;
  const tempProvisionCoin = event.provision_coin;
  const tempHistory = event.history;
  try {
    delete event.provision_coin;
    delete event.history;
    await go(
      TARGET.QUERY`
        INSERT INTO event ${TARGET.VALUES(event)} RETURNING id
      `,
      ([{ id }]) => {
        go(
          tempProvisionCoin,
          map(a => TARGET.QUERY`UPDATE event SET provision_coin = provision_coin || ${a} WHERE id = ${id}`)
        )
        go(
          tempHistory,
          map(a => TARGET.QUERY`UPDATE event SET history = history || ${a} WHERE id = ${id}`)
        )
        return id
      },
      id => {
        log("Insert event_id : ", id);
        successCount++;
      }
    )
  } catch (e) {
    go(e, ({ message }) =>
      match(message)
        .else(msg => {
          log("error prod_event : ", tempId, "| message : ", msg)
          failureLog += `error prod_event : ${tempId} | message : ${msg}\n`
        })
    );
    failureCount++;
  }
  return {
    successCount,
    failureCount,
    failureLog
  };
}

insertTargetDB.notice = async notice => {
  let successCount = 0;
  let failureCount = 0;
  let failureLog = '';

  const tempId = notice.id;
  try {
    await go(
      TARGET.QUERY`
        INSERT INTO notice ${TARGET.VALUES(notice)} RETURNING id
      `,
      ([{ id }]) => (log('Insert notice_id : ', id), successCount++)
    )
  } catch (e) {
    go(e, ({ message }) =>
      match(message)
        .else(msg => {
          log("error prod_notice : ", tempId, "| message : ", msg)
          failureLog += `error prod_notice : ${tempId} | message : ${msg}\n`
        })
    );
    failureCount++;
  }
  return {
    successCount,
    failureCount,
    failureLog
  };
}

insertTargetDB.notification = async notification => {
  let successCount = 0;
  let failureCount = 0;
  let failureLog = '';

  const tempId = notification.id;
  try {
    await go(
      TARGET.QUERY`
        INSERT INTO 
          notification(
            content,
            icon,
            property,
            property_value,
            receiver
          )
        VALUES
          (
            ${notification.content},
            ${notification.icon},
            ${notification.property},
            ${notification.property_value},
            TO_JSONB(${notification.receiver}::JSONB[])
          )
        RETURNING id
      `,
      ([{ id }]) => (log('Insert notification_id : ', id), successCount++)
    )
  } catch (e) {
    go(e, ({ message }) =>
      match(message)
        .else(msg => {
          log("error prod_notification : ", tempId, "| message : ", msg)
          failureLog += `error prod_notification : ${tempId} | message : ${msg}\n`
        })
    );
    failureCount++;
  }
  return {
    successCount,
    failureCount,
    failureLog
  };
}

insertTargetDB.revenue_ledger = async revenueLedger => {
  let successCount = 0;
  let failureCount = 0;
  let failureLog = '';

  const tempId = revenueLedger.id;
  try {
    await go(
      TARGET.QUERY`
        INSERT INTO revenue_ledger ${TARGET.VALUES(revenueLedger)} RETURNING id
      `,
      ([{ id }]) => (log('Insert revenueLedger_id : ', id), successCount++)
    )
  } catch (e) {
    go(e, ({ message }) =>
      match(message)
        .else(msg => {
          log("error prod_revenueLedger : ", tempId, "| message : ", msg)
          failureLog += `error prod_revenueLedger : ${tempId} | message : ${msg}\n`
        })
    );
    failureCount++;
  }
  return {
    successCount,
    failureCount,
    failureLog
  };
}

insertTargetDB.posting = async posting => {
  let successCount = 0;
  let failureCount = 0;
  let failureLog = '';

  const tempId = posting.id;
  try {
    await go(
      TARGET.QUERY`
        INSERT INTO 
          posting 
          (
            campaign_id,
            influencer_id,
            view_count,
            user_info,
            media_info,
            sales_info,
            posting_url
          )
        VALUES 
          (
            ${posting.campaign_id},
            ${posting.influencer_id},
            ${posting.view_count},
            ${posting.user_info},
            TO_JSONB(${posting.media_info}::JSONB[]),
            TO_JSONB(${posting.sales_info}::JSONB[]),
            TO_JSONB(${posting.posting_url}::JSONB[])
          )
        RETURNING *
      `,
      ([{ id }]) => (log('Insert posting_id : ', id), successCount++)
    )
  } catch (e) {
    go(e, ({ message }) =>
      match(message)
        .else(msg => {
          log("error prod_posting : ", tempId, "| message : ", msg)
          failureLog += `error prod_posting : ${tempId} | message : ${msg}\n`
        })
    );
    failureCount++;
  }
  return {
    successCount,
    failureCount,
    failureLog
  };
}

insertTargetDB.mission = async mission => {
  let successCount = 0;
  let failureCount = 0;
  let failureLog = '';

  const tempId = mission.id;
  try {
    await go(
      TARGET.QUERY`
        INSERT INTO mission ${TARGET.VALUES(mission)} RETURNING id
      `,
      ([{ id }]) => (log('Insert mission_id : ', id), successCount++)
    )
  } catch (e) {
    go(e, ({ message }) =>
      match(message)
        .else(msg => {
          log("error prod_mission : ", tempId, "| message : ", msg)
          failureLog += `error prod_mission : ${tempId} | message : ${msg}\n`
        })
    );
    failureCount++;
  }
  return {
    successCount,
    failureCount,
    failureLog
  };
}

/** --------------------------------@name SYNC_FUNCTION ------------------------------------------ */

const cognitoSyncUserTable = async _ => {
  let totalCognitoUserCount = 0;
  let createCount = 0;
  let deleteCount = 0;
  let failureCount = 0;
  let failureLog = '';

  const cognitoUserList = await getUsersInCognito()
  await go(
    TARGET.QUERY`
      SELECT 
        email,
        user_info->>'name' AS name,
        user_info->>'nickname' AS nickname 
      FROM 
        users
    `,
    tap(list => { totalCognitoUserCount = list.length }),
    map(({ email, name, nickname }) => go(
      cognitoUserList,
      match
        // table 에만 존재하는 email 생성
        .case(list => !list.some(({ email: cognitoEmail }) => cognitoEmail === email))(
          async _ => {
            await delay(_ => {
              try {
                go(
                  createCognitoUser({
                    email,
                    name,
                    nickname
                  }).catch(e =>{
                    failureCount++
                    failureLog += e.message || e
                  }),
                  tap(({ User }) => (log(`Create user email: ${pickCognitoUserAttributes(['email'], User).email}`), createCount++))
                )
              } catch (e) {
                failureCount++
                failureLog += e.message || e
              }
            })
          }
        )
        // 둘다 존재하는 email cognito email list 에서 제거
        .else(list => go(
          list,
          find(({ email: cognitoEmail }) => cognitoEmail === email),
          overlapUser => pop(overlapUser, list)
        ))
    )),
    // 둘다 존재하는 email 이 사라져서 cognito 에만 존재하는 email 만 남음 -> 삭제
    tap(_ => go(
      cognitoUserList,
      map(user => {
        try {
          deleteCount++
          log(`Delete user email : ${user.email}`)
          return deleteCognitoUser(user.sub)
        } catch (e) {
          failureCount++
          failureLog += e.message || e
        }
      })
    ))
  )
  return `@name : Sync Congito user & User table\n@result\n  - totalCognitoUserCount : ${totalCognitoUserCount}\n  - createCount : ${createCount}\n  - deleteCount : ${deleteCount}\n  - failureCount : ${failureCount}\n@failureLog \n${failureLog}`
}

/** --------------------------------@name MIGRATION_FUNCTION ------------------------------------------ */

const userMigration = _ => go(
  PROD.QUERY`SELECT * FROM users`,
  migration('users')
)

const campaignMigration = _ => go(
  PROD.QUERY`SELECT * FROM campaign`,
  migration('campaign')
)

const eventMigration = _ => go(
  PROD.QUERY`SELECT * FROM event`,
  migration('event')
)

const noticeMigration = _ => go(
  PROD.QUERY`SELECT * FROM notice`,
  migration('notice')
)

const notificationMigration = _ => go(
  PROD.QUERY`SELECT * FROM notification`,
  migration('notification')
)

const revenueLedgerMigration = _ => go(
  PROD.QUERY`SELECT * FROM revenue_ledger`,
  migration('revenue_ledger')
)

const postingMigration = _ => go(
  PROD.QUERY`SELECT * FROM posting`,
  migration('posting')
)

const missionMigration = _ => go(
  PROD.QUERY`SELECT * FROM mission`,
  migration('mission')
)

/** --------------------------------@name EXCUTE_FUNCTION ------------------------------------------ */

// excute function
const excuteFunction = async _ => {
  Promise.all([
    userMigration(),
    campaignMigration(),
    eventMigration(),
    noticeMigration(),
    notificationMigration(),
    revenueLedgerMigration(),
    postingMigration(),
    missionMigration()
  ]).then(async values => {
    try{
      values.push(await cognitoSyncUserTable())
      await writeLogFile(`Migration ${prodStage} to ${targetStage}. (${new Date().toString()})\n\n${values.join('\n')}`)
    } catch (e) {
      match(e)
        .case(({ message }) => message === 'file write error')(
          err => {
            log('파일 작성 오류')
            log(err.body)
          }
        )
        .else (err => log(err))
    } 
  });
}

excuteFunction();