import debug from 'debug'
import dayjs from 'dayjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { transaction_types, transaction_type_display_names } from '#constants'
import {
  is_main,
  get_trades,
  get_restricted_free_agency_signings,
  batch_insert,
  report_job,
  throw_if_shortfall
} from '#libs-server'
import { derive_league_format_is_superflex } from '#libs-server/derive-league-format-is-superflex.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('calculate-team-daily-ktc-value')
debug.enable('calculate-team-daily-ktc-value')

const max_day_interval = 5

// A missing keeptradecut observation inside a player's ranked span is a gap in
// an otherwise daily series, so the last known value is the honest estimate.
// Measured on league 1: 1,271 of 1,370 series gaps are 7 days or shorter, while
// the long tail runs to 921 days -- those are players who left the ranked
// universe and returned, where carrying a stale value forward would be a
// fabrication. Seven days is one publication week and separates the two.
const max_ktc_carry_forward_days = 7

// A day whose rosters resolve to fewer than half their players is not a roster
// composed of unranked players -- it is a missing or partial keeptradecut
// import. The worst day in league 1's full history is 58% (2021-08-10), so this
// floor does not fire on any historical day.
const min_day_coverage = 0.5

// This script recomputes every day of history on every run, so an unscoped
// coverage assertion would fire forever on a day that can no longer be
// repaired. Only days recent enough for an operator to act on are asserted.
const recent_coverage_window_days = 30

const to_day_number = (date) =>
  Math.round(Date.parse(`${date}T00:00:00Z`) / 86400000)

const build_keeptradecut_index = (ktc_values) => {
  // ktc_values arrives ordered by observed_at ascending, so each player's date
  // list is built in sorted order and stays binary-searchable.
  const keeptradecut_index = {}
  for (const ktc_value of ktc_values) {
    let player = keeptradecut_index[ktc_value.pid]
    if (!player) {
      player = { values: {}, dates: [] }
      keeptradecut_index[ktc_value.pid] = player
    }
    if (player.values[ktc_value.date] === undefined) {
      player.dates.push(ktc_value.date)
    }
    player.values[ktc_value.date] = ktc_value.keeptradecut_value
  }
  return keeptradecut_index
}

// Returns the player's keeptradecut value on `date`, or null when keeptradecut
// does not rank the player on that date.
//
// Null is not zero-with-a-different-name, but for this calculation it is: a
// player keeptradecut does not rank contributes nothing to a team's dynasty
// trade value, which is the quantity being summed. Measured across league 1's
// full history (311,413 player-day lookups), 87.2% resolve to an observation
// and 12.6% are players keeptradecut does not rank on that date -- kickers,
// defenses, deep bench, plus players not yet ranked or no longer ranked. The
// remaining 0.14% were interior gaps in a continuous series, and those are the
// ones this function fills rather than reporting as absent.
const get_keeptradecut_value = ({ keeptradecut_index, pid, date }) => {
  const player = keeptradecut_index[pid]
  if (!player) return null

  const observed_value = player.values[date]
  if (observed_value !== undefined) return observed_value

  // index of the first observation strictly after `date`
  const dates = player.dates
  let low = 0
  let high = dates.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (dates[mid] <= date) low = mid + 1
    else high = mid
  }

  // No later observation. Either the player has left the ranked universe, or
  // the day's import has not run yet -- neither is a gap to interpolate across,
  // and treating the second as one would hide a failed import behind yesterday's
  // numbers.
  if (low === dates.length) return null

  // Not yet ranked as of `date`.
  if (low === 0) return null

  const previous_date = dates[low - 1]
  if (
    to_day_number(date) - to_day_number(previous_date) >
    max_ktc_carry_forward_days
  ) {
    return null
  }

  return player.values[previous_date]
}

const get_team = ({ teams_index, tid, transaction, site }) => {
  const team = teams_index[tid]
  if (!team) {
    throw new Error(
      `team ${tid} absent from league index while applying ${site} for transaction ${transaction.uid} (type ${transaction.type}, ${dayjs.unix(transaction.timestamp).format('YYYY-MM-DD')})`
    )
  }
  return team
}

