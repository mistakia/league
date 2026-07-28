import { Roster } from '#libs-shared'
import {
  current_season,
  fantasy_positions,
  roster_slot_types,
  transaction_types
} from '#constants'
import { getRoster, getLeague } from '#libs-server'

export default async function (knex) {
  const lid = 1
  const league = await getLeague({ lid })
  // Only the two columns this fixture reads are selected. `ORDER BY RANDOM()`
  // sorts the whole matching set, so pulling all 45 player columns through it
  // dominated the fixture's cost for no benefit.
  const players = await knex('player')
    .select('pid', 'secondary_position')
    .orderByRaw('RANDOM()')
    .whereIn('primary_position', fantasy_positions)

  await knex('rosters_players').del()

  // Each team's roster is loaded once and then advanced in memory. The previous
  // shape re-ran `getRoster` after every signing, and that query joins
  // `rosters_players` against `transactions` -- both of which this fixture is
  // actively growing -- so the cost per signing rose with the number of rows
  // already inserted. Filling twelve rosters that way took ~10s, which is what
  // pushed the specs calling this fixture past mocha's default 2000ms timeout.
  const teams = []
  for (let tid = 1; tid <= 12; tid++) {
    const roster = await getRoster({
      tid,
      week: current_season.week,
      year: current_season.year
    })
    teams.push({ roster, r: new Roster({ roster, league }) })
  }

  const roster_player_rows = []
  const transaction_rows = []
  const timestamp = Math.round(Date.now() / 1000)

  let i = 0
  while (!teams[i].r.isFull) {
    const { roster, r } = teams[i]

    let player_index = -1
    for (let p = 0; p < players.length; p++) {
      if (r.has_bench_space_for_position(players[p].secondary_position)) {
        player_index = p
        break
      }
    }

    // No remaining player fits this roster, so no further round can make
    // progress either. Stopping here keeps the loop terminating instead of
    // signing a player the roster has no room for.
    if (player_index === -1) break

    const [player] = players.splice(player_index, 1)
    const value = Math.floor(Math.random() * Math.min(r.availableCap, 60))

    r.addPlayer({
      slot: roster_slot_types.BENCH,
      pid: player.pid,
      pos: player.secondary_position,
      value
    })

    roster_player_rows.push({
      slot: roster_slot_types.BENCH,
      pid: player.pid,
      pos: player.secondary_position,
      rid: roster.uid,
      tid: roster.tid,
      lid: league.uid,
      year: current_season.year,
      week: current_season.week
    })

    for (const type of [
      transaction_types.AUCTION_BID,
      transaction_types.AUCTION_PROCESSED
    ]) {
      transaction_rows.push({
        userid: roster.tid,
        tid: roster.tid,
        lid: league.uid,
        pid: player.pid,
        type,
        value,
        week: current_season.week,
        year: current_season.year,
        timestamp
      })
    }

    i = (i + 1) % 12
  }

  await knex('rosters_players').insert(roster_player_rows)
  await knex('transactions').insert(transaction_rows)
}
