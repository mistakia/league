import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season, player_tag_types } from '#constants'
import { is_main, report_job, throw_if_shortfall } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const log = debug('generate-rosters')
enable_debug_namespaces('generate-rosters')

// How close to `regular_season_start` the forward slice may be materialized.
// The job runs nightly, so anything above one day is margin; a week is enough
// that several consecutive missed runs still leave week 1 in place at kickoff,
// and short enough that the slice cannot drift far from the week 0 it copies.
const FORWARD_SLICE_LEAD_DAYS = 7

// No week beyond the one this run is responsible for may hold players. A slice
// that survives past its own week is served to nobody -- every consumer clamps
// its read back to the current week -- so it can only ever drift out of
// agreement with the week that IS served, which is how a stale offseason week 1
// mispriced restricted free agency bids for a whole team.
//
// Measured over rosters_players rather than rosters: an empty roster shell holds
// no state and cannot be served as one, and the test fixture pre-seeds a shell
// for every week of the season.
const check_orphan_slice = async ({
  league,
  highest_valid_week,
  slice_failures
}) => {
  const max_week_row = await db('rosters_players')
    .where({ lid: league.league_id, season_year: current_season.year })
    .max({ max_week: 'week' })
    .first()
  const max_week = max_week_row?.max_week
  if (
    max_week !== null &&
    max_week !== undefined &&
    max_week > highest_valid_week
  ) {
    slice_failures.push(
      `orphan roster slice for (lid=${league.league_id}, year=${current_season.year}): populated week ${max_week} exists beyond week ${highest_valid_week}`
    )
  }
}

// Post-write invariant: the generated slice must MATCH its source.
//
// The row-count oracle in `run` only asks whether each populated source team
// produced any rows at all, so it is blind to a slice that exists but has
// drifted from its source.
//
// MEMBERSHIP IS NOT THE WHOLE MATCH. This compared `tid:pid` alone until
// 2026-09-02, so a slice holding exactly the right players in the wrong SLOTS
// passed it -- which is the shape the drift actually takes, because the moves
// that separate week 0 from its forward copy are reserve and activate, and
// neither changes who is rostered. League 1's week 1 carried Jeanty, Nabers and
// Burden in a reserve slot against a week 0 that had all three active, five of
// ten teams disagreed on their slot-13 count, and the membership check read
// clean throughout. Assert the ATTRIBUTES the write path sets -- slot and tag,
// the same pair the `updates` filter keys on -- so a drift the update path
// failed to apply cannot pass.
//
// Be clear about what this can and cannot see, because the two are easy to
// conflate. It runs immediately after the run's own writes, so it proves the
// slice matched its source AT THE END OF THAT RUN: it catches an update path
// that silently applied nothing, not a slice that goes stale between runs.
// Staleness in the gap is a property of the CONSUMER -- a reader that wants the
// live roster must read the week the league itself considers current, not this
// copy of it -- and no oracle inside the writer can substitute for that.
//
// `extensions` stays out of the comparison, matching the write path, which
// deliberately preserves it rather than copying it forward. `next_tag` is
// passed in rather than re-derived, so the expectation and the write are one
// expression and a change to the rollover rule cannot make them disagree.
//
// Exported so a control can drive it against a state the writer cannot produce.
// A check reachable only through the job that repairs the fault it looks for is
// a check that can never be shown to go red.
export const check_slice_matches_source = async ({
  league,
  previous_year,
  previous_week,
  next_week,
  next_tag,
  slice_failures
}) => {
  const key_of = ({ tid, pid }) => `${tid}:${pid}`
  const rows_by_key = async ({ season_year, week }) =>
    new Map(
      (
        await db('rosters_players')
          .select('tid', 'pid', 'slot', 'tag')
          .where({ lid: league.league_id, season_year, week })
      ).map((row) => [key_of(row), row])
    )

  const source_by_key = await rows_by_key({
    season_year: previous_year,
    week: previous_week
  })
  const generated_by_key = await rows_by_key({
    season_year: current_season.year,
    week: next_week
  })

  const missing = [...source_by_key.keys()].filter(
    (k) => !generated_by_key.has(k)
  )
  const extra = [...generated_by_key.keys()].filter(
    (k) => !source_by_key.has(k)
  )

  const divergent = []
  for (const [key, source_row] of source_by_key) {
    const generated_row = generated_by_key.get(key)
    if (!generated_row) continue
    const expected_tag = next_tag(source_row)
    if (
      generated_row.slot !== source_row.slot ||
      generated_row.tag !== expected_tag
    ) {
      divergent.push(
        `${key} slot ${source_row.slot}->${generated_row.slot} tag ${expected_tag}->${generated_row.tag}`
      )
    }
  }

  if (!missing.length && !extra.length && !divergent.length) {
    return
  }

  // Name a few divergent players outright. The counts alone cannot distinguish a
  // systematic copy failure from one team's stuck update, and this log line is
  // the only surface the job has.
  const sample = divergent.length
    ? `; e.g. ${divergent.slice(0, 3).join(', ')}`
    : ''
  slice_failures.push(
    `slice divergence for (lid=${league.league_id}, year=${current_season.year}, week=${next_week}): ${missing.length} missing, ${extra.length} extra, ${divergent.length} slot/tag drift vs source (year=${previous_year}, week=${previous_week})${sample}`
  )
}

