import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { isMain } from '#libs-server'

const log = debug('generate-rosters')
debug.enable('generate-rosters')

const run = async () => {
  const is_new_season = constants.season.now > constants.season.end

  // do not run once season is over unless generating roster for next season
  if (constants.season.week >= constants.season.finalWeek && !is_new_season) {
    log('season over')
    return
  }

  // get list of hosted leagues
  const leagues = await db('leagues').where('hosted', 1)

  const nextWeek = is_new_season ? 0 : constants.season.week + 1
  const previousWeek = is_new_season
    ? constants.season.finalWeek
    : constants.season.week
  const previousYear = is_new_season
    ? constants.season.year - 1
    : constants.season.year

  log(
    `Generating rosters for ${constants.season.year} Week ${nextWeek} using ${previousYear} Week ${previousWeek}`
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
      const roster_player_rows = await db('rosters_players').where({ rid: uid })
      const current_pids = roster_player_rows.map((p) => p.pid)

      // get roster id
      const rosterData = {
        tid,
        lid,
        week: nextWeek,
        year: constants.season.year
      }
      const rosterRows = await db('rosters').where(rosterData)
      let rid = rosterRows.length ? rosterRows[0].uid : null
      if (!rid) {
        const inserted_rows = await db('rosters').insert(rosterData)
        rid = inserted_rows[0]
      }

      // insert any missing players & remove excess players
      const existing_rows = await db('rosters_players').where({ rid })
      const existing_pids = existing_rows.map((p) => p.pid)
      const overlapping_pids = roster_player_rows.filter((p) =>
        existing_pids.includes(p.pid)
      )
      const missing_pids = roster_player_rows.filter(
        (p) => !existing_pids.includes(p.pid)
      )
      const extra_pids = existing_rows.filter(
        (p) => !current_pids.includes(p.pid)
      )
      const inserts = missing_pids.map((p) => ({
        rid,
        tag: p.tag,
        slot: p.slot,
        pid: p.pid,
        pos: p.pos,
        extensions: p.extensions,
        tid,
        lid,
        year: constants.season.year,
        week: nextWeek
      }))

      const updates = overlapping_pids.filter((p) => {
        const item = existing_rows.find((i) => i.pid === p.pid)
        return (
          item.slot !== p.slot ||
          item.tag !== p.tag ||
          item.extensions !== p.extensions
        )
      })

      if (inserts.length) {
        await db('rosters_players').insert(inserts)
      }

      if (extra_pids.length) {
        await db('rosters_players')
          .del()
          .where('rid', rid)
          .whereIn(
            'pid',
            extra_pids.map((p) => p.pid)
          )
      }

      if (updates.length) {
        for (const { pid, slot, tag, extensions } of updates) {
          await db('rosters_players')
            .where({ rid, pid })
            .update({ slot, tag, extensions })
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
