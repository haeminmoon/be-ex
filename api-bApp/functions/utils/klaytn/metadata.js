Object.assign(global, require('ffp-js'))

const GenericCaver = require('generic-caver')
const { CONTRACT } = GenericCaver(process.env.KLAYTN_HOST)

// Metadata reading utils
const deployedFileReader = (contractName) => require(`./deployed/${process.env.STAGE}/${contractName}.json`)

/**
 * @description file read of fileName and return to abi, address
 * @param { String } fileName
 * @return [abi, address]
 */
const getFileData = fileName => go(
  fileName, 
  deployedFileReader, 
  a => [a.abi, a.address]
)

const METADATA = {}

METADATA.Campaign = CONTRACT.get(...getFileData('Campaign'))
METADATA.RevenueLedger = CONTRACT.get(...getFileData('RevenueLedger'))
METADATA.ReferralLedger = CONTRACT.get(...getFileData('ReferralLedger'))
METADATA.Product = CONTRACT.get(...getFileData('Product'))
METADATA.Event = CONTRACT.get(...getFileData('Event'))
METADATA.AuthStorage = CONTRACT.get(...getFileData('AuthStorage'))

module.exports = {
  METADATA
}

