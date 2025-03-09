import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import {
  is_main,
  find_player_row,
  createPlayer,
  updatePlayer,
  nfl
} from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-players-combine-profiles')
debug.enable(
  'import-players-combine-profiles,get-player,create-player,update-player,nfl'
)

// Function to update NGS prospect scores in the new tables
const update_ngs_prospect_scores = async ({ pid, ngs_data, timestamp }) => {
  try {
    // Insert into index table with ON CONFLICT DO UPDATE
    await db('ngs_prospect_scores_index')
      .insert({
        pid,
        ...ngs_data,
        updated_at: timestamp
      })
      .onConflict('pid')
      .merge({
        ...ngs_data,
        updated_at: timestamp
      })

    // Insert a new record in the history table
    await db('ngs_prospect_scores_history')
      .insert({
        pid,
        ...ngs_data,
        recorded_at: timestamp
      })
      .onConflict(['pid', 'recorded_at'])
      .ignore()

    log(`Updated NGS prospect scores for player ${pid}`)
  } catch (err) {
    log(`Error updating NGS prospect scores: ${err.message}`)
  }
}

const import_players_from_combine_profiles_for_year = async ({
  year = constants.season.year,
  token,
  ignore_cache = false,
  current_timestamp = Math.floor(Date.now() / 1000)
} = {}) => {
  let change_count = 0
  let create_count = 0

  const profiles_data = await nfl.get_combine_profiles({
    ignore_cache,
    year,
    token
  })

  log(
    `got ${profiles_data.combineProfiles.length} combine profiles for ${year}`
  )

  for (const profile of profiles_data.combineProfiles) {
    let player_row
    try {
      player_row = await find_player_row({ esbid: profile.person.esbId })
    } catch (err) {
      log(err)
      continue
    }

    // Extract NGS prospect scores
    const ngs_data = {
      ngs_athleticism_score: profile.athleticismScore || null,
      ngs_draft_grade: profile.draftGrade || null,
      nfl_grade: profile.grade || null,
      ngs_production_score: profile.productionScore || null,
      ngs_size_score: profile.sizeScore || null
    }

    // Extract combine metrics
    const combine_data = {
      forty: profile.fortyYardDash?.seconds || null,
      bench: profile.benchPress?.repetitions || null,
      vertical: profile.verticalJump?.inches || null,
      broad: profile.broadJump?.inches || null,
      shuttle: profile.twentyYardShuttle?.seconds || null,
      cone: profile.threeConeDrill?.seconds || null,
      arm: profile.armLength || null,
      hand: profile.handSize || null,
      ...ngs_data
    }

    const has_ngs_data = Object.values(ngs_data).some((value) => value !== null)

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
          ...combine_data
        })

        if (player_row) {
          create_count += 1

          // Update NGS prospect scores tables for new player
          if (has_ngs_data) {
            await update_ngs_prospect_scores({
              pid: player_row.pid,
              ngs_data,
              timestamp: current_timestamp
            })
          }
        }
      } catch (err) {
        log(err)
      }
    } else {
      const changes = await updatePlayer({
        player_row,
        update: combine_data
      })
      change_count += changes

      // Update NGS prospect scores tables for existing player
      if (has_ngs_data) {
        await update_ngs_prospect_scores({
          pid: player_row.pid,
          ngs_data,
          timestamp: current_timestamp
        })
      }
    }
  }

  log(`updated ${change_count} player fields`)
  log(`created ${create_count} players`)
}

const import_all_players_from_combine_profiles = async ({
  start,
  end,
  ignore_cache = false,
  current_timestamp = Math.floor(Date.now() / 1000)
}) => {
  const token = await nfl.get_session_token_v3()
  const min_year = 2006
  const max_year = constants.season.year

  start = start ? Math.max(start, min_year) : min_year
  end = end ? Math.min(end, max_year) : max_year

  for (let year = start; year <= end; year++) {
    await import_players_from_combine_profiles_for_year({
      year,
      token,
      ignore_cache,
      current_timestamp
    })
  }
}

const main = async () => {
  let error
  try {
    if (argv.all) {
      await import_all_players_from_combine_profiles({
        start: argv.start,
        end: argv.end,
        ignore_cache: argv.ignore_cache
      })
    } else {
      await import_players_from_combine_profiles_for_year({
        year: argv.year,
        ignore_cache: argv.ignore_cache
      })
    }
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default import_players_from_combine_profiles_for_year
