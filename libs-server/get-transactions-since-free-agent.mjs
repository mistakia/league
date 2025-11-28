import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { transaction_types } from '#constants'
import db from '#db'

import is_main from './is-main.mjs'

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
    transaction_types.ROSTER_ADD,
    transaction_types.AUCTION_PROCESSED,
    transaction_types.PRACTICE_ADD
  ]
  if (include_restricted)
    types.push(transaction_types.RESTRICTED_FREE_AGENCY_TAG)
  const index = transactions.findIndex((t) => types.includes(t.type))
  if (index === -1) return transactions
  return transactions.slice(0, index + 1)
}

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .option('lid', {
      describe: 'League ID',
      type: 'number',
      demandOption: true
    })
    .option('pid', {
      describe: 'Player ID',
      type: 'string',
      demandOption: true
    })
    .help().argv
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
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

if (is_main(import.meta.url)) {
  main()
}

export default getTransactionsSinceFreeAgent
