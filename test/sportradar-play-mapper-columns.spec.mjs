/* global describe before it */
import * as chai from 'chai'

import db from '#db'
import {
  map_field_goal_stats,
  map_punt_stats,
  map_kickoff_stats,
  map_return_stats,
  map_penalty_stats,
  map_play_details
} from '#libs-server/sportradar/sportradar-stats-mappers.mjs'
import { SPORTRADAR_EXCLUSIVE_FIELDS } from '#libs-server/sportradar/sportradar-exclusive-fields.mjs'

const expect = chai.expect

// Every key these mappers produce becomes a key of the `update` object handed to
// `update_play`, which diffs it against the play row and keeps only deep-diff
// edits of kind 'E'. A key naming a column that does not exist is kind 'N', so
// it is dropped BEFORE the update statement is built: no 42703, no failing test,
// no log line -- the column simply stops being written and the importer exits 0.
//
// That makes the ordinary rename oracles useless here. `check-knex-column-resolution`
// cannot see these keys because the mapper builds a plain object and names no
// table; a column-existence grep cannot see the two that are built by template
// literal (`sack_${idx}_sportradar_player_id`,
// `tackle_for_loss_${idx}_sportradar_player_id`). The only thing that separates a
// live mapper from a silently-dead one is EXECUTING it and resolving the keys it
// actually emits against the schema, which is what this spec does.

const stub_player = { pid: 'TEST-PLAY-000001', gsisid: '00-0000001' }
const resolve_player = async () => stub_player
const player_ref = (id, role) => ({ id, name: 'Test Player', role })
const team_ref = { id: 'sr:team:1', alias: 'KC' }

// Two sack players and two tackle-for-loss players, so the numbered forms are
// exercised at both indices rather than only at 1.
const build_details = () => [
  {
    category: 'forced_fumble',
    team: team_ref,
    players: [player_ref('sr:player:ff1')]
  },
  {
    category: 'own_fumble_recovery',
    team: team_ref,
    players: [player_ref('sr:player:fr1')]
  },
  {
    category: 'sack',
    team: team_ref,
    // The mapper filters sack participants on role, so an unroled player never
    // reaches the numbered branch this spec exists to cover.
    players: [
      player_ref('sr:player:s1', 'sack'),
      player_ref('sr:player:s2', 'sack')
    ]
  }
]

const build_statistics = () => [
  {
    stat_type: 'defense',
    tlost: 1,
    team: team_ref,
    player: player_ref('sr:player:tfl1')
  },
  {
    stat_type: 'defense',
    tlost: 1,
    team: team_ref,
    player: player_ref('sr:player:tfl2')
  }
]

const collect_mapped_keys = async () => {
  const keys = new Set()
  const absorb = (mapped) => Object.keys(mapped).forEach((k) => keys.add(k))

  absorb(
    await map_field_goal_stats({
      field_goal_stats: {
        attempt: 1,
        yards: 42,
        team: team_ref,
        kicker: player_ref('sr:player:k1')
      },
      resolve_player
    })
  )
  absorb(
    await map_punt_stats({
      punt_stats: {
        yards: 45,
        hang_time: 4.2,
        team: team_ref,
        punter: player_ref('sr:player:p1')
      },
      resolve_player
    })
  )
  absorb(
    await map_kickoff_stats({
      kick_stats: {
        yards: 65,
        team: team_ref,
        player: player_ref('sr:player:k2')
      },
      resolve_player
    })
  )
  absorb(
    await map_return_stats({
      return_stats: {
        yards: 20,
        team: team_ref,
        returner: player_ref('sr:player:r1')
      },
      resolve_player
    })
  )
  absorb(
    await map_penalty_stats({
      penalty_stats: [
        {
          team: team_ref,
          player: player_ref('sr:player:pen1'),
          yards: 10
        }
      ],
      resolve_player
    })
  )
  absorb(
    await map_play_details({
      details: build_details(),
      statistics: build_statistics(),
      resolve_player,
      get_team_abbrev: () => 'KC'
    })
  )

  return keys
}

describe('sportradar play mappers', function () {
  this.timeout(30000)

  let nfl_plays_columns

  before(async () => {
    nfl_plays_columns = new Set(Object.keys(await db('nfl_plays').columnInfo()))
  })

  it('every key the mappers emit is a real nfl_plays column', async () => {
    const keys = await collect_mapped_keys()

    // Positive control: an oracle over an empty key set would pass vacuously,
    // and a mapper signature change is exactly what would empty it.
    expect(keys.size).to.be.at.least(
      20,
      'mappers produced almost no keys -- the fixtures no longer reach the mapping branches, so this spec is asserting nothing'
    )

    const unresolved = [...keys].filter((k) => !nfl_plays_columns.has(k))
    expect(unresolved).to.deep.equal(
      [],
      `mapper keys naming no nfl_plays column: ${unresolved.join(', ')}`
    )
  })

  it('emits the conformed sportradar player-id columns, including the numbered forms', async () => {
    const keys = await collect_mapped_keys()

    // Pinned by name because the numbered forms are built by template literal:
    // a rename that misses the template leaves a well-formed key naming nothing,
    // and the assertion above would catch it only while these branches still
    // fire. Naming them makes that coverage explicit rather than incidental.
    const expected = [
      'kicker_sportradar_player_id',
      'punter_sportradar_player_id',
      'returner_sportradar_player_id',
      'penalty_sportradar_player_id',
      'fumble_forced_1_sportradar_player_id',
      'fumble_recovered_1_sportradar_player_id',
      'sack_1_sportradar_player_id',
      'sack_2_sportradar_player_id',
      'tackle_for_loss_1_sportradar_player_id',
      'tackle_for_loss_2_sportradar_player_id'
    ]

    for (const column of expected) {
      expect(keys.has(column), `mapper never emitted ${column}`).to.equal(true)
    }
  })

  it('SPORTRADAR_EXCLUSIVE_FIELDS names only real nfl_plays columns', () => {
    // The exclusive-field list gates whether the importer is allowed to write a
    // column at all. A stale entry here does not throw -- it just stops matching,
    // so the field silently loses its exclusive treatment.
    expect(SPORTRADAR_EXCLUSIVE_FIELDS.size).to.be.at.least(10)

    const unresolved = [...SPORTRADAR_EXCLUSIVE_FIELDS].filter(
      (field) => !nfl_plays_columns.has(field)
    )
    expect(unresolved).to.deep.equal(
      [],
      `exclusive fields naming no nfl_plays column: ${unresolved.join(', ')}`
    )
  })
})
