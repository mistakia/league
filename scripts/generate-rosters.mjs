import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { current_season, player_tag_types } from '#constants'
import { is_main, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('generate-rosters')
debug.enable('generate-rosters')

const run = async () => {
  const is_new_season = current_season.now > current_season.end

  // do not run once season is over unless generating roster for next season
  if (current_season.week >= current_season.finalWeek && !is_new_season) {
    log('season over')
    return
  }

  // get list of hosted leagues
  const leagues = await db('leagues').where('hosted', true)

  const slice_failures = []

  const nextWeek = is_new_season ? 0 : current_season.week + 1
  const previousWeek = is_new_season
    ? current_season.finalWeek
    : current_season.week
  const previousYear = is_new_season
    ? current_season.year - 1
    : current_season.year

  log(
    `Generating rosters for ${current_season.year} Week ${nextWeek} using ${previousYear} Week ${previousWeek}`
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
        year: current_season.year
      }
      const rosterRows = await db('rosters').where(rosterData)
      let rid = rosterRows.length ? rosterRows[0].uid : null
      if (!rid) {
        const insert_query = await db('rosters')
          .insert(rosterData)
          .returning('uid')
        rid = insert_query[0].uid
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
      // Tags are season-specific (FRANCHISE/ROOKIE/RFA must be re-applied each
      // offseason). On the year-rollover insert into year=N week=0, scrub any
      // non-REGULAR tag carried forward from year=N-1's final week.
      const next_tag = (p) => (is_new_season ? player_tag_types.REGULAR : p.tag)

      const inserts = missing_pids.map((p) => ({
        rid,
        tag: next_tag(p),
        slot: p.slot,
        pid: p.pid,
        pos: p.pos,
        extensions: p.extensions, // Use previous week's value for new roster entries
        tid,
        lid,
        year: current_season.year,
        week: nextWeek
      }))

      const updates = overlapping_pids
        .map((p) => ({ ...p, tag: next_tag(p) }))
        .filter((p) => {
          const item = existing_rows.find((i) => i.pid === p.pid)
          return (
            item.slot !== p.slot || item.tag !== p.tag
            // Extensions should persist and not be compared
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
        for (const { pid, slot, tag } of updates) {
          await db('rosters_players').where({ rid, pid }).update({ slot, tag })
          // Extensions are preserved - not updated
        }
      }
    }

    // Post-write oracle: every team that had a source roster should appear in
    // rosters_players for the new (lid, year, week) slice. A shortfall means
    // some teams silently received no roster entries.
    const source_team_count = rosters.length
    if (source_team_count > 0) {
      const written_row = await db('rosters_players')
        .where({
          lid: league.uid,
          year: current_season.year,
          week: nextWeek
        })
        .countDistinct({ written: 'tid' })
        .first()
      const written_count = Number(written_row?.written || 0)
      if (written_count < source_team_count) {
        slice_failures.push(
          `row-count shortfall: written=${written_count} expected=${source_team_count} for (lid=${league.uid}, year=${current_season.year}, week=${nextWeek})`
        )
      }
    }
  }

  if (slice_failures.length > 0) {
    const err = new Error(slice_failures.join('; '))
    err.row_count_shortfall = true
    throw err
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

  await report_job({
    job_type: job_types.GENERATE_ROSTERS,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
