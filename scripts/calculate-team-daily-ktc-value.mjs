import debug from 'debug'
import dayjs from 'dayjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import {
  keeptradecut_metric_types,
  transaction_types,
  transaction_type_display_names
} from '#constants'
import {
  is_main,
  get_trades,
  get_restricted_free_agency_signings,
  batch_insert,
  report_job
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('calculate-team-daily-ktc-value')
debug.enable('calculate-team-daily-ktc-value')

const max_day_interval = 5

const calculate_team_daily_ktc_value = async ({ lid = 1 }) => {
  log(`calculating team daily ktc value for league ${lid}`)

  const teams_index = {}
  const trades = await get_trades({ lid })
  const transactions = await db('transactions')
    .select('tid', 'pid', 'pid', 'type', 'timestamp', 'year')
    .where('lid', lid)
    .orderBy('timestamp', 'asc')

  const restricted_free_agency_signings =
    await get_restricted_free_agency_signings({ lid })
  const restricted_free_agency_index = {}
  for (const restricted_free_agency_signing of restricted_free_agency_signings) {
    const rfa_sign_key = `${restricted_free_agency_signing.pid}__${restricted_free_agency_signing.date}`
    restricted_free_agency_index[rfa_sign_key] = restricted_free_agency_signing
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
    .select(db.raw("pid, TO_CHAR(TO_TIMESTAMP(d), 'YYYY-MM-DD') AS date, v"))
    .whereIn('pid', transaction_pids)
    .where('qb', 2) // choose based on league settings
    .where('type', keeptradecut_metric_types.VALUE)
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
  let current_year = null

  log(`processing ${transactions.length} transactions`)

  // calculate team daily keeptradecut value based on end of day roster's total keeptradecut value
  for (let i = 0; i < transactions.length; i++) {
    if (!current_year || current_year !== transactions[i].year) {
      current_year = transactions[i].year

      log(`updating teams index for year ${current_year}`)

      const teams = await db('teams')
        .select('uid')
        .where({ lid, year: current_year })

      // add any new teams to team index
      for (const team of teams) {
        if (teams_index[team.uid]) continue

        teams_index[team.uid] = {
          ...team,
          players: {},
          picks: {}
        }
      }

      // remove any decommissioned teams from team index
      for (const team_id of Object.keys(teams_index)) {
        const tid = Number(team_id)
        if (teams.find((t) => t.uid === tid)) continue

        delete teams_index[team_id]
      }
    }

    const transaction = transactions[i]

    const tran_date = dayjs.unix(transaction.timestamp).format('YYYY-MM-DD')
    const tran_tid = transaction.tid
    // update team roster based on transaction type
    switch (transaction.type) {
      case transaction_types.ROSTER_ADD:
      case transaction_types.AUCTION_PROCESSED:
      case transaction_types.PRACTICE_ADD:
      case transaction_types.DRAFT:
      case transaction_types.POACHED:
        // add player to roster
        teams_index[tran_tid].players[transaction.pid] = true
        break

      case transaction_types.RESTRICTED_FREE_AGENCY_TAG: {
        const rfa_sign_key = `${transaction.pid}__${tran_date}`
        const restricted_free_agency_signing =
          restricted_free_agency_index[rfa_sign_key]
        if (!restricted_free_agency_signing) {
          throw new Error(
            `no restricted free agency signing found for ${rfa_sign_key}`
          )
        }

        const winning_tid = restricted_free_agency_signing.tid
        const losing_tid = restricted_free_agency_signing.player_tid
        if (winning_tid !== losing_tid) {
          // remove player from losing team
          delete teams_index[losing_tid].players[transaction.pid]

          // add player to winning team
          teams_index[winning_tid].players[transaction.pid] = true
        }
        break
      }

      case transaction_types.ROSTER_RELEASE:
        // remove player from roster
        // team index may not exist for a decommissioning release if team was decommissioned
        delete teams_index[tran_tid]?.players[transaction.pid]
        break

      default:
        // do nothing
        ignored_tran_types.add(transaction_type_display_names[transaction.type])
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
      const day_inserts = []
      let day_ktc_total = 0
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

        day_ktc_total += team_ktc_value
        day_inserts.push({
          lid,
          tid: team.uid,
          date: last_date,
          timestamp: dayjs(last_date).valueOf(),
          ktc_value: team_ktc_value
        })
      }

      for (const insert of day_inserts) {
        insert.ktc_share = insert.ktc_value / day_ktc_total
        team_daily_value_inserts.push(insert)
      }
    }

    // check if next tran date is larger than the max interval
    const next_tran_date = dayjs.unix(transactions[i + 1]?.timestamp)
    if (next_tran_date.diff(transaction.timestamp, 'day') > max_day_interval) {
      // calculate team daily keeptradecut value for days in between based on max_day_interval
      let cursor_date = dayjs
        .unix(transaction.timestamp)
        .add(max_day_interval, 'day')
      while (cursor_date < next_tran_date) {
        const formatted_date = cursor_date.format('YYYY-MM-DD')
        const day_inserts = []
        let day_ktc_total = 0

        for (const team of Object.values(teams_index)) {
          const team_players = Object.keys(team.players)
          const team_players_ktc_value = team_players.reduce((acc, pid) => {
            const ktc_player = keeptradecut_index[pid]
            const ktc_value = ktc_player ? ktc_player[formatted_date] : null
            return acc + (ktc_value || 0)
          }, 0)

          // calculate keeptradecut value for team
          const team_ktc_value = team_players_ktc_value // + team_picks_ktc_value

          if (team_ktc_value === 0) {
            // TOOD figure out why
            continue
          }

          day_ktc_total += team_ktc_value
          day_inserts.push({
            lid,
            tid: team.uid,
            date: formatted_date,
            timestamp: cursor_date.valueOf(),
            ktc_value: team_ktc_value
          })
        }

        for (const insert of day_inserts) {
          insert.ktc_share = insert.ktc_value / day_ktc_total
          team_daily_value_inserts.push(insert)
        }

        cursor_date = cursor_date.add(max_day_interval, 'day')
      }
    }

    last_date = tran_date
  }

  // Check if the gap between the last transaction and the present day is larger than the max interval
  const present_date = dayjs()
  if (
    last_date &&
    present_date.diff(dayjs(last_date), 'day') > max_day_interval
  ) {
    // calculate team daily keeptradecut value for days in between based on max_day_interval
    let cursor_date = dayjs(last_date).add(max_day_interval, 'day')
    while (cursor_date < present_date) {
      const formatted_date = cursor_date.format('YYYY-MM-DD')
      const day_inserts = []
      let day_ktc_total = 0

      for (const team of Object.values(teams_index)) {
        const team_players = Object.keys(team.players)
        const team_players_ktc_value = team_players.reduce((acc, pid) => {
          const ktc_player = keeptradecut_index[pid]
          const ktc_value = ktc_player ? ktc_player[formatted_date] : null
          return acc + (ktc_value || 0)
        }, 0)

        // calculate keeptradecut value for team
        const team_ktc_value = team_players_ktc_value // + team_picks_ktc_value

        if (team_ktc_value === 0) {
          // TOOD figure out why
          continue
        }

        day_ktc_total += team_ktc_value
        day_inserts.push({
          lid,
          tid: team.uid,
          date: formatted_date,
          timestamp: cursor_date.valueOf(),
          ktc_value: team_ktc_value
        })
      }

      for (const insert of day_inserts) {
        insert.ktc_share = insert.ktc_value / day_ktc_total
        team_daily_value_inserts.push(insert)
      }

      cursor_date = cursor_date.add(max_day_interval, 'day')
    }
  }

  log(`ignored ${ignored_tran_types.size} transaction types`)
  log(ignored_tran_types)

  const unique_team_daily_value_inserts = Array.from(
    new Map(
      team_daily_value_inserts.map((item) => [
        `${item.lid}_${item.tid}_${item.date}`,
        item
      ])
    ).values()
  )

  if (unique_team_daily_value_inserts.length) {
    await batch_insert({
      items: unique_team_daily_value_inserts,
      save: (items) =>
        db('league_team_daily_values')
          .insert(items)
          .onConflict(['lid', 'tid', 'date'])
          .merge(),
      batch_size: 5000
    })
  }
  log(`inserted ${unique_team_daily_value_inserts.length} team daily values`)
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    if (argv.lid) {
      await calculate_team_daily_ktc_value({ lid: argv.lid })
    } else {
      // get all hosted leagues that are not archived
      const leagues = await db('leagues')
        .select('uid')
        .where({ hosted: 1 })
        .whereNull('archived_at')

      for (const league of leagues) {
        await calculate_team_daily_ktc_value({ lid: league.uid })
      }
    }
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.CALCULATE_TEAM_DAILY_KTC_VALUE,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default calculate_team_daily_ktc_value
