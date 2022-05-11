import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#common'
import { isMain } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-rosters')
debug.enable('generate-rosters')

const run = async ({ nextSeason = argv.season } = {}) => {
  // do not run once season is over unless generating roster for next season
  if (constants.season.week >= constants.season.finalWeek && !nextSeason) {
    log('season over')
    return
  }

  // get list of hosted leagues
  const leagues = await db('leagues')

  const nextWeek = nextSeason ? 0 : constants.season.week + 1
  const nextYear = nextSeason
    ? constants.season.week === 0
      ? constants.season.year
      : constants.season.year + 1
    : constants.season.year
  const previousWeek = nextSeason
    ? constants.season.finalWeek
    : constants.season.week
  const previousYear = nextSeason ? nextYear - 1 : constants.season.year

  log(
    `Generating rosters for ${nextYear} Week ${nextWeek} using ${previousYear} Week ${previousWeek}`
  )

  for (const league of leagues) {
    // get latest rosters for league
    const rosters = await db('rosters').where({
      lid: league.uid,
      year: previousYear,
      week: previousWeek
    })

    for (const roster of rosters) {
      // get current roster players
      const { tid, lid, uid } = roster
      const players = await db('rosters_players').where({ rid: uid })
      const currentPlayerIds = players.map((p) => p.player)

      // get roster id
      const rosterData = {
        tid,
        lid,
        week: nextWeek,
        year: nextYear
      }
      const rosterRows = await db('rosters').where(rosterData)
      let rid = rosterRows.length ? rosterRows[0].uid : null
      if (!rid) {
        const newRoster = await db('rosters').insert(rosterData)
        rid = newRoster[0]
      }

      // insert any missing players & remove excess players
      const existingPlayers = await db('rosters_players').where({ rid })
      const existingPlayerIds = existingPlayers.map((p) => p.player)
      const matching = players.filter((p) =>
        existingPlayerIds.includes(p.player)
      )
      const missing = players.filter(
        (p) => !existingPlayerIds.includes(p.player)
      )
      const excessive = existingPlayers.filter(
        (p) => !currentPlayerIds.includes(p.player)
      )
      const inserts = missing.map((p) => ({
        rid,
        tag: p.tag,
        slot: p.slot,
        player: p.player,
        pos: p.pos
      }))

      const updates = matching.filter((p) => {
        const item = existingPlayers.find((i) => i.player === p.player)
        return item.slot !== p.slot || item.tag !== p.tag
      })

      if (inserts.length) {
        await db('rosters_players').insert(inserts)
      }

      if (excessive.length) {
        await db('rosters_players')
          .where('rid', rid)
          .whereIn(
            'player',
            excessive.map((p) => p.player)
          )
      }

      if (updates.length) {
        for (const { player, slot, tag } of updates) {
          await db('rosters_players')
            .where({ rid, player })
            .update({ slot, tag })
        }
      }
    }
  }
}

const main = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.GENERATE_ROSTERS,
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
