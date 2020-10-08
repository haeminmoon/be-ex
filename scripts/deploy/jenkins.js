Object.assign(global, require("ffp-js"))
const shell = require('shelljs')

let processStatus = 0

const getGitDiffPreviousCommit = _ => {
  return new Promise((res, rej) => {
    log(`git diff --name-only ${process.env.GIT_PREVIOUS_COMMIT} ${process.env.GIT_COMMIT}`)
    log('======= 바뀐 파일 목록 =======')
    // jenkins 환경변수 : $GIT_PREVIOUS_COMMIT AND $GIT_COMMIT 
    // * local test : HEAD^ *
    shell.exec(`git diff --name-only ${process.env.GIT_PREVIOUS_COMMIT} ${process.env.GIT_COMMIT}`, (code, stdout, stderr) => {
      if (code != 0) {
        rej({message: 'error git diff', stderr})
      }
      res(stdout)
    })
  })
}

const deduplication = list => {
  const set = new Set()
  for (const iter of list) {
    set.add(iter)
  }
  return [...set]
}

const multiConcat = (...list) => {
  const arr = []
  for (const iter of list) {
    if (iter.length > 0) arr.push(...iter)
  }
  return arr
}

const parsePath = (f, list) => go(
  list,
  filter(f),
  map(b => b.split('/')[0]),
  deduplication
)

const deployShell = list => go(
  list,
  map(path => {
    return shell.exec(`STAGE=${process.env.STAGE || 'dev'} npm run deploy-${path}`)
  })
)

const errorLogger = results => go(
  results,
  filter(({ code }) => code !== 0),
  map(({ stderr }) => stderr),
  tap(a => {
    if (a.length > 0) {
      log('======= error list =======')
      log(a.join('\n--------------------------\n'))
      log('==========================')
      processStatus = 1
    }
  })
)

const exit = _ => process.exit(processStatus)

const excuteFunction = async _ => {
  try {
    const diffFile = await getGitDiffPreviousCommit()
    const diffList = go(
      diffFile,
      a => a.split('\n'),
      filter(b => !!b)
    )
    go(
      multiConcat( 
        parsePath(a => a.includes('api-'), diffList), 
        parsePath(a => a.includes('resource-'), diffList)
      ),
      deployShell,
      tap(errorLogger),
      exit
    )
  } catch (e) {
    log('========= error ==========')
    match(e)
      .case(({ message }) => message === 'error git diff')(
        e => {
          log('git diff 오류')
          log(`오류 Commit : ${process.env.GIT_PREVIOUS_COMMIT} ~ ${process.env.GIT_COMMIT}`)
          log(e.stderr)
        }
      )
      .else(e => {
        log('오류 메세지 : ', e.message)
        log(e)
      })
    log('==========================')
    processStatus = 1
    exit()
  }
}

excuteFunction()
