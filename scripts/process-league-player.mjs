import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, sum, groupBy } from '#common'
import { isMain } from '#utils'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-league-player')
debug.enable('process-league-player')

const processLeaguePlayer = async ({ lid = 1 } = {}) => {
  const inserts = []

  const player_seasons = await db('league_player_regular_seasonlogs').where({
    lid
  })
  const seasons_by_pid = groupBy(player_seasons, 'pid')

  const pids = Object.keys(seasons_by_pid)
  const draft_classes_query = await db('player')
    .select('start', 'pid', 'dpos')
    .whereIn('pos', constants.positions)
    .whereIn('pid', pids)
  const draft_classes = draft_classes_query.map((i) => i.start)
  const sorted_pids_by_draft_classes = {}
  for (const draft_class of draft_classes) {
    const players = draft_classes_query.filter(
      (i) => i.start === draft_class && i.dpos
    )
    sorted_pids_by_draft_classes[draft_class] = players
      .sort((a, b) => a.dpos - b.dpos)
      .map((i) => i.pid)
  }

  for (const pid in seasons_by_pid) {
    const draft_class = draft_classes_query.find((i) => i.pid === pid).start
    const seasons = seasons_by_pid[pid]

    const sorted = seasons.sort((a, b) => a.year - b.year)
    const first_three_seasons = sorted.slice(0, 3)
    const first_four_seasons = sorted.slice(0, 4)
    const first_five_seasons = sorted.slice(0, 5)
    const first_season = sorted.slice(0, 1)
    const second_season = sorted.slice(1, 2)
    const third_season = sorted.slice(2, 3)

    const points = sum(seasons.map((s) => s.points))
    const points_added = sum(seasons.map((s) => s.points_added))
    const games = sum(seasons.map((s) => s.games))

    const draft_rank =
      sorted_pids_by_draft_classes[draft_class].indexOf(pid) + 1

    inserts.push({
      pid,
      lid,

      draft_rank,

      starts: sum(seasons.map((s) => s.starts)),
      points,
      points_per_game: points / games,
      points_added,
      points_added_per_game: points_added / games,
      best_season_points_added_per_game: Math.max(
        ...seasons.map((s) => s.points_added_per_game)
      ),
      points_added_first_three_seas: sum(
        first_three_seasons.map((s) => s.points_added)
      ),
      points_added_first_four_seas: sum(
        first_four_seasons.map((s) => s.points_added)
      ),
      points_added_first_five_seas: sum(
        first_five_seasons.map((s) => s.points_added)
      ),
      points_added_first_seas: sum(first_season.map((s) => s.points_added)),
      points_added_second_seas: sum(second_season.map((s) => s.points_added)),
      points_added_third_seas: sum(third_season.map((s) => s.points_added)),
      games,

      top_3: seasons.filter((s) => s.pos_rnk <= 3).length,
      top_6: seasons.filter((s) => s.pos_rnk <= 6).length,
      top_12: seasons.filter((s) => s.pos_rnk <= 12).length,
      top_24: seasons.filter((s) => s.pos_rnk <= 24).length,
      top_36: seasons.filter((s) => s.pos_rnk <= 36).length
    })
  }

  if (inserts.length) {
    const pids = inserts.map((p) => p.pid)
    const deleted_count = await db('league_player')
      .where({ lid })
      .whereNotIn('pid', pids)
      .del()
    log(`Deleted ${deleted_count} excess league player rows`)

    log(`updating ${inserts.length} league players for league ${lid}`)
    await db('league_player').insert(inserts).onConflict().merge()
  }
}

const main = async () => {
  let error
  try {
    await processLeaguePlayer()
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

export default processLeaguePlayer