// Builds one day's rows for every team in the index. Returns the rows plus the
// day's coverage so the caller can tell a day computed from a full population
// apart from one computed from a partial import.
const build_day_inserts = ({
  lid,
  teams_index,
  keeptradecut_index,
  date,
  timestamp
}) => {
  const day_inserts = []
  let day_ktc_total = 0
  let roster_player_count = 0
  let valued_player_count = 0

  for (const team of Object.values(teams_index)) {
    // Picks are tracked on the team index but keeptradecut pick valuations are
    // not imported, so they contribute nothing to the total yet.
    let team_ktc_value = 0
    for (const pid of Object.keys(team.players)) {
      roster_player_count += 1
      const ktc_value = get_keeptradecut_value({
        keeptradecut_index,
        pid,
        date
      })
      if (ktc_value === null) continue

      valued_player_count += 1
      team_ktc_value += ktc_value
    }

    day_ktc_total += team_ktc_value
    day_inserts.push({
      lid,
      tid: team.uid,
      date,
      timestamp,
      ktc_value: team_ktc_value
    })
  }

  const coverage = {
    date,
    roster_player_count,
    valued_player_count,
    day_ktc_total
  }

  // Every team sits at zero, so there is no denominator and no share can be
  // computed. Measured on league 1 this is the 2020 league-inception window,
  // where rosters were still empty; the other way to reach it is a keeptradecut
  // import that produced nothing, which the coverage assertion below reports.
  if (day_ktc_total === 0) {
    return { day_inserts: [], coverage }
  }

  for (const insert of day_inserts) {
    insert.ktc_share = insert.ktc_value / day_ktc_total
  }

  return { day_inserts, coverage }
}

