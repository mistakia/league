import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

// import db from '#db'
import { constants } from '#libs-shared'
import {
  isMain,
  getPlayer,
  createPlayer,
  updatePlayer,
  nfl
} from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-players-combine-profiles')
debug.enable(
  'import-players-combine-profiles,get-player,create-player,update-player,nfl'
)

const import_players_from_combine_profiles_for_year = async ({
  year = constants.season.year,
  token,
  ignore_cache = false
} = {}) => {
  let changeCount = 0
  let createCount = 0

  const data = await nfl.get_combine_profiles({
    ignore_cache,
    year,
    token
  })

  for (const profile of data.combineProfiles) {
    let player_row
    try {
      player_row = await getPlayer({ esbid: profile.person.esbId })
    } catch (err) {
      log(err)
      continue
    }

    // add combine metrics
    const data = {
      forty: profile.fortyYardDash ? profile.fortyYardDash.seconds : null,
      bench: profile.benchPress ? profile.benchPress.repetitions : null,
      vertical: profile.verticalJump ? profile.verticalJump.inches : null,
      broad: profile.broadJump ? profile.broadJump.inches : null,
      shuttle: profile.twentyYardShuttle
        ? profile.twentyYardShuttle.seconds
        : null,
      cone: profile.threeConeDrill ? profile.threeConeDrill.seconds : null,
      arm: profile.armLength || null,
      hand: profile.handSize || null
    }

    if (!player_row) {
      try {
        player_row = await createPlayer({
          fname: profile.person.firstName,
          lname: profile.person.lastName,
          pos: profile.position,
          pos1: profile.position,
          posd: 'INA',
          height: Math.round(profile.height),
          weight: profile.weight,
          col: profile.person.collegeNames.length
            ? profile.person.collegeNames[0]
            : null,
          start: year,
          esbid: profile.person.esbId,
          jnum: 0,
          dob: '0000-00-00', // TODO - ideally required
          ...data
        })
        createCount += 1
      } catch (err) {
        log(err)
      }
    } else {
      const changes = await updatePlayer({
        player_row,
        update: data
      })
      changeCount += changes
    }
  }

  log(`updated ${changeCount} player fields`)
  log(`created ${createCount} players`)
}

const import_all_players_from_combine_profiles = async ({
  start = constants.season.year,
  end = constants.season.year
}) => {
  const token = await nfl.getToken()
  start = Math.max(start, 2006)
  end = Math.min(end, constants.season.year)

  for (let year = start; year <= end; year++) {
    await import_players_from_combine_profiles_for_year({
      year,
      token
    })
  }
}

const main = async () => {
  let error
  try {
    if (argv.all) {
      await import_all_players_from_combine_profiles({
        start: argv.start,
        end: argv.end
      })
    } else {
      await import_players_from_combine_profiles_for_year({
        year: argv.year
      })
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

export default import_players_from_combine_profiles_for_year
