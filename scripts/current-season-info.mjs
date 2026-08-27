#!/usr/bin/env node

import { current_season } from '#constants'
import {
  current_nfl_week_identifier,
  last_completed_nfl_week_identifier
} from '#libs-shared/nfl-week-identifier.mjs'

console.log('=== Current Season Information ===\n')

console.log('Basic Info:')
console.log(`  Year: ${current_season.year}`)
console.log(`  Week: ${current_season.week}`)
console.log(`  Fantasy Season Week: ${current_season.fantasy_season_week}`)
console.log(`  NFL Season Week: ${current_season.nfl_seas_week}`)
console.log(`  NFL Season Type: ${current_season.nfl_seas_type}`)
console.log(`  Last Week with Stats: ${current_season.last_week_with_stats}`)

// The pair, side by side. They are EQUAL during the season and a whole season
// apart for the six offseason months, so printing one without the other is how
// a caller reaches for the wrong half and never notices.
console.log('\nCurrent / Last Completed:')
console.log(
  `  Season:  ${current_season.year}  |  ${current_season.last_completed_season_year}`
)
console.log(
  `  Week:    ${current_nfl_week_identifier()}  |  ${last_completed_nfl_week_identifier()}`
)
console.log('  (left = in play or next up, right = has results)')

console.log('\nSeason Status:')
console.log(`  Is Offseason: ${current_season.is_offseason}`)
console.log(`  Is Regular Season: ${current_season.is_regular_season}`)
console.log(`  Is Waiver Period: ${current_season.is_waiver_period}`)

console.log('\nCurrent Time:')
console.log(
  `  Now: ${current_season.now.format('YYYY-MM-DD HH:mm:ss')} (${current_season.now.format('dddd')})`
)

console.log('\nSeason Dates:')
console.log(
  `  Regular Season Start: ${current_season.regular_season_start.format('YYYY-MM-DD HH:mm:ss')}`
)
console.log(
  `  Opening Day: ${current_season.opening_day.format('YYYY-MM-DD HH:mm:ss')}`
)
console.log(`  End: ${current_season.end.format('YYYY-MM-DD HH:mm:ss')}`)
console.log(
  `  Offseason: ${current_season.offseason.format('YYYY-MM-DD HH:mm:ss')}`
)

console.log('\nWeek Configuration:')
console.log(`  Final Fantasy Week: ${current_season.final_week}`)
console.log(`  NFL Final Week: ${current_season.nfl_final_week}`)
console.log(
  `  Regular Season Final Week: ${current_season.regular_season_final_week}`
)
console.log(`  Wildcard Week: ${current_season.wildcard_week}`)

console.log('\nWeek End:')
console.log(
  `  Current Week End: ${current_season.week_end.format('YYYY-MM-DD HH:mm:ss')}`
)

console.log('\n=== End ===')
