import db from '#db'
import { current_season, roster_slot_types } from '#constants'
import { Roster } from '#libs-shared'
import { getRoster, getLeague } from '#libs-server'
import selectPlayer from './select-player.mjs'
import addPlayer from './add-player.mjs'

export default async function ({
  leagueId,
  teamId,
  exclude_reserve_short_term = false,
  exclude_pids = [],
  userId = 0
}) {
  const league = await getLeague({ lid: leagueId })
  const rosterRow = await getRoster({ tid: teamId })
  let roster = new Roster({ roster: rosterRow, league })

  while (!roster.isFull) {
    const players = await db('rosters_players').where({
      lid: leagueId,
      week: current_season.week,
      year: current_season.year
    })
    const existing_pids = players.map((p) => p.pid)
    const player = await selectPlayer({
      exclude_pids: [...existing_pids, ...exclude_pids]
    })
    const hasSlot = roster.has_bench_space_for_position(player.pos1)
    if (hasSlot) {
      await addPlayer({
        leagueId,
        teamId,
        player,
        userId
      })
    }

    const rosterRow = await getRoster({ tid: teamId })
    roster = new Roster({ roster: rosterRow, league })
  }

  while (roster.hasOpenPracticeSquadSlot()) {
    const players = await db('rosters_players').where({
      lid: leagueId,
      week: current_season.week,
      year: current_season.year
    })
    const existing_pids = players.map((p) => p.pid)
    const player = await selectPlayer({
      exclude_pids: [...existing_pids, ...exclude_pids],
      rookie: true
    })
    await addPlayer({
      leagueId,
      teamId,
      player,
      slot: roster_slot_types.PS,
      userId
    })

    const rosterRow = await getRoster({ tid: teamId })
    roster = new Roster({ roster: rosterRow, league })
  }

  if (exclude_reserve_short_term) {
    return
  }

  while (roster.has_open_reserve_short_term_slot()) {
    const players = await db('rosters_players').where({
      lid: leagueId,
      week: current_season.week,
      year: current_season.year
    })
    const existing_pids = players.map((p) => p.pid)
    const player = await selectPlayer({
      exclude_pids: [...existing_pids, ...exclude_pids]
    })
    await addPlayer({
      leagueId,
      teamId,
      player,
      slot: roster_slot_types.RESERVE_SHORT_TERM,
      userId
    })

    const rosterRow = await getRoster({ tid: teamId })
    roster = new Roster({ roster: rosterRow, league })
  }
}
