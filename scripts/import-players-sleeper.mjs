import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import {
  fixTeam,
  format_nfl_status,
  format_nfl_injury_status
} from '#libs-shared'
import { fantasy_positions, is_offseason } from '#constants'
import {
  is_main,
  find_player_row,
  updatePlayer,
  createPlayer,
  report_job,
  fetch_with_retry,
  throw_if_shortfall
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-players-sleeper')
debug.enable(
  'import-players-sleeper,update-player,create-player,get-player,fetch'
)
const timestamp = Math.round(Date.now() / 1000)

const run = async () => {
  const URL = 'https://api.sleeper.app/v1/players/nfl'
  const result = await fetch_with_retry({ url: URL, response_type: 'json' })
  const sleeper_player_count = result ? Object.keys(result).length : 0

  const statuses = []
  const fields = {}
  let changeCount = 0
  let players_with_injury_status = 0

  for (const sleeper_id in result) {
    const item = result[sleeper_id]
    const name = item.full_name || ''
    const team = fixTeam(item.team)
    const pos = item.position
    const start = item.metadata?.start_year || null

    if (!name || !pos) continue

    for (const field in item) {
      fields[field] = true
    }

    let player_row
    let matched_by_sleeper_id = false
    try {
      player_row = await find_player_row({ sleeper_player_id: sleeper_id })
      if (player_row) {
        matched_by_sleeper_id = true
      } else {
        player_row = await find_player_row({
          name,
          pos,
          teams: [team, 'INA'],
          ignore_retired: true,
          start
        })
      }
    } catch (err) {
      log(err)
      log({ name, pos, team, sleeper_id })
      log(item)
      continue
    }

    // Reused-name external ID hijack guard. When we fall through to
    // name-based matching and Sleeper's rookie_year is materially newer than
    // the matched pid's nfl_draft_year, we are almost certainly about to
    // hijack the wrong pid (older relative). Skip rather than corrupt.
    // Also refuse silent overwrite of an existing different sleeper_id /
    // gsisid / espn_id on the name-matched pid.
    if (player_row && !matched_by_sleeper_id) {
      const source_draft_year =
        Number(item.metadata?.rookie_year) || Number(start) || null
      const matched_draft_year = Number(player_row.nfl_draft_year) || null
      if (
        source_draft_year &&
        matched_draft_year &&
        source_draft_year - matched_draft_year > 1
      ) {
        log(
          `SKIP probable name-match hijack: sleeper_id=${sleeper_id} name="${name}" rookie_year=${source_draft_year} matched_pid=${player_row.pid} (draft_year=${matched_draft_year}).`
        )
        continue
      }

      const protected_collision = [
        ['sleeper_player_id', sleeper_id, player_row.sleeper_player_id],
        [
          'gsis_player_id',
          item.gsis_id ? item.gsis_id.trim() : null,
          player_row.gsis_player_id
        ],
        ['espn_player_id', item.espn_id, player_row.espn_player_id]
      ].find(
        ([, incoming, existing]) =>
          incoming != null &&
          existing != null &&
          String(incoming) !== String(existing)
      )
      if (protected_collision) {
        const [field, incoming, existing] = protected_collision
        log(
          `SKIP ${field} overwrite: matched_pid=${player_row.pid} already has ${field}=${existing}, Sleeper reports ${incoming} for "${name}".`
        )
        continue
      }
    }

    const {
      active,
      depth_chart_order,
      depth_chart_position,
      injury_body_part,
      injury_start_date,
      injury_status,
      injury_notes,
      practice_participation,
      practice_description,
      status,
      search_rank,

      rotoworld_id,
      high_school,
      rotowire_id,
      gsis_id,
      sportradar_id,
      espn_id,
      fantasy_data_id,
      yahoo_id
      // stats_id,
    } = item

    const data = {
      rotoworld_player_id: rotoworld_id,
      high_school,
      rotowire_player_id: rotowire_id,
      gsis_player_id: gsis_id ? gsis_id.trim() : null,
      sportradar_player_id: sportradar_id || null,
      espn_player_id: espn_id,
      fantasy_data_player_id: fantasy_data_id,
      yahoo_player_id: yahoo_id,
      // stats_global_id: stats_id,
      sleeper_player_id: sleeper_id,
      current_nfl_team: team
    }

    // check to see if status matches game designation first (OUT, QUESTIONABLE, DOUBTFUL, PROBABLE)
    try {
      data.game_designation = format_nfl_injury_status(injury_status)
    } catch (err) {
      log(err)
      log(item)
    }

    // injury status could be PUP which is a roster status
    if (injury_status && !data.game_designation) {
      try {
        data.roster_status = format_nfl_status(injury_status)
      } catch (err) {
        log(err)
        log(item)
      }
    } else if (!data.game_designation) {
      data.roster_status = format_nfl_status(status)
    }

    if (!player_row) {
      if (!fantasy_positions.includes(item.position)) continue
      if (item.first_name === 'Duplicate' || item.first_name === 'Player')
        continue

      try {
        player_row = await createPlayer({
          first_name: item.first_name,
          last_name: item.last_name,
          primary_position: item.position,
          secondary_position: item.position,
          height_inches: item.height,
          weight_pounds: item.weight,
          date_of_birth: item.birth_date,
          college: item.college,
          current_nfl_team: item.team,
          jersey_number: item.number,

          position_depth: item.position,
          start,

          ...data
        })
      } catch (err) {
        log(err)
        log(item)
      }
    } else {
      const changes = await updatePlayer({
        player_row,
        update: data,
        source: 'sleeper'
      })
      changeCount += changes
    }

    if (!player_row || !injury_status) continue
    players_with_injury_status += 1

    const status_insert = {
      pid: player_row.pid,
      sleeper_player_id: sleeper_id,

      is_active: active,
      depth_chart_order,
      depth_chart_position,
      injury_body_part,
      injury_start_date,
      source_injury_status: injury_status,
      injury_notes,
      practice_participation,
      practice_description,
      source_status: status,
      search_rank,

      timestamp
    }

    // Try to parse as game designation first (OUT, QUESTIONABLE, DOUBTFUL, PROBABLE)
    try {
      status_insert.game_designation = format_nfl_injury_status(injury_status)
    } catch (err) {
      log(err)
      log(item)
    }

    // If not a game designation, try parsing as roster status
    if (!status_insert.game_designation) {
      try {
        status_insert.roster_status = format_nfl_status(status)
      } catch (err) {
        log(err)
        log(item)
      }
    }

    statuses.push(status_insert)
  }

  log(`updated ${changeCount} player fields`)

  if (statuses.length) {
    await db('players_status').insert(statuses)
  }

  // API liveness oracle: the Sleeper /players/nfl endpoint must return a
  // non-empty payload. A players_status freshness check was tried earlier but
  // false-positives during deep-offseason / roster-lock windows when Sleeper
  // legitimately returns thousands of players carrying no injury_status (the
  // gate at line 167 above skips status_insert when injury_status is null).
  if (sleeper_player_count === 0) {
    return {
      fields,
      shortfall:
        'Sleeper /players/nfl returned empty payload — API outage or cached empty response'
    }
  }

  // In-season-only monitors. Both run after a successful API liveness check
  // and emit shortfalls into the unified signal queue via throw_if_shortfall.
  if (!is_offseason) {
    // E3: value-level health canary. The 2022 Sleeper blackout kept the API
    // shape intact (player objects returned with the same keys) but stripped
    // injury_status content -- a key-hash canary would not have caught it.
    // Threshold of 5 active injuries is comfortably above any plausible
    // in-season floor; any in-season Tuesday-Sunday window normally
    // carries hundreds.
    if (players_with_injury_status < 5) {
      return {
        fields,
        shortfall: `Sleeper value-level canary: only ${players_with_injury_status} players carry injury_status in this in-season run (floor 5) -- possible 2022-style content stripping`
      }
    }

    // E1: blackout monitor. Zero injury_status changelog writes from the
    // sleeper source in the last 48h during the in-season window means
    // either the API stripped content (caught above) or our writer is
    // broken upstream. The 2022 blackout ran 23 weeks undetected; this
    // catches a recurrence on day 3.
    const cutoff = new Date((timestamp - 48 * 3600) * 1000)
    const [{ c: recent_writes }] = await db('player_changelog')
      .where({ source: 'sleeper', column_name: 'injury_status' })
      .andWhere('changed_at', '>=', cutoff)
      .count({ c: '*' })
    if (Number(recent_writes) === 0) {
      return {
        fields,
        shortfall: `Sleeper blackout monitor: zero source='sleeper' injury_status changelog writes in the last 48h during in-season -- 2022-style blackout suspected`
      }
    }
  }

  return { fields, shortfall: null }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const { fields, shortfall } = await run()
    if (argv.fields) {
      log(`Complete field list: ${Object.keys(fields)}`)
    }
    throw_if_shortfall(shortfall)
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_PLAYERS_SLEEPER,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
