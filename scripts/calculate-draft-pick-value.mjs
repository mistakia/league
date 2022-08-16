import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { groupBy, median } from '#common'
import { isMain } from '#utils'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('calculate-draft-pick-value')
debug.enable('calculate-draft-pick-value')

const calculateDraftPickValue = async ({ lid = 1 } = {}) => {
  const inserts = []

  const league_players = await db('league_player')
    .where({ lid })
    .where('draft_rank', '>=', 1)

  const league_players_by_draft_rank = groupBy(league_players, 'draft_rank')
  for (const rank in league_players_by_draft_rank) {
    const players = league_players_by_draft_rank[rank]
    inserts.push({
      lid,
      rank: Number(rank),
      median_best_season_points_added_per_game: median(
        players.map((p) => p.best_season_points_added_per_game)
      ),
      median_career_points_added_per_game: median(
        players.map((p) => p.points_added_per_game)
      )
    })
  }

  if (inserts.length) {
    log(`updated ${inserts.length} draft pick values`)
    await db('league_draft_pick_value').insert(inserts).onConflict().merge()
  }
}

const main = async () => {
  let error
  try {
    await calculateDraftPickValue()
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

export default calculateDraftPickValue