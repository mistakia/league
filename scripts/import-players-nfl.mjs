import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { constants, Errors, formatHeight } from '#common'
import {
  isMain,
  getToken,
  nfl,
  getPlayer,
  updatePlayer,
  createPlayer
} from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-players-nfl')
debug.enable('import-players-nfl,nfl,update-player,create-player,get-player')

const importPlayersNFL = async ({ year = constants.season.year, token }) => {
  log(`loading players for year: ${year}`)

  if (!token) {
    token = await getToken()
  }

  const data = await nfl.getPlayers({ year, token })
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
        player_row = await getPlayer({ name, pos, dob })
      } catch (err) {
        error = err
        log(err)
      }
    }

    const high_school = node.person.highSchool
    const col = node.person.collegeName
    const dpos = node.person.draftNumberOverall
    const start = node.person.draftYear
    const weight = node.weight
    const cteam = node.currentTeam.abbreviation
    const jnum = node.jerseyNumber
    const height = formatHeight(node.height)
    // TODO status

    if (player_row) {
      await updatePlayer({
        player_row,
        update: {
          gsisid,
          esbid,
          dob,
          high_school,
          col,
          dpos,
          start,
          weight,
          height
        }
      })
    } else if (
      error instanceof Errors.MatchedMultiplePlayers === false &&
      name &&
      pos &&
      dob
    ) {
      await createPlayer({
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

        col,
        high_school,
        dob
      })
    } else {
      log('unable to handle player')
      log(node)
    }
  }
}

const main = async () => {
  let error
  try {
    if (argv.all) {
      const token = await getToken()
      for (let year = 1970; year < constants.season.year; year++) {
        await importPlayersNFL({ year, token })
      }
    } else {
      await importPlayersNFL({ year: argv.year })
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
