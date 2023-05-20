import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#common'
import { isMain, getLeague } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-league-season-teams')
debug.enable('generate-league-season-teams')

const generate_league_season_teams = async ({
  lid,
  year = constants.season.year,
  overwrite = false
}) => {
  const teams_exist = await db('teams').where({ lid, year }).first()
  if (teams_exist && !overwrite) {
    log(`teams already exist for ${lid} ${year}`)
    return
  }

  const league = await getLeague({ lid, year })

  const previous_year = year - 1
  const teams = await db('teams').where({ lid, year: previous_year })
  const team_stats = await db('team_stats').where({ lid, year: previous_year })

  // draft order is determined by draft order index for teams that didnt make the post season
  const draft_order_non_post_season = team_stats
    .filter((t) => !t.post_season_finish)
    .sort((a, b) => a.doi - b.doi)
    .map((t) => t.tid)

  // draft order is determined by post season finish for teams that made the post season
  const draft_order_post_season = team_stats
    .filter((t) => t.post_season_finish)
    .sort((a, b) => b.post_season_finish - a.post_season_finish)
    .map((t) => t.tid)

  const draft_order = [
    ...draft_order_non_post_season,
    ...draft_order_post_season
  ]

  const team_inserts = []

  for (let i = 0; i < draft_order.length; i++) {
    const tid = draft_order[i]
    const team = teams.find((t) => t.uid === tid)

    team_inserts.push({
      ...team,

      year,

      // reset team stats
      wo: i + 1,
      do: i + 1,
      cap: league.cap,
      faab: league.faab
    })
  }

  if (team_inserts.length) {
    await db('teams')
      .insert(team_inserts)
      .onConflict(['lid', 'year', 'tid'])
      .merge()
    log(`generated ${team_inserts.length} teams for lid ${lid} year ${year}`)
  }
}

const main = async () => {
  let error
  try {
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

export default generate_league_season_teams
