import debug from 'debug'
import { current_season } from '#constants'

const log = debug('handle-season-args-for-script')

// The callbacks below are handed `season_year` and `season_type`, matching the
// physical nfl_games columns. `week` keeps its bare name because no column was
// ever renamed to season_week. `argv.*` and `current_season.*` are the CLI and
// constants namespaces and keep their own spellings; this helper is the
// boundary that translates between them.
export default async function handle_season_args_for_script({
  argv,
  script_name,
  script_function,
  year_query,
  default_season_year = current_season.year,
  default_week = current_season.week,
  script_args = {},
  week_query = null,
  post_year_function = null,
  post_all_function = null,
  season_type = 'REG',
  season_only = false
}) {
  // Every `script_function` return value, in invocation order. This helper used
  // to discard them, which made a script's outcome unreachable from its own
  // `main()`: an importer that reports upstream published nothing by returning
  // `{ skipped: true }` had no way to tell `report_job` about it, so a run that
  // wrote nothing and a run that worked produced identical ledger rows. Callers
  // that ignore the return value are unaffected.
  const results = []

  const run_script_function = async (args) => {
    const result = await script_function(args)
    results.push(result)
    return result
  }

  const process_year_week = async ({
    season_year,
    week,
    current_season_type
  }) => {
    await run_script_function({
      season_year,
      week,
      season_type: current_season_type,
      ...script_args
    })
  }

  const process_year = async ({ season_year, current_season_type }) => {
    if (current_season_type === 'ALL') {
      // Process all season types
      for (const type of ['PRE', 'REG', 'POST']) {
        await process_year({ season_year, current_season_type: type })
      }
      return
    }

    if (season_only) {
      // For season-only scripts, call the script function once per year
      await run_script_function({
        season_year,
        season_type: current_season_type,
        ...script_args
      })
    } else {
      // For week-based scripts, iterate through weeks
      if (!week_query) {
        throw new Error('week_query is required')
      }

      const weeks = await week_query({
        season_year,
        season_type: current_season_type
      })
      for (const { week } of weeks) {
        await process_year_week({
          season_year,
          week,
          current_season_type
        })
      }
    }

    if (post_year_function) {
      await post_year_function({
        season_year,
        season_type: current_season_type,
        ...script_args
      })
    }
  }

  if (argv.all) {
    const year_rows = await year_query({ season_type })

    let season_years = year_rows.map((r) => r.season_year)
    if (argv.start) {
      season_years = season_years.filter(
        (season_year) => season_year >= argv.start
      )
    }
    if (argv.end) {
      season_years = season_years.filter(
        (season_year) => season_year <= argv.end
      )
    }

    log(`${script_name}: processing ${season_years.length} years`)

    for (const season_year of season_years) {
      if (season_type === 'ALL') {
        for (const type of ['PRE', 'REG', 'POST']) {
          await process_year({ season_year, current_season_type: type })
        }
      } else {
        await process_year({ season_year, current_season_type: season_type })
      }
    }
  } else if (argv.year && argv.week) {
    await process_year_week({
      season_year: argv.year,
      week: argv.week,
      current_season_type: season_type
    })
  } else if (argv.year) {
    await process_year({
      season_year: argv.year,
      current_season_type: season_type
    })
  } else if (argv.week) {
    if (season_only) {
      // For season-only scripts, ignore week and process the year
      await run_script_function({
        season_year: default_season_year,
        season_type,
        ...script_args
      })
    } else {
      await process_year_week({
        season_year: default_season_year,
        week: argv.week,
        current_season_type: season_type
      })
    }

    if (post_year_function) {
      await post_year_function({
        season_year: default_season_year,
        season_type,
        ...script_args
      })
    }
  } else {
    if (season_only) {
      // For season-only scripts, process the default year
      await run_script_function({
        season_year: default_season_year,
        season_type,
        ...script_args
      })
    } else {
      await process_year_week({
        season_year: default_season_year,
        week: default_week,
        current_season_type: season_type
      })
    }

    if (post_year_function) {
      await post_year_function({
        season_year: default_season_year,
        season_type,
        ...script_args
      })
    }
  }

  if (post_all_function) {
    await post_all_function({ ...script_args })
  }

  return results
}