const run = async () => {
  const is_new_season = current_season.now > current_season.end

  // do not run once season is over unless generating roster for next season
  if (current_season.week >= current_season.final_week && !is_new_season) {
    log('season over')
    return
  }

  // `current_season.week` reads 0 for the WHOLE offseason, so an unguarded
  // `week + 1` materializes a week-1 slice the day the previous season ends and
  // then lets it drift: the slice freezes at whatever week 0 held that night
  // while tags, trades and restricted free agency bids keep moving underneath
  // it. In 2026 it sat six months stale carrying the prior season's tags. Week 1
  // is not real until `regular_season_start` (two Tuesdays before the opener),
  // so hold the forward slice until that is days away and leave week 0 as the
  // only populated slice for the rest of the offseason.
  const days_until_week_one = current_season.regular_season_start.diff(
    current_season.now,
    'day'
  )
  const generate_forward_slice =
    is_new_season ||
    current_season.week > 0 ||
    days_until_week_one <= FORWARD_SLICE_LEAD_DAYS

  // get list of hosted leagues
  const leagues = await db('leagues').where('is_hosted', 1)

  const slice_failures = []

  const nextWeek = is_new_season ? 0 : current_season.week + 1
  const previousWeek = is_new_season
    ? current_season.final_week
    : current_season.week
  const previousYear = is_new_season
    ? current_season.year - 1
    : current_season.year

  // The highest slice that may legitimately be populated for the current year.
  // Without the forward slice that is the current week itself, which is what
  // makes an offseason week-1 slice an orphan the check below reports.
  const highest_valid_week = generate_forward_slice
    ? nextWeek
    : current_season.week

  // Tags are season-specific (FRANCHISE/ROOKIE/RFA must be re-applied each
  // offseason). On the year-rollover insert into year=N week=0, scrub any
  // non-REGULAR tag carried forward from year=N-1's final week.
  //
  // Defined once, at the level the post-write invariant can also reach: the
  // invariant asserts the generated tag against what the write path was
  // supposed to produce, so the two must be the same expression rather than
  // two copies of one rule.
  const next_tag = (p) => (is_new_season ? player_tag_types.REGULAR : p.tag)

  if (generate_forward_slice) {
    log(
      `Generating rosters for ${current_season.year} Week ${nextWeek} using ${previousYear} Week ${previousWeek}`
    )
  } else {
    log(
      `Offseason: holding the forward slice until Week 1 is within ${FORWARD_SLICE_LEAD_DAYS} days (${days_until_week_one} days out)`
    )
  }

  for (const league of leagues) {
    if (!generate_forward_slice) {
      await check_orphan_slice({ league, highest_valid_week, slice_failures })
      continue
    }

    // get latest rosters for league
    const rosters = await db('rosters').where({
      lid: league.league_id,
      season_year: previousYear,
      week: previousWeek
    })

    // Only source rosters that actually hold players can produce writes in the
    // new slice. An empty source roster (a shell with no rosters_players, e.g. a
    // prior final-week roster that was never populated) legitimately contributes
    // nothing, so it must not count toward the shortfall expectation.
    let source_teams_with_players = 0

    for (const roster of rosters) {
      // get current roster players
      const { tid, lid, roster_id } = roster
      const roster_player_rows = await db('rosters_players').where({
        roster_id
      })
      if (roster_player_rows.length) {
        source_teams_with_players += 1
      }
      const current_pids = roster_player_rows.map((p) => p.pid)

      // get roster id
      const rosterData = {
        tid,
        lid,
        week: nextWeek,
        season_year: current_season.year
      }
      const rosterRows = await db('rosters').where(rosterData)
      let rid = rosterRows.length ? rosterRows[0].roster_id : null
      if (!rid) {
        const insert_query = await db('rosters')
          .insert(rosterData)
          .returning('roster_id')
        rid = insert_query[0].roster_id
      }

      // insert any missing players & remove excess players
      const existing_rows = await db('rosters_players').where({
        roster_id: rid
      })
      const existing_pids = existing_rows.map((p) => p.pid)
      const overlapping_pids = roster_player_rows.filter((p) =>
        existing_pids.includes(p.pid)
      )
      const missing_pids = roster_player_rows.filter(
        (p) => !existing_pids.includes(p.pid)
      )
      const extra_pids = existing_rows.filter(
        (p) => !current_pids.includes(p.pid)
      )
      const inserts = missing_pids.map((p) => ({
        roster_id: rid,
        tag: next_tag(p),
        slot: p.slot,
        pid: p.pid,
        player_position: p.player_position,
        extensions: p.extensions, // Use previous week's value for new roster entries
        tid,
        lid,
        season_year: current_season.year,
        week: nextWeek
      }))

      const updates = overlapping_pids
        .map((p) => ({ ...p, tag: next_tag(p) }))
        .filter((p) => {
          const item = existing_rows.find((i) => i.pid === p.pid)
          return (
            item.slot !== p.slot || item.tag !== p.tag
            // Extensions should persist and not be compared
          )
        })

      if (inserts.length) {
        await db('rosters_players').insert(inserts)
      }

      if (extra_pids.length) {
        await db('rosters_players')
          .del()
          .where('roster_id', rid)
          .whereIn(
            'pid',
            extra_pids.map((p) => p.pid)
          )
      }

      if (updates.length) {
        for (const { pid, slot, tag } of updates) {
          await db('rosters_players')
            .where({ roster_id: rid, pid })
            .update({ slot, tag })
          // Extensions are preserved - not updated
        }
      }
    }

    // Post-write oracle: every source team that HAD roster players should appear
    // in rosters_players for the new (lid, year, week) slice. A shortfall means
    // some populated source roster silently produced no entries in the new slice.
    const source_team_count = source_teams_with_players
    if (source_team_count > 0) {
      const written_row = await db('rosters_players')
        .where({
          lid: league.league_id,
          season_year: current_season.year,
          week: nextWeek
        })
        .countDistinct({ written: 'tid' })
        .first()
      const written_count = Number(written_row?.written || 0)
      if (written_count < source_team_count) {
        slice_failures.push(
          `row-count shortfall: written=${written_count} expected=${source_team_count} for (lid=${league.league_id}, year=${current_season.year}, week=${nextWeek})`
        )
      }
    }

    await check_slice_matches_source({
      league,
      previous_year: previousYear,
      previous_week: previousWeek,
      next_week: nextWeek,
      next_tag,
      slice_failures
    })

    await check_orphan_slice({ league, highest_valid_week, slice_failures })
  }

  throw_if_shortfall(
    slice_failures.length > 0 ? slice_failures.join('; ') : null
  )
}

const main = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.GENERATE_ROSTERS,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default run
