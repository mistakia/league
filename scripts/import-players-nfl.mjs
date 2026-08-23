import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { Errors, formatHeight, format_nfl_status } from '#libs-shared'
import { current_season } from '#constants'
import {
  is_main,
  find_player_row,
  updatePlayer,
  createPlayer,
  ensure_player_alias,
  report_job,
  throw_if_shortfall
} from '#libs-server'
import * as nfl_pro from '#private/libs-server/nfl-pro.mjs'
import { job_types } from '#libs-shared/job-constants.mjs'
import { validate_response_shape } from './import-players-nfl.validate.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-players-nfl')
enable_debug_namespaces(
  'import-players-nfl,nfl-pro,update-player,create-player,get-player'
)

const importPlayersNFL = async ({
  year = current_season.year,
  ignore_cache = false
}) => {
  log(`loading players for season: ${year}`)

  const pids = []
  // NFL Pro per-team rosters replace the decommissioned NFL FDL v3 shield
  // players query. They carry roster status (including non-active players) and
  // every player's footballName -- the clean common first name -- so newly
  // created rows no longer inherit a fused legal firstName.
  const players = await nfl_pro.get_teams_roster({ season: year, ignore_cache })

  const shape = validate_response_shape({ players })
  log(
    `preflight ok: ${shape.players} players; status tokens=${shape.status_tokens.join(
      '|'
    )}`
  )

  for (const player of players) {
    const name = player.displayName
    const pos = player.position
    const dob = player.birthDate
    const gsisid = player.gsisId
    const esbid = player.esbId
    const gsis_it_id = player.gsisItId
    const smart_id = player.smartId

    const col = player.collegeName
    const dpos = player.draftNumber
    const round = player.draftround
    let draft_year = player.entryYear
    const weight = player.weight
    const current_nfl_team = player.teamAbbr
    const jnum = player.jerseyNumber
    const height = formatHeight(player.height)
    const roster_status = format_nfl_status(player.status)

    // footballName is the clean common first name (e.g. "Shaq" for
    // "Sha'Quille Thompson", "De'Zhaun" for a fused "De'Zhaun-Ryan"); fall back
    // to the legal firstName when absent.
    const first_name = player.footballName || player.firstName
    const last_name = player.lastName

    if (!draft_year && player.yearsOfExperience === 0) {
      draft_year = year
    }

    let player_row
    let error
    if (gsisid) {
      try {
        player_row = await find_player_row({ gsis_player_id: gsisid })
      } catch (err) {
        log(err)
      }
    }

    if (!player_row && esbid) {
      try {
        player_row = await find_player_row({ esb_player_id: esbid })
      } catch (err) {
        log(err)
      }
    }

    if (!player_row) {
      try {
        player_row = await find_player_row({ name, date_of_birth: dob })
      } catch (err) {
        error = err
        log(err)
      }
    }

    // Recover rows not yet matched by gsisid/esbid/dob (e.g. rookie rows seeded
    // by KTC/sleeper) by name scoped to draft year. find_player_row can throw
    // MatchedMultiplePlayers on common names; the scope disambiguates.
    if (!player_row && draft_year) {
      try {
        player_row = await find_player_row({
          name,
          nfl_draft_year: draft_year
        })
        if (player_row) error = undefined
      } catch (err) {
        error = err
        log(err)
      }
    }

    if (player_row) {
      pids.push(player_row.pid)
      await updatePlayer({
        player_row,
        update: {
          gsis_player_id: gsisid,
          esb_player_id: esbid,
          gsis_it_player_id: gsis_it_id,
          smart_player_id: smart_id,
          date_of_birth: dob,
          college: col,
          draft_overall_pick: dpos,
          draft_round: round,
          weight_pounds: weight,
          height_inches: height,
          jersey_number: jnum,
          current_nfl_team,
          roster_status
        },
        source: 'nfl'
      })
      // Record the football name (displayName) as an alias when it diverges
      // from the stored name -- backfills rows created before footballName was
      // adopted (fused legal firstName like "De'Zhaun-Ryan").
      await ensure_player_alias({
        pid: player_row.pid,
        name,
        formatted_name: player_row.formatted_name,
        source: 'nfl'
      })
    } else if (
      error instanceof Errors.MatchedMultiplePlayers === false &&
      name &&
      pos &&
      dob
    ) {
      const created = await createPlayer({
        first_name,
        last_name,

        primary_position: pos,
        secondary_position: pos,
        position_depth: pos,

        current_nfl_team,
        jersey_number: jnum,

        weight_pounds: weight,
        height_inches: height,

        draft_overall_pick: dpos,
        draft_round: round,
        nfl_draft_year: draft_year,

        college: col,
        date_of_birth: dob,
        roster_status,

        // Seed the external IDs at creation so the next run matches by ID and
        // never mints a duplicate (see league-player-resolution.md).
        gsis_player_id: gsisid,
        esb_player_id: esbid,
        gsis_it_player_id: gsis_it_id,
        smart_player_id: smart_id
      })
      if (created) {
        pids.push(created.pid)
        await ensure_player_alias({
          pid: created.pid,
          name,
          formatted_name: created.formatted_name,
          source: 'nfl'
        })
      }
    } else {
      log('unable to handle player')
      log(player)
    }
  }

  return pids
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()

    let shortfall = null
    if (argv.year) {
      const pids = await importPlayersNFL({ year: argv.year })
      log(`processed ${pids.length} players from nfl`)
      if (pids.length === 0) {
        shortfall = `import-players-nfl ${argv.year}: zero players processed`
      }
    } else {
      const pids = await importPlayersNFL({
        year: current_season.year,
        ignore_cache: true
      })
      log(`processed ${pids.length} players from nfl`)
      if (pids.length === 0) {
        shortfall = `import-players-nfl current season: zero players processed`
      }
    }
    throw_if_shortfall(shortfall)
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_PLAYERS_NFL,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default importPlayersNFL
