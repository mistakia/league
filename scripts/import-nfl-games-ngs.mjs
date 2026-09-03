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
  upsert_game
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

  const { inserts, skipped_missing_esbid, skipped_malformed } =
    select_game_inserts(data)
  result.games_skipped_missing_esbid = skipped_missing_esbid
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
      games_skipped_malformed: result.games_skipped_malformed,
      games_failed: result.games_failed
    })
  }

  return result
}

// Conservative floor for a full NFL season schedule (~285 games incl. PRE
// + REG + POST). 100 catches catastrophic API failures (empty payload,
// truncated response) while remaining flexible for partial-year edge cases.
const NFL_GAMES_FLOOR_PER_YEAR = 100

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    const season_year = argv.year
    const result = await run({ season_year })
    const season = season_year ?? current_season.year

    /*
      Three independent shortfalls, reported together rather than as a chain of
      early returns, so one run surfaces every reason it fell short instead of
      only the first.

      The row-by-row insert above means a failed row no longer aborts the run,
      so without a failure counter here a slate that mostly failed would exit 0
      with a healthy `games_processed` -- the silent partial import the chunked
      form was rejected for. `games_failed` and the skip counter are what make
      the loop's tolerance of one bad row loud rather than free.
    */
    const shortfalls = [
      result.games_processed < NFL_GAMES_FLOOR_PER_YEAR &&
        `nfl_games row-count shortfall for season_year ${season}: ${result.games_processed} games received (floor=${NFL_GAMES_FLOOR_PER_YEAR})`,
      result.games_failed > 0 &&
        `nfl_games write failures for season_year ${season}: ${result.games_failed} of ${result.games_processed} rows failed to write`,
      result.games_skipped_missing_esbid > 0 &&
        `nfl_games feed items with no gameId for season_year ${season}: ${result.games_skipped_missing_esbid} skipped, so they carry no esbid to key on`,
      result.games_skipped_malformed > 0 &&
        `nfl_games feed items that could not be parsed for season_year ${season}: ${result.games_skipped_malformed} skipped`
    ].filter(Boolean)

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
