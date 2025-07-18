import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, sum, groupBy } from '#libs-shared'
import { is_main, getLeague } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-scoring-format-player-careerlogs')
debug.enable('generate-scoring-format-player-careerlogs')

const generate_scoring_format_player_careerlogs = async ({
  scoring_format_hash,
  dry = false
} = {}) => {
  if (!scoring_format_hash) {
    throw new Error('missing scoring_format_hash')
  }

  log(`generating scoring_format_player_careerlogs for ${scoring_format_hash}`)

  const inserts = []

  const player_seasons = await db('scoring_format_player_seasonlogs').where({
    scoring_format_hash
  })
  const seasons_by_pid = groupBy(player_seasons, 'pid')
  const pids = Object.keys(seasons_by_pid)
  const draft_classes_query = await db('player')
    .select('nfl_draft_year', 'pid', 'dpos')
    .whereIn('pos', constants.positions)
    .whereIn('pid', pids)
  const draft_classes = draft_classes_query.map((i) => i.nfl_draft_year)
  const sorted_pids_by_draft_classes = {}
  for (const draft_class of draft_classes) {
    const players = draft_classes_query.filter(
      (i) => i.nfl_draft_year === draft_class && i.dpos
    )
    sorted_pids_by_draft_classes[draft_class] = players
      .sort((a, b) => a.dpos - b.dpos)
      .map((i) => i.pid)
  }

  for (const pid in seasons_by_pid) {
    const draft_class = draft_classes_query.find(
      (i) => i.pid === pid
    )?.nfl_draft_year
    if (!draft_class) {
      log(`missing draft class for ${pid}`)
      continue
    }
    const seasons = seasons_by_pid[pid]

    const points = sum(seasons.map((s) => s.points))
    const games = sum(seasons.map((s) => s.games))

    const draft_rank =
      sorted_pids_by_draft_classes[draft_class].indexOf(pid) + 1

    const top_1 = seasons.filter((s) => s.points_pos_rnk <= 1).length
    const top_3 = seasons.filter((s) => s.points_pos_rnk <= 3).length
    const top_6 = seasons.filter((s) => s.points_pos_rnk <= 6).length
    const top_12 = seasons.filter((s) => s.points_pos_rnk <= 12).length
    const top_24 = seasons.filter((s) => s.points_pos_rnk <= 24).length
    const top_36 = seasons.filter((s) => s.points_pos_rnk <= 36).length

    inserts.push({
      pid,
      scoring_format_hash,

      draft_rank,

      points,
      points_per_game: points / games,
      games,
      top_1,
      top_3,
      top_6,
      top_12,
      top_24,
      top_36
    })
  }

  if (dry) {
    // Shuffle the inserts array to get random elements
    const shuffled_inserts = inserts.sort(() => 0.5 - Math.random())

    // Select 10 random inserts or all if less than 10
    const random_inserts = shuffled_inserts.slice(0, 10)

    log('10 Random Inserts:')
    for (const insert of random_inserts) {
      log(insert)
    }
    return
  }

  if (inserts.length) {
    const pids = inserts.map((p) => p.pid)
    const deleted_count = await db('scoring_format_player_careerlogs')
      .where({ scoring_format_hash })
      .whereNotIn('pid', pids)
      .del()
    log(`Deleted ${deleted_count} excess scoring player rows`)

    log(
      `updating ${inserts.length} scoring players for scoring_format ${scoring_format_hash}`
    )
    await db('scoring_format_player_careerlogs')
      .insert(inserts)
      .onConflict(['pid', 'scoring_format_hash'])
      .merge()
  }
}

const main = async () => {
  let error
  try {
    // Use CLI argument if provided, otherwise fall back to league lookup
    let scoring_format_hash = argv.scoring_format_hash

    if (!scoring_format_hash) {
      const lid = argv.lid || 1
      const league = await getLeague({ lid })
      scoring_format_hash = league.scoring_format_hash
    }

    await generate_scoring_format_player_careerlogs({
      scoring_format_hash,
      dry: argv.dry
    })
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default generate_scoring_format_player_careerlogs
