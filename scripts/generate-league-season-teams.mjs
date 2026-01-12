import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season } from '#constants'
import { is_main, getLeague } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('generate-league-season-teams')
debug.enable('generate-league-season-teams')

/**
 * Generate team records for a new season with draft order based on previous year standings
 *
 * Creates teams for `year` using:
 * - Team roster from previous year (year - 1)
 * - League settings (cap, faab) from league_settings_year or previous year
 * - Draft order determined by previous year's final standings
 *
 * @param {Object} params
 * @param {number} params.lid - League ID
 * @param {number} [params.year] - Target year to create teams for (defaults to current season)
 * @param {number} [params.league_settings_year] - Year to read league settings from (cap, faab).
 *   When called from finalize-season, this is the championship year (not next year).
 *   Defaults to year - 1 if not provided.
 * @param {boolean} [params.overwrite] - Overwrite existing teams if present (default: false)
 * @returns {Promise<void>}
 */
const generate_league_season_teams = async ({
  lid,
  year = current_season.year,
  league_settings_year,
  overwrite = false
}) => {
  const teams_exist = await db('teams').where({ lid, year }).first()
  if (teams_exist && !overwrite) {
    log(`teams already exist for ${lid} ${year}`)
    return
  }

  const previous_year = year - 1
  // Use explicit league_settings_year if provided, otherwise fall back to previous_year
  const settings_year = league_settings_year ?? previous_year
  const league = await getLeague({ lid, year: settings_year })
  const teams = await db('teams').where({ lid, year: previous_year })
  const league_team_seasonlogs = await db('league_team_seasonlogs').where({
    lid,
    year: previous_year
  })

  // draft order is determined by draft order index for teams that didnt make the post season
  const draft_order_non_post_season = league_team_seasonlogs
    .filter((t) => !t.post_season_finish)
    .sort((a, b) => a.doi - b.doi)
    .map((t) => t.tid)

  // draft order is determined by post season finish for teams that made the post season
  const draft_order_post_season = league_team_seasonlogs
    .filter((t) => t.post_season_finish)
    .sort((a, b) => b.post_season_finish - a.post_season_finish)
    .map((t) => t.tid)

  const draft_order = [
    ...draft_order_non_post_season,
    ...draft_order_post_season
  ]

  const team_inserts = []
  const users_teams_inserts = []

  for (let i = 0; i < draft_order.length; i++) {
    const team_id = draft_order[i]
    const team = teams.find((t) => t.uid === team_id)

    team_inserts.push({
      ...team,

      year,

      // reset team stats
      waiver_order: i + 1,
      draft_order: i + 1,
      cap: league.cap,
      faab: league.faab
    })

    // Get user associations for this team from previous year
    const previous_users_teams = await db('users_teams').where({
      tid: team_id,
      year: previous_year
    })

    // Create new users_teams entries for the new year
    for (const user_team of previous_users_teams) {
      users_teams_inserts.push({
        userid: user_team.userid,
        tid: team_id,
        year
      })
    }
  }

  if (team_inserts.length) {
    await db('teams').insert(team_inserts).onConflict(['year', 'uid']).merge()
    log(`generated ${team_inserts.length} teams for lid ${lid} year ${year}`)
  }

  if (users_teams_inserts.length) {
    await db('users_teams')
      .insert(users_teams_inserts)
      .onConflict(['userid', 'tid', 'year'])
      .merge()
    log(
      `generated ${users_teams_inserts.length} users_teams associations for lid ${lid} year ${year}`
    )
  }
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const lid = argv.lid
    const year = argv.year
    if (!lid) {
      console.log('missing --lid')
      return
    }

    await generate_league_season_teams({ lid, year, overwrite: argv.overwrite })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default generate_league_season_teams
