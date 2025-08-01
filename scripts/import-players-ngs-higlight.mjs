import debug from 'debug'
import yargs from 'yargs'
import dayjs from 'dayjs'
import { hideBin } from 'yargs/helpers'

import {
  is_main,
  report_job,
  ngs,
  find_player_row,
  updatePlayer
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { fixTeam, constants } from '#libs-shared'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-players-ngs-highlight')
debug.enable('import-players-ngs-highlight,ngs,get-player,update-player')

const format_player = (ngs_player) => {
  const player = {
    esbid: ngs_player.esbId,
    gsisid: ngs_player.gsisId,
    dpos: ngs_player.draftNumber,
    draft_team: ngs_player.draftTeam ? fixTeam(ngs_player.draftTeam) : null
  }

  if (ngs_player.birthDate) {
    player.dob = dayjs(ngs_player.birthDate, 'MM/DD/YYYY').format('YYYY-MM-DD')
  }

  return player
}

const import_players_ngs_highlight = async ({ ignore_cache = false }) => {
  const { players } = await ngs.get_highlight_players({ ignore_cache })

  if (!players || !players.length) {
    log(`no players found`)
    return
  }

  log(`found ${players.length} players`)

  let changes = 0

  for (const ngs_player of players) {
    let player_row

    let player_changes = 0

    // try esbid
    if (ngs_player.esbId) {
      try {
        player_row = await find_player_row({ esbid: ngs_player.esbId })
      } catch (err) {
        log(err)
      }
    }

    // try gsisid
    if (!player_row && ngs_player.gsisId) {
      try {
        player_row = await find_player_row({ gsisid: ngs_player.gsisId })
      } catch (err) {
        log(err)
      }
    }

    // TOOD skipping gsis_it_id as a collision was found

    // try name, team, position
    if (!player_row && ngs_player.displayName) {
      const params = {
        name: ngs_player.displayName,
        pos: ngs_player.position,
        nfl_draft_year: ngs_player.entryYear || ngs_player.rookieYear
      }
      if (ngs_player.season === constants.season.year) {
        params.team = ngs_player.teamAbbr
      }
      try {
        player_row = await find_player_row(params)
      } catch (err) {
        log(err)
      }
    }

    if (!player_row) {
      log(ngs_player)
      log(`no player found for ${ngs_player.displayName}`)
      continue
    }

    try {
      player_changes = await updatePlayer({
        player_row,
        update: format_player(ngs_player),
        allow_protected_props: true
      })
    } catch (err) {
      // TODO track which player and fields had errors updating
      log(err)
    }

    changes += player_changes
  }

  log(`Updated ${changes} player fields`)
}

const main = async () => {
  let error
  try {
    await import_players_ngs_highlight({ ignore_cache: argv.ignore_cache })
  } catch (err) {
    error = err
    log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_PLAYERS_NGS_HIGHLIGHT,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_players_ngs_highlight
