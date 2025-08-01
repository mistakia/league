import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, Roster, getExtensionAmount } from '#libs-shared'
import {
  getLeague,
  getRoster,
  getPlayerExtensions,
  getLastTransaction,
  report_job,
  is_main,
  validate_franchise_tag
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-extensions')
debug.enable('process-extensions')

const getTransactionType = (tag) => {
  switch (tag) {
    case constants.tags.FRANCHISE:
      return constants.transactions.FRANCHISE_TAG
    case constants.tags.ROOKIE:
      return constants.transactions.ROOKIE_TAG
    case constants.tags.REGULAR:
    case constants.tags.RESTRICTED_FREE_AGENCY:
      return constants.transactions.EXTENSION
  }
}

const createTransaction = async ({ roster_player, tid, league }) => {
  const { tag, pid, pos } = roster_player

  // Skip creating franchise tag transactions for players who already had franchise tags for two consecutive years
  if (tag === constants.tags.FRANCHISE) {
    const is_valid_franchise_tag = await validate_franchise_tag({
      pid,
      tid
    })

    if (!is_valid_franchise_tag) {
      throw new Error(
        'player cannot be franchise tagged for three consecutive years'
      )
    }
  }

  const extensions = await getPlayerExtensions({
    lid: league.uid,
    pid
  })
  const { value } = await getLastTransaction({ pid, tid, lid: league.uid })
  const extensionValue = getExtensionAmount({
    extensions: extensions.length,
    tag:
      tag === constants.tags.RESTRICTED_FREE_AGENCY
        ? constants.tags.REGULAR
        : tag,
    pos,
    league,
    value
  })

  return {
    userid: 0,
    tid,
    lid: league.uid,
    pid,
    type: getTransactionType(tag),
    value: extensionValue,
    week: constants.season.week,
    year: constants.season.year,
    timestamp: league.ext_date
  }
}

const run = async ({ lid }) => {
  const league = await getLeague({ lid })
  const teams = await db('teams').where({ lid, year: constants.season.year })
  await db('transactions')
    .where({
      userid: 0,
      lid,
      year: constants.season.year
    })
    .whereIn('type', [
      constants.transactions.FRANCHISE_TAG,
      constants.transactions.ROOKIE_TAG,
      constants.transactions.EXTENSION
    ])
    .del()

  for (const team of teams) {
    const tid = team.uid
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })
    const transactions = []
    const roster_players = [...roster.active, ...roster.reserve]
    for (const roster_player of roster_players) {
      const transaction = await createTransaction({
        roster_player,
        tid,
        league
      })
      if (transaction) transactions.push(transaction)
    }

    if (transactions.length) {
      log(`creating ${transactions.length} transactions for teamId: ${tid}`)
      await db('transactions').insert(transactions)
    }
  }
}

const main = async () => {
  let error
  try {
    const lid = argv.lid
    if (!lid) {
      console.log('missing --lid')
      return
    }
    await run({ lid })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.PROCESS_EXTENSIONS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
