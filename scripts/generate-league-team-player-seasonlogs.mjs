import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import {
  is_main,
  batch_insert,
  report_job,
  throw_if_shortfall
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

import { active_roster_slots, starting_lineup_slots } from '#constants'

import compute_roster_slot_metrics from '#libs-server/league-team-player-seasonlogs/compute-roster-slot-metrics.mjs'
import compute_optimal_metrics from '#libs-server/league-team-player-seasonlogs/compute-optimal-metrics.mjs'

const log = debug('generate-league-team-player-seasonlogs')
debug.enable('generate-league-team-player-seasonlogs')

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .option('lid', { type: 'number' })
    .option('year', { type: 'number' })
    .option('with-optimal', { type: 'boolean', default: false })
    .option('all', { type: 'boolean', default: false }).argv
}

const empty_metrics = () => ({
  weeks_rostered: 0,
  weeks_started: 0,
  pts_added_earned_rostered: null,
  pts_added_net_rostered: null,
  pts_added_earned_started: null,
  pts_added_net_started: null,
  pts_added_earned_optimal: null,
  pts_added_net_optimal: null
})

const build_rows_for_slice = async ({
  lid,
  year,
  league_format_id,
  league_format_record,
  with_optimal
}) => {
  const seasonlog_rows = await db('league_player_seasonlogs')
    .where({ lid, year })
    .select(
      'pid',
      'start_tid',
      'start_acquisition_type',
      'end_tid',
      'end_acquisition_type',
      'salary'
    )

  const rostered = await compute_roster_slot_metrics({
    lid,
    year,
    league_format_id,
    slots: active_roster_slots,
    suffix: 'rostered'
  })
  const started = await compute_roster_slot_metrics({
    lid,
    year,
    league_format_id,
    slots: starting_lineup_slots,
    suffix: 'started'
  })
  const optimal = with_optimal
    ? await compute_optimal_metrics({
        lid,
        year,
        league_format_id,
        league_format_record
      })
    : new Map()

  // Discover every (tid, pid) pairing that appears in any metric map plus the
  // start/end teams from the seasonlogs.
  const pairings = new Map() // key -> { tid, pid }
  const add_pair = (tid, pid) => {
    if (tid == null || pid == null) return
    pairings.set(`${tid}__${pid}`, { tid, pid })
  }
  for (const r of seasonlog_rows) {
    if (r.start_tid == null && r.end_tid == null) continue
    add_pair(r.start_tid, r.pid)
    add_pair(r.end_tid, r.pid)
  }
  for (const k of rostered.keys()) {
    const [tid, pid] = k.split('__')
    pairings.set(k, { tid: Number(tid), pid })
  }
  for (const k of started.keys()) {
    const [tid, pid] = k.split('__')
    pairings.set(k, { tid: Number(tid), pid })
  }
  for (const k of optimal.keys()) {
    const [tid, pid] = k.split('__')
    pairings.set(k, { tid: Number(tid), pid })
  }

  const seasonlog_by_pid = new Map(seasonlog_rows.map((r) => [r.pid, r]))

  const rows = []
  for (const { tid, pid } of pairings.values()) {
    const k = `${tid}__${pid}`
    const m = {
      ...empty_metrics(),
      ...(rostered.get(k) || {}),
      ...(started.get(k) || {}),
      ...(optimal.get(k) || {})
    }

    const seasonlog = seasonlog_by_pid.get(pid)
    const start_tid = seasonlog?.start_tid ?? null
    const end_tid = seasonlog?.end_tid ?? null
    const is_start_team = start_tid != null && tid === start_tid
    const is_end_team = end_tid != null && tid === end_tid

    let salary_paid = 0
    if (start_tid == null) {
      salary_paid = null
    } else if (is_start_team) {
      salary_paid = seasonlog?.salary ?? null
    }

    let acquisition_type = null
    if (is_start_team) {
      acquisition_type = seasonlog?.start_acquisition_type ?? null
    } else if (is_end_team && start_tid !== end_tid) {
      acquisition_type = seasonlog?.end_acquisition_type ?? null
    }

    rows.push({
      lid,
      tid,
      pid,
      year,
      league_format_id,
      weeks_rostered: m.weeks_rostered,
      weeks_started: m.weeks_started,
      pts_added_earned_rostered: m.pts_added_earned_rostered,
      pts_added_net_rostered: m.pts_added_net_rostered,
      pts_added_earned_started: m.pts_added_earned_started,
      pts_added_net_started: m.pts_added_net_started,
      pts_added_earned_optimal: m.pts_added_earned_optimal,
      pts_added_net_optimal: m.pts_added_net_optimal,
      salary_paid,
      acquisition_type,
      is_start_team,
      is_end_team
    })
  }
  return rows
}

export const generate_league_team_player_seasonlogs = async ({
  lid,
  year,
  with_optimal = false
}) => {
  const year_hash_pairs = await db('seasons')
    .where({ lid })
    .modify((q) => {
      if (year) q.where({ year })
    })
    .distinct('year', 'league_format_id')
    .orderBy('year', 'asc')

  const slice_failures = []

  for (const { year: y, league_format_id } of year_hash_pairs) {
    log(`processing lid=${lid} year=${y} hash=${league_format_id}`)

    const league_format_record = await db('league_formats')
      .where({ id: league_format_id })
      .first()
    if (!league_format_record) {
      log(`skipping ${league_format_id}: missing league_formats row`)
      continue
    }

    const rows = await build_rows_for_slice({
      lid,
      year: y,
      league_format_id,
      league_format_record,
      with_optimal
    })

    // Floor oracle: every team that fielded a roster in (lid, y) should be
    // represented by at least one row. `seasons` carries one league_format_id
    // per (lid, y), so the cross-hash tid count equals the per-hash floor.
    const floor_row = await db('rosters_players')
      .where({ lid, year: y })
      .countDistinct({ floor: 'tid' })
      .first()
    const floor = Number(floor_row?.floor || 0)
    if (rows.length < floor) {
      const reason = `row-count shortfall: actual=${rows.length} floor=${floor} for (lid=${lid}, year=${y}, hash=${league_format_id})`
      log(reason)
      slice_failures.push(reason)
    }

    await db('league_team_player_seasonlogs')
      .where({ lid, year: y, league_format_id })
      .del()

    if (rows.length > 0) {
      await batch_insert({
        items: rows,
        batch_size: 5000,
        save: async (batch) =>
          db('league_team_player_seasonlogs')
            .insert(batch)
            .onConflict(['lid', 'tid', 'pid', 'year', 'league_format_id'])
            .merge()
      })
    }
    log(
      `wrote ${rows.length} rows for lid=${lid} year=${y} hash=${league_format_id}`
    )
  }

  throw_if_shortfall(
    slice_failures.length > 0 ? slice_failures.join('; ') : null
  )
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const with_optimal = Boolean(argv['with-optimal'])
    if (argv.lid) {
      await generate_league_team_player_seasonlogs({
        lid: argv.lid,
        year: argv.year,
        with_optimal
      })
    } else if (argv.all) {
      const leagues = await db('leagues')
        .select('uid')
        .where({ hosted: 1 })
        .whereNull('archived_at')
      for (const league of leagues) {
        await generate_league_team_player_seasonlogs({
          lid: league.uid,
          year: argv.year,
          with_optimal
        })
      }
    } else {
      throw new Error('--lid <id> or --all required')
    }
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.GENERATE_LEAGUE_TEAM_PLAYER_SEASONLOGS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default generate_league_team_player_seasonlogs
