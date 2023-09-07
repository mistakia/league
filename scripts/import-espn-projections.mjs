import fetch from 'node-fetch'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { isMain, getPlayer } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import:projections')
debug.enable('import:projections,get-player')

const timestamp = new Date()

const run = async ({
  week,
  season_totals = false,
  year = constants.season.year,
  dry_run = false
}) => {
  // do not pull in any projections after the season has ended
  if (constants.season.week > constants.season.nflFinalWeek) {
    return
  }

  const URL =
    `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leaguedefaults/3?view=kona_player_info` +
    (season_totals ? '&seasonTotals=true' : '')
  log(URL)

  const headers = {
    'x-fantasy-filter': season_totals
      ? `{"players":{"filterStatsForExternalIds":{"value":[${year}]},"filterSlotIds":{"value":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,23,24]},"filterStatsForSourceIds":{"value":[1]},"useFullProjectionTable":{"value":true},"sortAppliedStatTotal":{"sortAsc":false,"sortPriority":2,"value":"10${year}"},"sortDraftRanks":{"sortPriority":3,"sortAsc":true,"value":"PPR"},"sortPercOwned":{"sortPriority":4,"sortAsc":false},"limit":900,"filterRanksForSlotIds":{"value":[0,2,4,6,17,16]},"filterStatsForTopScoringPeriodIds":{"value":2,"additionalValue":["00${year}","10${year}","02${year}"]}}}`
      : '{"players":{}}'
  }
  log(headers)

  const data = await fetch(URL, { headers }).then((res) => res.json())
  const inserts = []
  const missing = []
  for (const item of data.players) {
    const name = item.player.fullName
    const team = constants.espn.teamId[item.player.proTeamId]
    const pos = constants.espn.positionId[item.player.defaultPositionId]
    const params = { name, team, pos }
    let player_row

    // TODO cleanup
    try {
      player_row = await getPlayer(params)
      if (!player_row) {
        missing.push(params)
        continue
      }
    } catch (err) {
      console.log(err)
      missing.push(params)
      continue
    }

    const projections = item.player.stats.find(
      (s) => s.scoringPeriodId === week && s.seasonId === year
    )
    if (!projections) continue
    const data = constants.espn.stats(projections.stats)

    inserts.push({
      pid: player_row.pid,
      year,
      week,
      sourceid: constants.sources.ESPN,
      ...data
    })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) =>
    log(`could not find player: ${m.name} / ${m.pos} / ${m.team}`)
  )

  if (dry_run) {
    log(inserts[0])
    return
  }

  if (inserts.length) {
    log(`Inserting ${inserts.length} projections into database`)
    await db('projections_index').insert(inserts).onConflict().merge()
    await db('projections').insert(inserts.map((i) => ({ ...i, timestamp })))
  }
}

const main = async () => {
  let error
  try {
    const week = argv.season ? 0 : Math.max(constants.season.week, 1)
    await run({
      week,
      season_totals: argv.season,
      year: argv.year,
      dry_run: argv.dry
    })
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.PROJECTIONS_ESPN,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default run
