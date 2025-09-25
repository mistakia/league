#!/usr/bin/env node

import { season } from '../libs-shared/constants.mjs'

console.log('=== Current Season Information ===\n')

console.log('Basic Info:')
console.log(`  Year: ${season.year}`)
console.log(`  Week: ${season.week}`)
console.log(`  Fantasy Season Week: ${season.fantasy_season_week}`)
console.log(`  NFL Season Week: ${season.nfl_seas_week}`)
console.log(`  NFL Season Type: ${season.nfl_seas_type}`)
console.log(`  Last Week with Stats: ${season.last_week_with_stats}`)
console.log(`  Stats Season Year: ${season.stats_season_year}`)

console.log('\nSeason Status:')
console.log(`  Is Offseason: ${season.isOffseason}`)
console.log(`  Is Regular Season: ${season.isRegularSeason}`)
console.log(`  Is Waiver Period: ${season.isWaiverPeriod}`)

console.log('\nCurrent Time:')
console.log(
  `  Now: ${season.now.format('YYYY-MM-DD HH:mm:ss')} (${season.now.format('dddd')})`
)

console.log('\nSeason Dates:')
console.log(
  `  Regular Season Start: ${season.regular_season_start.format('YYYY-MM-DD HH:mm:ss')}`
)
console.log(`  Opening Day: ${season.openingDay.format('YYYY-MM-DD HH:mm:ss')}`)
console.log(`  End: ${season.end.format('YYYY-MM-DD HH:mm:ss')}`)
console.log(`  Offseason: ${season.offseason.format('YYYY-MM-DD HH:mm:ss')}`)

console.log('\nWeek Configuration:')
console.log(`  Final Week: ${season.finalWeek}`)
console.log(`  NFL Final Week: ${season.nflFinalWeek}`)
console.log(`  Regular Season Final Week: ${season.regularSeasonFinalWeek}`)
console.log(`  Wildcard Week: ${season.wildcardWeek}`)

console.log('\nWeek End:')
console.log(
  `  Current Week End: ${season.week_end.format('YYYY-MM-DD HH:mm:ss')}`
)

console.log('\n=== End ===')
