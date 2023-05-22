import debug from 'debug'
import dayjs from 'dayjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#common'
import {
  isMain,
  get_trades,
  get_transition_signings,
  batch_insert
} from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('calculate-team-daily-ktc-value')
debug.enable('calculate-team-daily-ktc-value')

const calculate_team_daily_ktc_value = async ({ lid = 1 }) => {
  const teams = await db('teams')
    .select('uid')
    .where({ lid, year: constants.season.year })

  if (!teams.length) {
    throw new Error(`no teams found for league ${lid}`)
  }

  const teams_index = {}
  for (const team of teams) {
    teams_index[team.uid] = {
      ...team,
      players: {},
      picks: {}
    }
  }

  const trades = await get_trades({ lid })
  const transactions = await db('transactions')
    .select('tid', 'pid', 'pid', 'type', 'timestamp')
    .where('lid', lid)
    .orderBy('timestamp', 'asc')

  const transition_signings = await get_transition_signings({ lid })
  const transition_index = {}
  for (const tran of transition_signings) {
    const tran_sign_key = `${tran.pid}__${tran.date}`
    transition_index[tran_sign_key] = tran
  }

  const transaction_pids = Array.from(new Set(transactions.map((t) => t.pid)))

  log('building trades index')
  const trades_index = {}
  for (const trade of trades) {
    for (const tran of trade.transactions) {
      trades_index[tran.transactionid] = trade
    }
  }

  log('building keeptradecut index')
  const keeptradecut_index = {}
  const ktc_values = await db('keeptradecut_rankings')
    .select(db.raw('pid, DATE_FORMAT(FROM_UNIXTIME(d), "%Y-%m-%d") AS date, v'))
    .whereIn('pid', transaction_pids)
    .where('qb', 2) // choose based on league settings
    .where('type', constants.KEEPTRADECUT.VALUE)
    .orderBy('d', 'asc')

  for (const ktc_value of ktc_values) {
    if (!keeptradecut_index[ktc_value.pid]) {
      keeptradecut_index[ktc_value.pid] = {}
    }
    keeptradecut_index[ktc_value.pid][ktc_value.date] = ktc_value.v
  }

  const team_daily_value_inserts = []
  const processed_trades_index = {}
  const ignored_tran_types = new Set()
  let last_date = null

  log(`processing ${transactions.length} transactions`)

  // calculate team daily keeptradecut value based on end of day roster's total keeptradecut value
  for (const transaction of transactions) {
    const tran_date = dayjs.unix(transaction.timestamp).format('YYYY-MM-DD')
    const tran_tid = transaction.tid
    // update team roster based on transaction type
    switch (transaction.type) {
      case constants.transactions.ROSTER_ADD:
      case constants.transactions.AUCTION_PROCESSED:
      case constants.transactions.PRACTICE_ADD:
      case constants.transactions.DRAFT:
      case constants.transactions.POACHED:
        // add player to roster
        teams_index[tran_tid].players[transaction.pid] = true
        break

      case constants.transactions.TRANSITION_TAG: {
        const tran_sign_key = `${transaction.pid}__${tran_date}`
        const tran_signing = transition_index[tran_sign_key]
        if (!tran_signing) {
          throw new Error(`no transition signing found for ${tran_sign_key}`)
        }

        const winning_tid = tran_signing.tid
        const losing_tid = tran_signing.player_tid
        if (winning_tid !== losing_tid) {
          // remove player from losing team
          delete teams_index[losing_tid].players[transaction.pid]

          // add player to winning team
          teams_index[winning_tid].players[transaction.pid] = true
        }
        break
      }

      case constants.transactions.ROSTER_RELEASE:
        // remove player from roster
        delete teams_index[tran_tid].players[transaction.pid]
        break

      default:
        // do nothing
        ignored_tran_types.add(constants.transactionsDetail[transaction.type])
    }

    // check if transaction is part of a trade
    const trade = trades_index[transaction.uid]
    if (trade && !processed_trades_index[trade.uid]) {
      // process players
      for (const player of trade.players) {
        const old_team_id = player.tid
        const new_team_id =
          trade.propose_tid === old_team_id
            ? trade.accept_tid
            : trade.propose_tid

        // remove player from old_team_id
        delete teams_index[old_team_id].players[player.pid]

        // add player to new_team_id
        teams_index[new_team_id].players[player.pid] = true
      }

      // process picks
      for (const pick of trade.picks) {
        const old_team_id = pick.tid
        const new_team_id =
          trade.propose_tid === old_team_id
            ? trade.accept_tid
            : trade.propose_tid

        // remove pick from old_team_id
        delete teams_index[old_team_id].picks[pick.pickid]

        // add pick to new_team_id
        teams_index[new_team_id].picks[pick.pickid] = true
      }

      processed_trades_index[trade.uid] = true
    }

    // check if new day
    if (last_date && tran_date !== last_date) {
      // calculate team daily keeptradecut value for last_date
      for (const team of Object.values(teams_index)) {
        // calculate keeptradecut value for team_players
        const team_players = Object.keys(team.players)
        const team_players_ktc_value = team_players.reduce((acc, pid) => {
          const ktc_player = keeptradecut_index[pid]
          const ktc_value = ktc_player ? ktc_player[last_date] : null
          return acc + (ktc_value || 0)
        }, 0)

        // TODO
        // calculate keeptradecut value for team_picks
        // const team_picks = Object.keys(team.picks)
        // const team_picks_ktc_value = team_picks.reduce((acc, pickid) => {
        //   const pick = picks_index[pickid]
        //   const ktc_value = keeptradecut_index[pick.pid][last_date]
        //   return acc + (ktc_value || 0)
        // }, 0)

        // calculate keeptradecut value for team
        const team_ktc_value = team_players_ktc_value // + team_picks_ktc_value

        if (team_ktc_value === 0) {
          // TOOD figure out why
          continue
        }

        team_daily_value_inserts.push({
          lid,
          tid: team.uid,
          date: last_date,
          ktc_value: team_ktc_value
        })
      }
    }

    last_date = tran_date
  }

  log(`ignored ${ignored_tran_types.size} transaction types`)
  log(ignored_tran_types)

  if (team_daily_value_inserts.length) {
    await batch_insert({
      items: team_daily_value_inserts,
      save: (items) =>
        db('league_team_daily_values')
          .insert(items)
          .onConflict(['lid', 'tid', 'date'])
          .merge(),
      batch_size: 5000
    })

    log(`inserted ${team_daily_value_inserts.length} team daily values`)
  }
}

const main = async () => {
  let error
  try {
    await calculate_team_daily_ktc_value({ lid: argv.lid })
  } catch (err) {
    error = err
    log(error)
  }

  // await db('jobs').insert({
  //   type: constants.jobs.EXAMPLE,
  //   succ: error ? 0 : 1,
  //   reason: error ? error.message : null,
  //   timestamp: Math.round(Date.now() / 1000)
  // })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default calculate_team_daily_ktc_value
