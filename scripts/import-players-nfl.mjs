import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { Errors, formatHeight, format_nfl_status } from '#libs-shared'
import { current_season } from '#constants'
import {
  is_main,
  nfl,
  find_player_row,
  updatePlayer,
  createPlayer,
  report_job,
  throw_if_shortfall
} from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { validate_response_shape } from './import-players-nfl.validate.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-players-nfl')
debug.enable('import-players-nfl,nfl,update-player,create-player,get-player')

const importPlayersNFL = async ({
  year = current_season.year,
  token,
  ignore_cache = false
}) => {
  log(`loading players for year: ${year}`)

  if (!token) {
    token = await nfl.getToken()
  }

  const pids = []
  const data = await nfl.getPlayers({ year, token, ignore_cache })

  const shape = validate_response_shape({ edges: data })
  log(
    `preflight ok: ${shape.players} players; status tokens=${Object.keys(shape.status_counts).join('|')}`
  )

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
        player_row = await find_player_row({ name, dob })
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
    const current_nfl_team = node.currentTeam
      ? node.currentTeam.abbreviation
      : null
    const jnum = node.jerseyNumber
    const height = formatHeight(node.height)
    const roster_status = format_nfl_status(node.person.status)

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
          roster_status
        },
        source: 'nfl'
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

        current_nfl_team,
        jnum,

        weight,
        height,

        dpos,
        round,

        col,
        high_school,
        dob,
        roster_status
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
    const argv = initialize_cli()

    let shortfall = null
    if (argv.all) {
      const token = await nfl.getToken()
      let year = argv.start || 1970
      for (; year < current_season.year; year++) {
        await importPlayersNFL({ year, token })
      }
    } else if (argv.year) {
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
