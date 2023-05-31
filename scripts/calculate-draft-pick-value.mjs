import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { groupBy, median } from '#common'
import { isMain, getLeague } from '#utils'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('calculate-draft-pick-value')
debug.enable('calculate-draft-pick-value')

const calculateDraftPickValue = async ({ league_format_hash } = {}) => {
  if (!league_format_hash) {
    throw new Error('missing league_format_hash')
  }

  log(`calculating draft pick value for league format hash: ${league_format_hash}`)

  const inserts = []

  const league_format_player_careerlogs = await db(
    'league_format_player_careerlogs'
  )
    .where({ league_format_hash })
    .where('draft_rank', '>=', 1)

  const league_format_player_careerlogs_by_draft_rank = groupBy(
    league_format_player_careerlogs,
    'draft_rank'
  )
  for (const rank in league_format_player_careerlogs_by_draft_rank) {
    const players = league_format_player_careerlogs_by_draft_rank[rank]
    inserts.push({
      league_format_hash,
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
    await db('league_format_draft_pick_value')
      .insert(inserts)
      .onConflict()
      .merge()
  }
}

const main = async () => {
  let error
  try {
    const lid = 1
    const league = await getLeague({ lid })
    const { league_format_hash } = league
    await calculateDraftPickValue({ league_format_hash })
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
