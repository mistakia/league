import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import {
  is_main,
  report_job,
  pff,
  wait,
  find_player_row,
  updatePlayer
} from '#libs-server'
import { constants, job_constants } from '#libs-shared'
import db from '#db'
import diff from 'deep-diff'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-pff-grades')
debug.enable('import-pff-grades,pff,get-player')
const { job_types } = job_constants

const import_pff_grades_for_position = async ({
  year,
  cookie,
  position,
  grades_url,
  ignore_cache,
  update_pff_ids = true
}) => {
  const data = await pff.get_pff_player_seasonlogs({
    year,
    position,
    cookie,
    grades_url,
    ignore_cache
  })

  const players = data.players

  log(`Importing ${players.length} grades for ${position} in ${year}`)

  // Load existing pff seasonlogs for year and position
  const existing_logs = await db('pff_player_seasonlogs').where({
    year
  })

  const existing_logs_map = new Map(existing_logs.map((log) => [log.pid, log]))

  for (const player of players) {
    let player_row

    // Try to get player using pff_id
    try {
      player_row = await find_player_row({ pff_id: player.id })
    } catch (err) {
      log(`Error getting player by pff_id: ${err.message}`)
    }

    // If pff_id lookup fails, try matching using name, team, and position
    if (!player_row) {
      try {
        player_row = await find_player_row({
          name: player.name,
          team: player.team_name,
          pos: player.position.toUpperCase()
        })
      } catch (err) {
        log(`Error getting player by name, team, and position: ${err.message}`)
      }
    }

    // Skip and log players that were not matched
    if (!player_row) {
      log(
        `Player not matched: pff_id: ${player.id} - ${player.name}, ${player.team_name}, ${player.position}`
      )
      continue
    }

    // Check if pff_id needs updating in player table
    if (
      update_pff_ids &&
      (!player_row.pff_id || player_row.pff_id !== Number(player.id))
    ) {
      try {
        const update_result = await updatePlayer({
          player_row,
          update: { pff_id: Number(player.id) },
          allow_protected_props: true
        })
        if (update_result > 0) {
          log(`Updated pff_id for player ${player_row.pid}: ${player.id}`)
        }
      } catch (err) {
        log(
          `Error updating pff_id for player ${player_row.pid}: ${err.message}`
        )
      }
    }

    const update = {
      pid: player_row.pid,
      year,
      position,
      fg_ep_kicker: Number(player.fg_ep_kicker) || null,
      defense_rank: Number(player.defense_rank) || null,
      grade_position: player.grade_position || null,
      height: Number(player.height) || null,
      run_block: Number(player.run_block) || null,
      offense: Number(player.offense) || null,
      special_teams: Number(player.special_teams) || null,
      offense_snaps: Number(player.offense_snaps) || null,
      special_teams_snaps: Number(player.special_teams_snaps) || null,
      slug: player.slug || null,
      coverage_snaps: Number(player.coverage_snaps) || null,
      punter_rank: Number(player.punter_rank) || null,
      age: Number(player.age) || null,
      pass_rush: Number(player.pass_rush) || null,
      punter: Number(player.punter) || null,
      unit: player.unit || null,
      pass_block: Number(player.pass_block) || null,
      run_block_snaps: Number(player.run_block_snaps) || null,
      draft_franchise_id: Number(player.draft?.franchise_id) || null,
      draft_league: player.draft?.league || null,
      draft_round: Number(player.draft?.round) || null,
      draft_season: Number(player.draft?.season) || null,
      draft_selection: Number(player.draft?.selection) || null,
      draft_type: player.draft?.type || null,
      offense_ranked: Number(player.offense_ranked) || null,
      jersey_number: player.jersey_number || null,
      defense_snaps: Number(player.defense_snaps) || null,
      pass_snaps: Number(player.pass_snaps) || null,
      name: player.name || null,
      defense: Number(player.defense) || null,
      current_eligible_year: Number(player.current_eligible_year) || null,
      receiving: Number(player.receiving) || null,
      coverage: Number(player.coverage) || null,
      speed: Number(player.speed) || null,
      run: Number(player.run) || null,
      run_defense_snaps: Number(player.run_defense_snaps) || null,
      defense_ranked: Number(player.defense_ranked) || null,
      pass_rush_snaps: Number(player.pass_rush_snaps) || null,
      college: player.college || null,
      pass_block_snaps: Number(player.pass_block_snaps) || null,
      pff_id: Number(player.id) || null,
      run_defense: Number(player.run_defense) || null,
      special_teams_rank: Number(player.special_teams_rank) || null,
      franchise_id: Number(player.franchise_id) || null,
      run_snaps: Number(player.run_snaps) || null,
      team_slug: player.team_slug || null,
      meets_snap_minimum: player.meets_snap_minimum,
      kickoff_kicker: Number(player.kickoff_kicker) || null,
      status: player.status || null,
      pass: Number(player.pass) || null,
      receiving_snaps: Number(player.receiving_snaps) || null,
      team_name: player.team_name || null,
      weight: Number(player.weight) || null,
      overall_snaps: Number(player.overall_snaps) || null,
      offense_rank: Number(player.offense_rank) || null
    }

    const existing_log = existing_logs_map.get(player_row.pid)

    if (existing_log) {
      await update_pff_seasonlog(update, existing_log)
    } else {
      await db('pff_player_seasonlogs').insert(update)
    }
  }
}

