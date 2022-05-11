import db from '#db'
import { constants, Roster } from '#common'
import { getRoster, getLeague } from '#utils'
import selectPlayer from './select-player.mjs'
import addPlayer from './add-player.mjs'

export default async function ({ leagueId, teamId, excludeIR = false }) {
  const league = await getLeague(leagueId)
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
    const excludePlayerIds = players.map((p) => p.player)
    const player = await selectPlayer({ exclude: excludePlayerIds })
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
    const excludePlayerIds = players.map((p) => p.player)
    const player = await selectPlayer({
      exclude: excludePlayerIds,
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
    const excludePlayerIds = players.map((p) => p.player)
    const player = await selectPlayer({ exclude: excludePlayerIds })
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
