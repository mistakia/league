import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { constants, Errors, formatHeight } from '#libs-shared'
import {
  isMain,
  nfl,
  getPlayer,
  updatePlayer,
  createPlayer
} from '#libs-server'
import db from '#db'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-players-nfl')
debug.enable('import-players-nfl,nfl,update-player,create-player,get-player')

const importPlayersNFL = async ({
  year = constants.season.year,
  token,
  ignore_cache = false
}) => {
  log(`loading players for year: ${year}`)

  if (!token) {
    token = await nfl.getToken()
  }

  const pids = []
  const data = await nfl.getPlayers({ year, token, ignore_cache })
  for (const { node } of data) {
    const name = node.person.displayName
    const pos = node.position
    const dob = node.person.birthDate
    const gsisid = node.gsisId
    const esbid = node.esbId

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
        player_row = await getPlayer({ name, dob })
      } catch (err) {
        error = err
        log(err)
      }
    }

    const high_school = node.person.highSchool
    const col = node.person.collegeName
    const dpos = node.person.draftNumberOverall
    const round = node.person.draftRound
    let start = node.person.draftYear
    const weight = node.weight
    const cteam = node.currentTeam ? node.currentTeam.abbreviation : null
    const jnum = node.jerseyNumber
    const height = formatHeight(node.height)
    const nfl_status = node.person.status

    if (!start && node.nflExperience === 0) {
      start = year
    }

    if (player_row) {
      pids.push(player_row.pid)
      await updatePlayer({
        player_row,
        update: {
          gsisid,
          esbid,
          dob,
          high_school,
          col,
          dpos,
          round,
          start,
          weight,
          height,
          nfl_status
        }
      })
    } else if (
      error instanceof Errors.MatchedMultiplePlayers === false &&
      name &&
      pos &&
      dob
    ) {
      const player_row = await createPlayer({
        fname: node.person.firstName,
        lname: node.person.suffix
          ? `${node.person.lastName} ${node.person.suffix}`
          : node.person.lastName,
        start,

        pos,
        pos1: pos,
        posd: pos,

        cteam,
        jnum,

        weight,
        height,

        dpos,
        round,

        col,
        high_school,
        dob,
        nfl_status
      })
      if (player_row) pids.push(player_row.pid)
    } else {
      log('unable to handle player')
      log(node)
    }
  }

  return pids
}

const main = async () => {
  let error
  try {
    const setInactive = async (pids) => {
      // set cteam to INA for pid not in pids
      const player_rows = await db('player')
        .whereNot('cteam', 'INA')
        .whereNot('pos', 'DST')
        .whereNotIn('pid', pids)
      for (const player_row of player_rows) {
        await updatePlayer({ player_row, update: { cteam: 'INA' } })
      }
    }

    if (argv.all) {
      const token = await nfl.getToken()
      let year = argv.start || 1970
      for (; year < constants.season.year; year++) {
        await importPlayersNFL({ year, token })
      }
    } else if (argv.year) {
      const pids = await importPlayersNFL({ year: argv.year })

      if (argv.year === constants.season.year) {
        await setInactive(pids)
      }
    } else {
      const pids = await importPlayersNFL({
        year: constants.season.year,
        ignore_cache: true
      })

      await setInactive(pids)
    }
  } catch (err) {
    error = err
    log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.EXAMPLE,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default importPlayersNFL
