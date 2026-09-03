import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { current_season } from '#constants'
import { is_main, report_job, throw_if_shortfall } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'
import { NGS_API_URL } from '#private/libs-server/ngs.mjs'
import { fetch_with_retry } from '#libs-server/proxy-manager.mjs'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'
import {
  select_game_inserts,
  upsert_game,
  nfl_games_shortfalls
} from '#libs-server/nfl-games-ngs.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import-games-ngs')
enable_debug_namespaces('import-games-ngs')

const run = async ({
  season_year = current_season.year,
  collector = null
} = {}) => {
  log(`Importing games for ${season_year}`)

  const result = {
    games_processed: 0,
    games_updated: 0,
    games_skipped_missing_esbid: 0,
    games_skipped_missing_season: 0,
    games_skipped_malformed: 0,
    games_failed: 0
  }

  const url = `${NGS_API_URL}/league/schedule?season=${season_year}`

  let data
  try {
    data = await fetch_with_retry({
      url,
      headers: {
        referer: 'https://nextgenstats.nfl.com/'
      },
      use_proxy: true,
      response_type: 'json'
    })
  } catch (error) {
    if (collector) {
      collector.add_error(error, { season_year, context: 'fetch_schedule' })
    }
    throw error
  }

  // Rows RECEIVED from the feed. The floor below reads this rather than the
  // number we go on to insert, because it exists to catch an empty or
  // truncated payload -- a distinct failure from a row we decline to write.
  result.games_processed = data.length

  const {
    inserts,
    skipped_missing_esbid,
    skipped_missing_season,
    skipped_malformed
  } = select_game_inserts(data)
  result.games_skipped_missing_esbid = skipped_missing_esbid
  result.games_skipped_missing_season = skipped_missing_season
  result.games_skipped_malformed = skipped_malformed

  /*
    ROW BY ROW, deliberately, and not in chunks. A single multi-row insert
    aborts whole on one bad row and loses the entire slate. Chunking is not
    sufficient either: without a per-chunk catch the failing chunk still aborts
    and every later chunk is skipped, and WITH one it converts a loud failure
    into a silent partial import -- which the per-year floor cannot see, because
    that floor reads the count of rows RECEIVED.
  */
  for (const insert of inserts) {
    try {
      await upsert_game(insert)
      result.games_updated += 1
    } catch (error) {
      result.games_failed += 1
      log(`failed to save game ${insert.esbid}: ${error.message}`)
      if (collector) {
        collector.add_error(error, {
          season_year,
          esbid: insert.esbid,
          context: 'insert_game'
        })
      }
    }
  }

  log(
    `saved data for ${result.games_updated} games (${result.games_failed} failed, ${result.games_skipped_missing_esbid} skipped)`
  )

  if (collector) {
    collector.set_stats({
      games_processed: result.games_processed,
      games_updated: result.games_updated,
      games_skipped_missing_esbid: result.games_skipped_missing_esbid,
      games_skipped_missing_season: result.games_skipped_missing_season,
      games_skipped_malformed: result.games_skipped_malformed,
      games_failed: result.games_failed
    })
  }

  return result
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const season_year = argv.year
    const result = await run({ season_year })
    const season = season_year ?? current_season.year

    // Every reason the run fell short, computed in libs-server so it is
    // reachable by a spec -- see nfl_games_shortfalls for why that matters.
    const shortfalls = nfl_games_shortfalls({ season_year: season, result })

    throw_if_shortfall(shortfalls.length ? shortfalls.join('; ') : null)
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_NFL_GAMES_NGS,
    error
  })

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default run