const calculate_team_daily_ktc_value = async ({ lid = 1 }) => {
  log(`calculating team daily ktc value for league ${lid}`)

  // KTC publishes a separate value set per market format class, so the read
  // below must ask for this league's own class. This ran superflex-only for
  // every league until 2026-08-04, which was wrong for every single-QB league
  // it processed -- and the driver at the bottom of this file iterates all of
  // them, so this was live output rather than a latent defect.
  const is_superflex = await derive_league_format_is_superflex({ lid })

  const teams_index = {}
  const trades = await get_trades({ lid })
  const transactions = await db('transactions')
    .select('uid', 'tid', 'pid', 'type', 'timestamp', 'year')
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
  const ktc_values = await db('keeptradecut_valuations')
    .select(
      db.raw(
        "pid, TO_CHAR(observed_at, 'YYYY-MM-DD') AS date, keeptradecut_value"
      )
    )
    .whereIn('pid', transaction_pids)
    .where('is_superflex', is_superflex)
    .orderBy('observed_at', 'asc')

  const keeptradecut_index = build_keeptradecut_index(ktc_values)

  const team_daily_value_inserts = []
  const day_coverage = []
  const processed_trades_index = {}
  const ignored_tran_types = new Set()
  let last_date = null
  let current_year = null

  const emit_day = ({ date, timestamp }) => {
    const { day_inserts, coverage } = build_day_inserts({
      lid,
      teams_index,
      keeptradecut_index,
      date,
      timestamp
    })
    day_coverage.push(coverage)
    for (const insert of day_inserts) {
      team_daily_value_inserts.push(insert)
    }
  }

  log(`processing ${transactions.length} transactions`)

  // calculate team daily keeptradecut value based on end of day roster's total keeptradecut value
  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i]
    const tran_date = dayjs.unix(transaction.timestamp).format('YYYY-MM-DD')

    // Emit the previous day before anything from this one is applied. The value
    // being recorded is the END of last_date's roster, so applying the first
    // transaction of the following day first — or letting the year rollover
    // below decommission a team — would fold the next day's state into it.
    if (last_date && tran_date !== last_date) {
      emit_day({ date: last_date, timestamp: dayjs(last_date).valueOf() })
    }

    if (!current_year || current_year !== transaction.year) {
      current_year = transaction.year

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

    const tran_tid = transaction.tid
    // update team roster based on transaction type
    switch (transaction.type) {
      case transaction_types.ROSTER_ADD:
      case transaction_types.AUCTION_PROCESSED:
      case transaction_types.PRACTICE_ADD:
      case transaction_types.DRAFT:
      case transaction_types.POACHED:
        // add player to roster
        get_team({
          teams_index,
          tid: tran_tid,
          transaction,
          site: 'roster add'
        }).players[transaction.pid] = true
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
        const losing_tid = restricted_free_agency_signing.original_team_id
        if (winning_tid !== losing_tid) {
          // remove player from losing team
          delete get_team({
            teams_index,
            tid: losing_tid,
            transaction,
            site: 'restricted free agency losing team'
          }).players[transaction.pid]

          // add player to winning team
          get_team({
            teams_index,
            tid: winning_tid,
            transaction,
            site: 'restricted free agency winning team'
          }).players[transaction.pid] = true
        }
        break
      }

      case transaction_types.ROSTER_RELEASE: {
        // A decommissioned team's roster is released after the team has left
        // that season's `teams` rows, so its index entry is legitimately gone by
        // the time the release replays. This is the one site where an absent
        // team is expected: measured across league 1's full history, all 53
        // absent-team events are releases and all belong to the single
        // decommissioned team. Every other site throws.
        const releasing_team = teams_index[tran_tid]
        if (releasing_team) {
          delete releasing_team.players[transaction.pid]
        }
        break
      }

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
        delete get_team({
          teams_index,
          tid: old_team_id,
          transaction,
          site: 'trade player origin'
        }).players[player.pid]

        // add player to new_team_id
        get_team({
          teams_index,
          tid: new_team_id,
          transaction,
          site: 'trade player destination'
        }).players[player.pid] = true
      }

      // process picks
      for (const pick of trade.picks) {
        const old_team_id = pick.tid
        const new_team_id =
          trade.propose_tid === old_team_id
            ? trade.accept_tid
            : trade.propose_tid

        // remove pick from old_team_id
        delete get_team({
          teams_index,
          tid: old_team_id,
          transaction,
          site: 'trade pick origin'
        }).picks[pick.pickid]

        // add pick to new_team_id
        get_team({
          teams_index,
          tid: new_team_id,
          transaction,
          site: 'trade pick destination'
        }).picks[pick.pickid] = true
      }

      processed_trades_index[trade.uid] = true
    }

    // check if next tran date is larger than the max interval
    const next_tran_date = dayjs.unix(transactions[i + 1]?.timestamp)
    if (next_tran_date.diff(transaction.timestamp, 'day') > max_day_interval) {
      // calculate team daily keeptradecut value for days in between based on max_day_interval
      let cursor_date = dayjs
        .unix(transaction.timestamp)
        .add(max_day_interval, 'day')
      while (cursor_date < next_tran_date) {
        emit_day({
          date: cursor_date.format('YYYY-MM-DD'),
          timestamp: cursor_date.valueOf()
        })
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
      emit_day({
        date: cursor_date.format('YYYY-MM-DD'),
        timestamp: cursor_date.valueOf()
      })
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

  const shortfalls = []

  // Coverage oracle: a day is only comparable to its neighbours when it was
  // computed against the same population. `ktc_share` divides by the day's
  // total, so a player missing from one team's numerator is missing from every
  // team's denominator too -- a partial import skews the whole day's shares
  // rather than one team's value.
  const covered_days = day_coverage.filter((day) => day.roster_player_count > 0)
  const partial_days = covered_days.filter(
    (day) => day.valued_player_count < day.roster_player_count
  )
  const empty_days = covered_days.filter((day) => day.day_ktc_total === 0)
  log(
    `keeptradecut coverage: ${covered_days.length} days with rosters, ${partial_days.length} partial, ${empty_days.length} with no valued player`
  )

  const today_day_number = to_day_number(dayjs().format('YYYY-MM-DD'))
  const low_coverage_days = covered_days.filter(
    (day) =>
      day.valued_player_count / day.roster_player_count < min_day_coverage &&
      today_day_number - to_day_number(day.date) <= recent_coverage_window_days
  )
  if (low_coverage_days.length) {
    const detail = low_coverage_days
      .map(
        (day) =>
          `${day.date} ${day.valued_player_count}/${day.roster_player_count}`
      )
      .join(', ')
    shortfalls.push(
      `keeptradecut coverage below ${min_day_coverage} on ${low_coverage_days.length} of the last ${recent_coverage_window_days} days for lid=${lid}: ${detail}`
    )
  }

  // Freshness oracle: after running, max(date) per lid should be within
  // max_day_interval days of today. A stale max(date) means the script ran to
  // completion without advancing the table — silent partial-success.
  const max_date_row = await db('league_team_daily_values')
    .where({ lid })
    .max({ max_date: 'date' })
    .first()
  const max_date = max_date_row?.max_date
  if (!max_date) {
    shortfalls.push(
      `no rows in league_team_daily_values for lid=${lid} after run`
    )
    return { lid, shortfall: shortfalls.join('; ') }
  }
  const stale_days = dayjs().diff(dayjs(max_date), 'day')
  if (stale_days > max_day_interval) {
    shortfalls.push(
      `staleness: max(date)=${max_date} is ${stale_days}d > max_day_interval=${max_day_interval} for lid=${lid}`
    )
  }
  return { lid, shortfall: shortfalls.length ? shortfalls.join('; ') : null }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const shortfalls = []
    if (argv.lid) {
      const result = await calculate_team_daily_ktc_value({ lid: argv.lid })
      if (result?.shortfall) shortfalls.push(result.shortfall)
    } else {
      // get all hosted leagues that are not archived
      const leagues = await db('leagues')
        .select('uid')
        .where({ hosted: 1 })
        .whereNull('archived_at')

      for (const league of leagues) {
        const result = await calculate_team_daily_ktc_value({ lid: league.uid })
        if (result?.shortfall) shortfalls.push(result.shortfall)
      }
    }
    throw_if_shortfall(shortfalls.length > 0 ? shortfalls.join('; ') : null)
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
export {
  build_keeptradecut_index,
  get_keeptradecut_value,
  build_day_inserts,
  max_ktc_carry_forward_days
}