const update_pff_seasonlog = async (update, existing_log) => {
  const differences = diff(existing_log, update)
  if (!differences) {
    return 0
  }

  const edits = differences.filter((d) => d.kind === 'E')

  if (!edits.length) {
    return 0
  }

  let changes = 0
  for (const edit of edits) {
    const prop = edit.path[0]

    changes += 1
    log(
      `Updating pff_player_seasonlog: ${update.pid}, Year: ${update.year}, Field: ${prop}, Value: ${edit.rhs}`
    )

    const prev = edit.lhs
    if (prev) {
      await db('pff_player_seasonlogs_changelog').insert({
        pid: update.pid,
        year: update.year,
        prop,
        prev,
        new: edit.rhs,
        timestamp: Math.round(Date.now() / 1000)
      })
    }

    await db('pff_player_seasonlogs')
      .update({ [prop]: edit.rhs })
      .where({ pid: update.pid, year: update.year })
  }

  return changes
}

const import_pff_grades_for_year = async ({
  year,
  cookie,
  grades_url,
  ignore_cache,
  update_pff_ids = true
}) => {
  for (const position of pff.positions) {
    await import_pff_grades_for_position({
      year,
      cookie,
      position,
      grades_url,
      ignore_cache,
      update_pff_ids
    })
    await wait(10000)
  }
}

const import_pff_grades = async ({
  year = constants.season.year,
  all = false,
  ignore_cache = false,
  update_pff_ids = true
}) => {
  const config_row = await db('config').where({ key: 'pff_config' }).first()
  const pff_config = config_row.value

  if (!pff_config) {
    throw new Error('PFF config not found')
  }

  const cookie = await pff.get_pff_session_cookie()
  const { grades_url } = pff_config

  if (all) {
    for (const year of pff.years) {
      await import_pff_grades_for_year({
        year,
        cookie,
        grades_url,
        ignore_cache,
        update_pff_ids
      })
    }
  } else {
    await import_pff_grades_for_year({
      year,
      cookie,
      grades_url,
      ignore_cache,
      update_pff_ids
    })
  }
}

const main = async () => {
  let error
  try {
    await import_pff_grades({
      year: argv.year,
      all: argv.all,
      ignore_cache: argv.ignore_cache,
      update_pff_ids: argv.update_pff_ids !== false
    })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_PFF_GRADES,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_pff_grades
