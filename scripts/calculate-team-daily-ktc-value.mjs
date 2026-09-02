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
import { build_pick_holding_value_index } from '#libs-server/league-pick-holding-values.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('calculate-team-daily-ktc-value')
enable_debug_namespaces('calculate-team-daily-ktc-value')

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

const remove_player_from_every_roster = ({ teams_index, pid }) => {
  for (const team of Object.values(teams_index)) {
    delete team.players[pid]
  }
}

const get_team = ({ teams_index, tid, transaction, site }) => {
  const team = teams_index[tid]
  if (!team) {
    throw new Error(
      `team ${tid} absent from league index while applying ${site} for transaction ${transaction.transaction_id} (type ${transaction.type}, ${dayjs(transaction.occurred_at).format('YYYY-MM-DD')})`
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
  pick_holding_value_index,
  date,
  observed_at
}) => {
  const day_inserts = []
  let day_ktc_total = 0
  let day_total_value = 0
  let roster_player_count = 0
  let valued_player_count = 0
  let held_pick_count = 0
  let valued_pick_count = 0

  // Pick ownership comes from the roster-asset lineage rather than from the
  // transaction replay below, which sees only the trade legs and so would know
  // nothing about a pick a team has held since it was endowed.
  const pick_values_by_team_id = pick_holding_value_index.get_team_pick_values({
    date
  })

  for (const team of Object.values(teams_index)) {
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

    // A team absent from the map holds no picks that day, which is an ordinary
    // state for a team that has traded them all away.
    const team_picks = pick_values_by_team_id.get(team.team_id)
    const team_pick_value = team_picks ? team_picks.pick_value : 0
    if (team_picks) {
      held_pick_count += team_picks.held_pick_count
      valued_pick_count += team_picks.valued_pick_count
    }

    const team_total_value = team_ktc_value + team_pick_value
    day_ktc_total += team_ktc_value
    day_total_value += team_total_value
    day_inserts.push({
      lid,
      tid: team.team_id,
      date,
      observed_at,
      ktc_value: team_ktc_value,
      pick_value: team_pick_value,
      total_value: team_total_value
    })
  }

  const coverage = {
    date,
    roster_player_count,
    valued_player_count,
    held_pick_count,
    valued_pick_count,
    day_ktc_total,
    day_total_value
  }

  // Every team sits at zero on both halves, so there is no denominator and no
  // share can be computed. Measured on league 1 this is the 2020
  // league-inception window, where rosters were still empty; the other way to
  // reach it is a keeptradecut import that produced nothing, which the coverage
  // assertion below reports.
  if (day_total_value === 0) {
    return { day_inserts: [], coverage }
  }

  for (const insert of day_inserts) {
    // The two shares have different denominators on purpose. ktc_share keeps
    // its existing player-only meaning, which the SPA's team-value chart reads;
    // total_share is the one that prices a pick-rich team correctly. A day can
    // carry pick value before any player is ranked, and dividing by a zero
    // player total would write NaN into every row.
    insert.ktc_share =
      day_ktc_total === 0 ? null : insert.ktc_value / day_ktc_total
    insert.total_share = insert.total_value / day_total_value
  }

  return { day_inserts, coverage }
}

const calculate_team_daily_ktc_value = async ({ lid = 1 }) => {
  log(`calculating team daily ktc value for league ${lid}`)

  // KTC publishes a separate value set per market format class, so the read
  // below must ask for this league's own class. This ran superflex-only until
  // 2026-08-04, which is wrong for any single-QB league -- and the driver at
  // the bottom of this file iterates every hosted, non-archived league rather
  // than taking one. Latent so far only because lid 1 is currently the sole
  // such league; 33 of the 116 leagues carrying seasons rows are single-QB.
  const is_superflex = await derive_league_format_is_superflex({ lid })

  log('building pick holding value index')
  const pick_holding_value_index = await build_pick_holding_value_index({
    lid,
    is_superflex
  })

  const teams_index = {}
  const trades = await get_trades({ lid })
  const transactions = await db('transactions')
    .select(
      'transaction_id',
      'tid',
      'pid',
      'type',
      'occurred_at',
      'season_year'
    )
    .where('lid', lid)
    .orderBy('occurred_at', 'asc')

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
      trades_index[tran.transaction_id] = trade
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

  // Keyed by date, and a re-emission REPLACES the whole day rather than merging
  // into it. One date can legitimately be emitted twice in a run: the
  // interpolation loop below walks forward from a transaction and can step onto
  // a day that a later transaction then causes to be emitted again as an
  // end-of-day roster. The second emission is the correct one, because
  // transactions are processed in ascending order, so a date's final emission is
  // always the one taken after every transaction of that date has been applied.
  //
  // Replacing per TEAM instead of per DAY is what produced league 1's only
  // over-100-percent day. On 2023-05-21 the interpolated emission ran against
  // the 2022 twelve-team index and the end-of-day emission against the 2023
  // ten-team index, so the two decommissioned teams kept their first-emission
  // rows -- computed against a twelve-team denominator -- beside ten rows
  // computed against a ten-team one, and the day's shares summed to 1.15.
  const day_inserts_by_date = new Map()
  const coverage_by_date = new Map()
  const processed_trades_index = {}
  const ignored_tran_types = new Set()
  let last_date = null
  let current_year = null

  const emit_day = ({ date, observed_at }) => {
    const { day_inserts, coverage } = build_day_inserts({
      lid,
      teams_index,
      keeptradecut_index,
      pick_holding_value_index,
      date,
      observed_at
    })
    coverage_by_date.set(date, coverage)
    day_inserts_by_date.set(date, day_inserts)
  }

  log(`processing ${transactions.length} transactions`)

  // calculate team daily keeptradecut value based on end of day roster's total keeptradecut value
  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i]
    const tran_date = dayjs(transaction.occurred_at).format('YYYY-MM-DD')

    // Emit the previous day before anything from this one is applied. The value
    // being recorded is the END of last_date's roster, so applying the first
    // transaction of the following day first — or letting the year rollover
    // below decommission a team — would fold the next day's state into it.
    if (last_date && tran_date !== last_date) {
      emit_day({ date: last_date, observed_at: dayjs(last_date).toDate() })
    }

    if (!current_year || current_year !== transaction.season_year) {
      current_year = transaction.season_year

      log(`updating teams index for year ${current_year}`)

      const teams = await db('teams')
        .select('team_id')
        .where({ lid, season_year: current_year })

      // add any new teams to team index
      for (const team of teams) {
        if (teams_index[team.team_id]) continue

        teams_index[team.team_id] = {
          ...team,
          players: {}
        }
      }

      // remove any decommissioned teams from team index
      for (const team_id of Object.keys(teams_index)) {
        const tid = Number(team_id)
        if (teams.find((t) => t.team_id === tid)) continue

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
      case transaction_types.SUPER_PRIORITY:
      case transaction_types.POACHED:
        // The two halves of the poach flow are both adds. POACHED gives the
        // player to the poaching team; SUPER_PRIORITY returns him to his
        // original team, which holds first rights to reclaim him once the
        // poaching team releases him. Neither was applied before, and they had
        // to be fixed together: with the poach unapplied the player never left,
        // so nothing had to bring him back, and applying the poach alone would
        // have taken him off his original roster for good.
        //
        // A player is on at most one roster at a time, and the replay has to
        // ENFORCE that rather than trust the log to record every departure. A
        // poach is written only against the team that GAINS the player --
        // nothing names the team that loses him -- so without this he stayed on
        // his old roster for the rest of history, contributing his full value to
        // a team that no longer held him. At the 2026-08-11 snapshot that left
        // the replay carrying 291 players against the 243 actually rostered, and
        // moved a team's deposit by up to 37 dollars in a 2,000 dollar pool.
        //
        // Written as the invariant rather than as a POACHED-only removal,
        // because the same hole exists for any future add whose matching
        // departure the log does not state. It is a no-op wherever the log is
        // complete, which is every other add type today.
        remove_player_from_every_roster({
          teams_index,
          pid: transaction.pid
        })
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
    const trade = trades_index[transaction.transaction_id]
    if (trade && !processed_trades_index[trade.trade_id]) {
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

      // Traded picks are deliberately not applied here. This replay saw only
      // the trade legs, never a pick's endowment or its conversion at the
      // draft, so the index it built held every pick a team ever acquired and
      // none it started with. Pick ownership is read from roster_asset_holding
      // in build_day_inserts instead, which walks all four.

      processed_trades_index[trade.trade_id] = true
    }

    // check if next tran date is larger than the max interval
    //
    // The trailing gap to the present day belongs to the block after this loop,
    // so a missing next transaction is not one. Without the guard
    // `dayjs(undefined)` is the current time and both blocks walk the same
    // trailing days.
    const next_transaction = transactions[i + 1]
    const next_tran_date = dayjs(next_transaction?.occurred_at)
    if (
      next_transaction &&
      next_tran_date.diff(transaction.occurred_at, 'day') > max_day_interval
    ) {
      // calculate team daily keeptradecut value for days in between based on max_day_interval
      let cursor_date = dayjs(transaction.occurred_at).add(
        max_day_interval,
        'day'
      )
      while (cursor_date < next_tran_date) {
        emit_day({
          date: cursor_date.format('YYYY-MM-DD'),
          observed_at: cursor_date.toDate()
        })
        cursor_date = cursor_date.add(max_day_interval, 'day')
      }
    }

    last_date = tran_date
  }

  // Flush the final transaction's own day. The loop above emits only on a date
  // TRANSITION, so the last date it sets is never emitted by it — nothing
  // follows to trigger the transition. Without this the newest emitted day
  // trails the last transaction by one, which desynchronizes the two anchors
  // below: the trailing-gap filler measures from `last_date` while the
  // staleness oracle measures from max(date) of the written rows, so the
  // oracle is guaranteed to fire a day BEFORE the filler is permitted to run.
  // That fired as a false staleness alarm (signal #125844) whenever league
  // activity paused for max_day_interval + 1 days. `emit_day` keys a Map by
  // date, so this cannot double-write, and the filler starts its cursor
  // max_day_interval days later so it cannot collide.
  if (last_date) {
    emit_day({ date: last_date, observed_at: dayjs(last_date).toDate() })
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
        observed_at: cursor_date.toDate()
      })
      cursor_date = cursor_date.add(max_day_interval, 'day')
    }
  }

  log(`ignored ${ignored_tran_types.size} transaction types`)
  log(ignored_tran_types)

  const team_daily_value_inserts = Array.from(
    day_inserts_by_date.values()
  ).flat()
  const day_coverage = Array.from(coverage_by_date.values())

  // The replay is the sole writer of this league's series and recomputes it
  // whole on every run, so the table's rows for a league are exactly the rows
  // the run produced -- a row this run did not emit is a row from an older
  // replay whose date grid or team population has since moved, and nothing else
  // would ever remove it. League 1 carried 42 such rows across four dates,
  // stranded with null pick_value and total_share because they predate that
  // column pair.
  //
  // Delete and insert share one transaction so a failed insert cannot leave the
  // series empty.
  if (team_daily_value_inserts.length) {
    await db.transaction(async (trx) => {
      await trx('league_team_daily_values').where({ lid }).del()
      await batch_insert({
        items: team_daily_value_inserts,
        save: (items) => trx('league_team_daily_values').insert(items),
        batch_size: 5000
      })
    })
  }
  log(`inserted ${team_daily_value_inserts.length} team daily values`)

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

  // Pick coverage is reported rather than asserted. Rounds 5 and beyond are
  // outside keeptradecut's published series by construction, so a held-equals-
  // valued floor would fail forever on a league that awards them -- league 1
  // holds 25 such picks today. What the numbers do surface is the failure this
  // whole path is exposed to: a league whose lineage has never been generated
  // reports every team as holding nothing, which is indistinguishable from a
  // league that genuinely holds no picks unless the two are separated.
  const days_holding_picks = day_coverage.filter(
    (day) => day.held_pick_count > 0
  )
  log(
    `pick coverage: ${pick_holding_value_index.holding_count} lineage pick holdings, ${days_holding_picks.length} of ${day_coverage.length} days with a pick held`
  )

  if (!pick_holding_value_index.holding_count) {
    const [{ count: draft_pick_count }] = await db('draft')
      .where({ lid })
      .count()
    if (Number(draft_pick_count) > 0) {
      shortfalls.push(
        `no roster_asset_holding pick rows for lid=${lid} while draft holds ${draft_pick_count} picks: every team's pick_value is zero. Run scripts/generate-roster-asset-lineage.mjs --lid ${lid}`
      )
    }
  }

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

  // Share oracle: `total_share` is the Article XXII deposit divisor, so a day
  // whose shares do not sum to one is a day that would price somebody's entry
  // wrong. It reads the TABLE rather than the in-memory rows on purpose --
  // in memory each day's shares are one by construction, and every defect this
  // oracle exists to catch (a stale row surviving the write, two emissions of a
  // day landing side by side, a denominator taken over the wrong population)
  // is visible only in what was actually stored.
  const share_tolerance = 0.0001
  const unbalanced_days = await db('league_team_daily_values')
    .where({ lid })
    .select(db.raw("TO_CHAR(date, 'YYYY-MM-DD') AS date"))
    .sum({ ktc_share_total: 'ktc_share' })
    .sum({ total_share_total: 'total_share' })
    .groupBy('date')
    .havingRaw(
      'abs(coalesce(sum(ktc_share), 1) - 1) > ? or abs(coalesce(sum(total_share), 1) - 1) > ?',
      [share_tolerance, share_tolerance]
    )
    .orderBy('date')
  if (unbalanced_days.length) {
    const detail = unbalanced_days
      .slice(0, 10)
      .map(
        (day) =>
          `${day.date} ktc_share=${Number(day.ktc_share_total).toFixed(5)} total_share=${Number(day.total_share_total).toFixed(5)}`
      )
      .join(', ')
    shortfalls.push(
      `shares do not sum to 1 on ${unbalanced_days.length} day(s) for lid=${lid}: ${detail}`
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
        .select('league_id')
        .where({ is_hosted: 1 })
        .whereNull('archived_at')

      for (const league of leagues) {
        const result = await calculate_team_daily_ktc_value({
          lid: league.league_id
        })
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

  process.exit(error ? 1 : 0)
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
