/**
 * @description : This util functions for solving deadlock issue in tx pool when using 'sendTransaction'
 * @concept : No preemption blocking
 */

Object.assign(global, require('ffp-js'));
const { REDIS } = require('/opt/libs/redis-lib');

const PREVENTOR = {};

PREVENTOR.initAccounts = async accounts => {
  const isInit = await go(
    accounts, 
    head, 
    account => account.address, 
    REDIS.get
  );
  
  return (isInit)
    ? true
    : go(
      accounts, 
      mapC(a => REDIS.set(a.address, 'true'))
    );
}

PREVENTOR.availableAccount = accounts => go(
  accounts,
  mapC(async a => ({
    key: a.address,
    value: await REDIS.get(a.address)
  })),
  find(a => a.value == 'true')
);

PREVENTOR.lock = target => (REDIS.set(target.key, 'false'), target);
PREVENTOR.unlock = target => (REDIS.set(target.key, 'true'), target);

module.exports = {
  PREVENTOR
}