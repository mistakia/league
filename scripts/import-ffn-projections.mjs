import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season } from '#constants'
import { is_main, find_player_row, report_job } from '#libs-server'
import config from '#config'
import { job_types } from '#libs-shared/job-constants.mjs'

const initialize_cli = () => {
  return yargs(hideBin(process.argv)).argv
}

const log = debug('import:projections')
debug.enable('import:projections,get-player')
const week = Math.max(current_season.week, 1)

const generated_at = new Date()
const getURL = (position) =>
  `https://www.fantasyfootballnerd.com/service/weekly-projections/json/${config.ffn}/${position}/${week}`
const getProjection = (stats) => ({
  passing_yards: stats.passYds,
  passing_attempts: stats.passAtt,
  passing_completions: stats.passCmp,
  passing_touchdowns: stats.passTD,
  passing_interceptions: stats.passInt,

  rushing_attempts: stats.rushAtt,
  rushing_yards: stats.rushYds,
  rushing_touchdowns: stats.rushTD,

  fumbles_lost: stats.fumblesLost,

  receptions: stats.receptions,
  receiving_yards: stats.recYds,
  receiving_touchdowns: stats.recTD,

  field_goals_made_0_19_yards: parseFloat(stats.fg) / 4,
  field_goals_made_20_29_yards: parseFloat(stats.fg) / 4,
  field_goals_made_30_39_yards: parseFloat(stats.fg) / 4,
  field_goals_made_40_49_yards: parseFloat(stats.fg) / 4,
  extra_points_made: stats.xp,

  defensive_interceptions: stats.defInt,
  defensive_forced_fumbles: stats.defFF,
  defensive_recovered_fumbles: stats.defFR,
  defensive_sacks: stats.defSack,
  defensive_touchdowns: stats.defTD,
  defensive_safeties: stats.defSafety,
  defensive_points_against: stats.defPA,
  defensive_yards_against: stats.defYdsAllowed
})

const run = async ({ dry = false } = {}) => {
  // do not pull in any projections after the season has ended
  if (current_season.week > current_season.nflFinalWeek) {
    return
  }

  const inserts = []
  const missing = []

  for (const position of ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']) {
    const url = getURL(position)
    log(url)
    const data = await fetch(url).then((res) => res.json())

    for (const item of data.Projections) {
      const params = {
        name: item.displayName,
        team: item.team,
        pos: item.position === 'DEF' ? 'DST' : item.position
      }

      let player_row
      try {
        player_row = await find_player_row(params)
        if (!player_row) {
          missing.push(params)
          continue
        }
      } catch (err) {
        console.log(err)
        missing.push(params)
        continue
      }

      const proj = getProjection(item)
      inserts.push({
        pid: player_row.pid,
        season_year: current_season.year,
        week,
        season_type: 'REG',
        sourceid: 12,
        ...proj
      })
    }
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`)
  )

  if (dry) {
    log(`${inserts.length} projections`)
    log(inserts[0])
    return
  }

  log(`Inserting ${inserts.length} projections into database`)
  await db('projections_index')
    .insert(inserts)
    .onConflict([
      'sourceid',
      'pid',
      'userid',
      'week',
      'season_year',
      'season_type'
    ])
    .merge()
  await db('projections').insert(inserts.map((i) => ({ ...i, generated_at })))
}

const main = async () => {
  let error
  try {
    const argv = initialize_cli()
    await run({ dry: argv.dry })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.PROJECTIONS_FFN,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
