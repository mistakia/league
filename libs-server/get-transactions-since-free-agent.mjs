import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { constants } from '#libs-shared'
import db from '#db'

import isMain from './is-main.mjs'

const argv = yargs(hideBin(process.argv)).argv

async function getTransactionsSinceFreeAgent({
  lid,
  pid,
  include_restricted = false
}) {
  const transactions = await db('transactions')
    .where({
      lid,
      pid
    })
    .orderBy('timestamp', 'desc')
    .orderBy('uid', 'desc')

  const types = [
    constants.transactions.ROSTER_ADD,
    constants.transactions.AUCTION_PROCESSED,
    constants.transactions.PRACTICE_ADD
  ]
  if (include_restricted) types.push(constants.transactions.TRANSITION_TAG)
  const index = transactions.findIndex((t) => types.includes(t.type))
  if (index === -1) return transactions
  return transactions.slice(0, index + 1)
}

const main = async () => {
  let error
  try {
    const trans = await getTransactionsSinceFreeAgent({
      lid: argv.lid,
      pid: argv.pid
    })
    console.log(trans)
  } catch (err) {
    error = err
    console.log(error)
  }

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default getTransactionsSinceFreeAgent
