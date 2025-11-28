import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { Roster, getExtensionAmount } from '#libs-shared'
import { current_season, player_tag_types, transaction_types } from '#constants'
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

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('process-extensions')
debug.enable('process-extensions')

const getTransactionType = (tag) => {
  switch (tag) {
    case player_tag_types.FRANCHISE:
      return transaction_types.FRANCHISE_TAG
    case player_tag_types.ROOKIE:
      return transaction_types.ROOKIE_TAG
    case player_tag_types.REGULAR:
    case player_tag_types.RESTRICTED_FREE_AGENCY:
      return transaction_types.EXTENSION
  }
}

const createTransaction = async ({ roster_player, tid, league }) => {
  const { tag, pid, pos } = roster_player

  // Skip creating franchise tag transactions for players who already had franchise tags for two consecutive years
  if (tag === player_tag_types.FRANCHISE) {
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
      tag === player_tag_types.RESTRICTED_FREE_AGENCY
        ? player_tag_types.REGULAR
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
    week: current_season.week,
    year: current_season.year,
    timestamp: league.ext_date
  }
}

const run = async ({ lid }) => {
  const league = await getLeague({ lid })
  const teams = await db('teams').where({ lid, year: current_season.year })
  await db('transactions')
    .where({
      userid: 0,
      lid,
      year: current_season.year
    })
    .whereIn('type', [
      transaction_types.FRANCHISE_TAG,
      transaction_types.ROOKIE_TAG,
      transaction_types.EXTENSION
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
    const argv = initialize_cli()
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
