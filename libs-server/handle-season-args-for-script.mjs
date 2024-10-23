import debug from 'debug'
import { constants } from '#libs-shared'

const log = debug('handle-season-args-for-script')

export default async function handle_season_args_for_script({
  argv,
  script_name,
  script_function,
  year_query,
  default_year = constants.season.year,
  script_args = {},
  week_query = null,
  post_year_function = null,
  post_all_function = null,
  seas_type = 'REG'
}) {
  const process_year_week = async ({ year, week, current_seas_type }) => {
    await script_function({
      year,
      week,
      seas_type: current_seas_type,
      ...script_args
    })
  }

  const process_year = async ({ year }) => {
    if (week_query) {
      if (seas_type === 'ALL') {
        for (const type of ['PRE', 'REG', 'POST']) {
          const weeks = await week_query({ year, seas_type: type })
          for (const { week } of weeks) {
            await process_year_week({ year, week, current_seas_type: type })
          }
        }
      } else {
        const weeks = await week_query({ year, seas_type })
        for (const { week } of weeks) {
          await process_year_week({
            year,
            week,
            current_seas_type: seas_type
          })
        }
      }
    } else {
      if (seas_type === 'ALL') {
        for (const type of ['PRE', 'REG', 'POST']) {
          await process_year_week({
            year,
            week: null,
            current_seas_type: type
          })
        }
      } else {
        await process_year_week({
          year,
          week: null,
          current_seas_type: seas_type
        })
      }
    }

    if (post_year_function) {
      await post_year_function({ year, seas_type, ...script_args })
    }
  }

  if (argv.all) {
    const results = await year_query({ seas_type })

    let years = results.map((r) => r.year)
    if (argv.start) {
      years = years.filter((year) => year >= argv.start)
    }
    if (argv.end) {
      years = years.filter((year) => year <= argv.end)
    }

    log(`${script_name}: processing ${years.length} years`)

    for (const year of years) {
      await process_year({ year })
    }
  } else if (argv.year) {
    await process_year({ year: argv.year })
  } else if (argv.week) {
    await process_year_week({
      year: default_year,
      week: argv.week,
      current_seas_type: seas_type
    })

    if (post_year_function) {
      await post_year_function({
        year: default_year,
        seas_type,
        ...script_args
      })
    }
  } else {
    await process_year_week({
      year: default_year,
      week: null,
      current_seas_type: seas_type
    })

    if (post_year_function) {
      await post_year_function({
        year: default_year,
        seas_type,
        ...script_args
      })
    }
  }

  if (post_all_function) {
    await post_all_function({ ...script_args })
  }
}
