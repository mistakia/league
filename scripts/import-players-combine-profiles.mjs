import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season } from '#constants'
import {
  is_main,
  find_player_row,
  createPlayer,
  updatePlayer,
  nfl
} from '#libs-server'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'
// import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-players-combine-profiles')
enable_debug_namespaces(
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
        observed_at: timestamp
      })
      .onConflict(['pid', 'observed_at'])
      .ignore()

    log(`Updated NGS prospect scores for player ${pid}`)
  } catch (err) {
    log(`Error updating NGS prospect scores: ${err.message}`)
  }
}

const import_players_from_combine_profiles_for_year = async ({
  year = current_season.year,
  token,
  ignore_cache = false,
  current_timestamp = new Date()
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
      player_row = await find_player_row({
        esb_player_id: profile.person.esbId
      })

      // The esb lookup above was the ONLY matcher here, and find_player_row's id
      // chain is exclusive with its name branch -- so a player already minted by a
      // feed that carries no esb id (SIS draft profiles in particular) was invisible
      // to this importer and got a second row. That is how CLEV-HARR-002939 and
      // CLEV-HARR-007173 both came to exist for Tre Harris, 2025 WR, with the
      // GSIS/NFL identifier family on one row and every commercial source on the
      // other. Fall back to the combine class's own discriminators before minting.
      // Accept the candidate only when it carries no esb id of its own: a row that
      // already has a DIFFERENT esb id is a different person with the same name in
      // the same class, and enriching it would corrupt a real player rather than
      // merely duplicate one.
      if (!player_row) {
        const candidate = await find_player_row({
          name: `${profile.person.firstName} ${profile.person.lastName}`,
          nfl_draft_year: year,
          pos: profile.position
        })
        if (candidate && !candidate.esb_player_id) player_row = candidate
      }
    } catch (err) {
      // MatchedMultiplePlayers -- two same-name rows in this draft class. Abstain
      // rather than mint; a duplicate row is mergeable, a wrong enrichment is not.
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
      height_inches: profile.height ? Math.round(profile.height) : null,
      weight_pounds: profile.weight || null,
      forty_yard_dash_seconds: profile.fortyYardDash?.seconds || null,
      forty_yard_dash_designation: profile.fortyYardDash?.designation ?? null,
      bench_press_reps: profile.benchPress?.repetitions || null,
      vertical_jump_inches: profile.verticalJump?.inches || null,
      broad_jump_inches: profile.broadJump?.inches || null,
      shuttle_run_seconds: profile.twentyYardShuttle?.seconds || null,
      three_cone_drill_seconds: profile.threeConeDrill?.seconds || null,
      arm_length_inches: profile.armLength || null,
      hand_size_inches: profile.handSize || null,
      ten_yard_split_seconds: profile.tenYardSplit?.seconds || null,
      ten_yard_split_designation: profile.tenYardSplit?.designation ?? null,
      pro_day_forty_seconds: profile.proFortyYardDash?.seconds || null,
      pro_day_forty_designation: profile.proFortyYardDash?.designation ?? null,
      sixty_yard_shuttle_seconds: profile.sixtyYardShuttle?.seconds || null,
      sixty_yard_shuttle_designation:
        profile.sixtyYardShuttle?.designation ?? null,
      has_combine_attendance: profile.combineAttendance ?? null,
      ...ngs_data
    }

    const hometown = profile.person?.hometown ?? null

    const has_ngs_data = Object.values(ngs_data).some((value) => value !== null)

    if (!player_row) {
      try {
        player_row = await createPlayer({
          first_name: profile.person.firstName,
          last_name: profile.person.lastName,
          primary_position: profile.position,
          secondary_position: profile.position,
          position_depth: 'INA',
          height_inches: Math.round(profile.height),
          weight_pounds: profile.weight,
          college: profile.person.collegeNames.length
            ? profile.person.collegeNames[0]
            : null,
          nfl_draft_year: year,
          esb_player_id: profile.person.esbId,
          jersey_number: 0,
          date_of_birth: '0000-00-00', // TODO - ideally required
          ...combine_data,
          hometown
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
        update: { ...combine_data, hometown },
        source: 'combine'
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
  current_timestamp = new Date()
}) => {
  const token = await nfl.get_session_token_v3()
  const min_year = 2006
  const max_year = current_season.year

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
    const argv = initialize_cli()
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

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default import_players_from_combine_profiles_for_year
