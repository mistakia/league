import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import {
  constants,
  Errors,
  formatHeight,
  format_nfl_status
} from '#libs-shared'
import {
  isMain,
  ngs,
  getPlayer,
  updatePlayer,
  createPlayer
} from '#libs-server'
// import db from '#db'
// import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-current-players-ngs')
debug.enable(
  'import-current-players-ngs,nfl,update-player,create-player,get-player'
)

const import_current_players_ngs = async ({
  season = constants.season.year,
  ignore_cache = false
}) => {
  log('loading current players from ngs')

  const pids = []
  const data = await ngs.getCurrentPlayers({ season, ignore_cache })

  if (!data || !data.teamPlayers) {
    throw new Error('no data from ngs')
  }

  log(`loaded ${data.teamPlayers.length} players from ngs`)

  for (const player of data.teamPlayers) {
    const name = player.displayName
    const pos = player.position
    // Not provided in the NGS data
    // const dob = null
    const gsisid = player.gsisId
    const esbid = player.esbId
    const gsisItId = player.gsisItId

    let player_row
    let error
    if (gsisid) {
      try {
        player_row = await getPlayer({ gsisid })
      } catch (err) {
        log(err)
      }
    }

    if (!player_row && esbid) {
      try {
        player_row = await getPlayer({ esbid })
      } catch (err) {
        log(err)
      }
    }

    if (!player_row) {
      try {
        player_row = await getPlayer({ name })
      } catch (err) {
        error = err
        log(err)
      }
    }

    if (!player_row && gsisItId) {
      try {
        player_row = await getPlayer({ gsisItId })
      } catch (err) {
        log(err)
      }
    }

    const col = player.collegeName
    const dpos = player.draftNumber
    // Not provided in the NGS data
    // const round = null
    let start = player.entryYear || player.rookieYear
    const weight = player.weight
    const current_nfl_team = player.teamAbbr
    const jnum = player.jerseyNumber
    const height = formatHeight(player.height)
    const nfl_status = format_nfl_status(player.status)

    if (!start && player.yearsOfExperience === 0) {
      start = season
    }

    if (player_row) {
      pids.push(player_row.pid)
      await updatePlayer({
        player_row,
        update: {
          gsisid,
          esbid,
          gsisItId,
          col,
          dpos,
          start,
          weight,
          height,
          nfl_status
        }
      })
    } else if (
      error instanceof Errors.MatchedMultiplePlayers === false &&
      name &&
      pos
    ) {
      const player_row = await createPlayer({
        fname: player.firstName,
        lname: player.lastName,
        start,

        pos,
        pos1: pos,
        posd: pos,

        current_nfl_team,
        jnum,

        weight,
        height,

        dpos,

        col,
        dob: '0000-00-00',
        nfl_status,

        esbid,
        gsisid,
        gsisItId
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

    log(`processed ${pids.length} players from ngs`)

    // await setInactive(pids)
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default import_current_players_ngs
