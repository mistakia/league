#!/usr/bin/env node

import { current_season } from '#constants'

console.log('=== Current Season Information ===\n')

console.log('Basic Info:')
console.log(`  Year: ${current_season.year}`)
console.log(`  Week: ${current_season.week}`)
console.log(`  Fantasy Season Week: ${current_season.fantasy_season_week}`)
console.log(`  NFL Season Week: ${current_season.nfl_seas_week}`)
console.log(`  NFL Season Type: ${current_season.nfl_seas_type}`)
console.log(`  Last Week with Stats: ${current_season.last_week_with_stats}`)
console.log(`  Stats Season Year: ${current_season.stats_season_year}`)

console.log('\nSeason Status:')
console.log(`  Is Offseason: ${current_season.isOffseason}`)
console.log(`  Is Regular Season: ${current_season.isRegularSeason}`)
console.log(`  Is Waiver Period: ${current_season.isWaiverPeriod}`)

console.log('\nCurrent Time:')
console.log(
  `  Now: ${current_season.now.format('YYYY-MM-DD HH:mm:ss')} (${current_season.now.format('dddd')})`
)

console.log('\nSeason Dates:')
console.log(
  `  Regular Season Start: ${current_season.regular_season_start.format('YYYY-MM-DD HH:mm:ss')}`
)
console.log(
  `  Opening Day: ${current_season.openingDay.format('YYYY-MM-DD HH:mm:ss')}`
)
console.log(`  End: ${current_season.end.format('YYYY-MM-DD HH:mm:ss')}`)
console.log(
  `  Offseason: ${current_season.offseason.format('YYYY-MM-DD HH:mm:ss')}`
)

console.log('\nWeek Configuration:')
console.log(`  Final Fantasy Week: ${current_season.finalWeek}`)
console.log(`  NFL Final Week: ${current_season.nflFinalWeek}`)
console.log(
  `  Regular Season Final Week: ${current_season.regularSeasonFinalWeek}`
)
console.log(`  Wildcard Week: ${current_season.wildcardWeek}`)

console.log('\nWeek End:')
console.log(
  `  Current Week End: ${current_season.week_end.format('YYYY-MM-DD HH:mm:ss')}`
)

console.log('\n=== End ===')
