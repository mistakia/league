import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import {
  constants,
  Errors,
  formatHeight,
  format_nfl_status,
  fixTeam
} from '#libs-shared'
import {
  is_main,
  find_player_row,
  updatePlayer,
  createPlayer
} from '#libs-server'
import { nfl_pro } from '#private/libs-server'
// import db from '#db'
// import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-current-players-ngs')
debug.enable(
  'import-current-players-ngs,nfl-pro,update-player,create-player,get-player'
)

const import_current_players_ngs = async ({
  season = constants.season.year,
  ignore_cache = false
}) => {
  log('loading current players from ngs')

  const pids = []
  const data = await nfl_pro.get_team_players({ season, ignore_cache })

  if (!data || !data.teamPlayers) {
    throw new Error('no data from NFL Pro API')
  }

  log(`loaded ${data.teamPlayers.length} players from NFL`)

  for (const player of data.teamPlayers) {
    const name = player.displayName
    const pos = player.position
    const dob = player.birthDate || null
    const gsisid = player.gsisId
    const esbid = player.esbId
    const gsis_it_id = player.gsisItId || player.nflId

    let player_row
    let error
    if (gsisid) {
      try {
        player_row = await find_player_row({ gsisid })
      } catch (err) {
        log(err)
      }
    }

    if (!player_row && esbid) {
      try {
        player_row = await find_player_row({ esbid })
      } catch (err) {
        log(err)
      }
    }

    if (!player_row) {
      try {
        player_row = await find_player_row({ name })
      } catch (err) {
        error = err
        log(err)
      }
    }

    if (!player_row && gsis_it_id) {
      try {
        player_row = await find_player_row({ gsis_it_id })
      } catch (err) {
        log(err)
      }
    }

    const col = player.collegeName
    const dpos = player.draftNumber
    const round = player.draftround || null
    const draft_team = player.draftClub ? fixTeam(player.draftClub) : null
    let nfl_draft_year = player.entryYear || player.rookieYear
    const weight = player.weight
    const current_nfl_team = fixTeam(player.teamAbbr)
    const jnum = player.jerseyNumber
    const height = formatHeight(player.height)
    const nfl_status = format_nfl_status(player.status)

    if (!nfl_draft_year && player.yearsOfExperience === 0) {
      nfl_draft_year = season
    }

    if (player_row) {
      pids.push(player_row.pid)
      await updatePlayer({
        player_row,
        update: {
          gsisid,
          esbid,
          gsis_it_id,
          col,
          dpos,
          round,
          draft_team,
          nfl_draft_year,
          weight,
          height,
          nfl_status,
          dob,
          current_nfl_team,
          jnum
        },
        allow_protected_props: true
      })
    } else if (
      error instanceof Errors.MatchedMultiplePlayers === false &&
      name &&
      pos
    ) {
      const player_row = await createPlayer({
        fname: player.firstName,
        lname: player.lastName,
        nfl_draft_year,

        pos,
        pos1: pos,
        posd: pos,

        current_nfl_team,
        jnum,

        weight,
        height,

        dpos,
        round,
        draft_team,

        col,
        dob: dob || '0000-00-00',
        nfl_status,

        esbid,
        gsisid,
        gsis_it_id
      })
      if (player_row) pids.push(player_row.pid)
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
    // const setInactive = async (pids) => {
    //   // set current_nfl_team to INA for pid not in pids
    //   const player_rows = await db('player')
    //     .whereNot('current_nfl_team', 'INA')
    //     .whereNot('pos', 'DST')
    //     .whereNotIn('pid', pids)
    //   for (const player_row of player_rows) {
    //     await updatePlayer({ player_row, update: { current_nfl_team: 'INA' } })
    //   }
    // }

    const pids = await import_current_players_ngs({
      season: argv.season,
      ignore_cache: argv.ignore_cache
    })

    log(`processed ${pids.length} players from NFL Pro API`)

    // await setInactive(pids)
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_current_players_ngs
