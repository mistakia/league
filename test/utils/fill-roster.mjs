import db from '#db'
import { constants, Roster } from '#libs-shared'
import { getRoster, getLeague } from '#libs-server'
import selectPlayer from './select-player.mjs'
import addPlayer from './add-player.mjs'

export default async function ({
  leagueId,
  teamId,
  excludeIR = false,
  exclude_pids = []
}) {
  const league = await getLeague({ lid: leagueId })
  const rosterRow = await getRoster({ tid: teamId })
  let roster = new Roster({ roster: rosterRow, league })

  while (!roster.isFull) {
    const players = await db('rosters_players')
      .join('rosters', 'rosters_players.rid', 'rosters.uid')
      .where({
        lid: leagueId,
        week: constants.season.week,
        year: constants.season.year
      })
    const existing_pids = players.map((p) => p.pid)
    const player = await selectPlayer({
      exclude_pids: [...existing_pids, ...exclude_pids]
    })
    const hasSlot = roster.hasOpenBenchSlot(player.pos1)
    if (hasSlot) {
      await addPlayer({
        leagueId,
        teamId,
        player
      })
    }

    const rosterRow = await getRoster({ tid: teamId })
    roster = new Roster({ roster: rosterRow, league })
  }

  while (roster.hasOpenPracticeSquadSlot()) {
    const players = await db('rosters_players')
      .join('rosters', 'rosters_players.rid', 'rosters.uid')
      .where({
        lid: leagueId,
        week: constants.season.week,
        year: constants.season.year
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
      slot: constants.slots.PS
    })

    const rosterRow = await getRoster({ tid: teamId })
    roster = new Roster({ roster: rosterRow, league })
  }

  if (excludeIR) {
    return
  }

  while (roster.hasOpenInjuredReserveSlot()) {
    const players = await db('rosters_players')
      .join('rosters', 'rosters_players.rid', 'rosters.uid')
      .where({
        lid: leagueId,
        week: constants.season.week,
        year: constants.season.year
      })
    const existing_pids = players.map((p) => p.pid)
    const player = await selectPlayer({
      exclude_pids: [...existing_pids, ...exclude_pids]
    })
    await addPlayer({
      leagueId,
      teamId,
      player,
      slot: constants.slots.IR
    })

    const rosterRow = await getRoster({ tid: teamId })
    roster = new Roster({ roster: rosterRow, league })
  }
}
