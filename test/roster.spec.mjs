/* global describe it */
import * as chai from 'chai'

import { roster_slot_types, player_tag_types } from '#constants'
import { Roster } from '#libs-shared'

process.env.NODE_ENV = 'test'
chai.should()

describe('LIBS-SHARED Roster', function () {
  it('constructor', () => {
    const league = {
      starter_slots_qb: 1,
      starter_slots_rb: 2,
      starter_slots_wr: 2,
      starter_slots_te: 1,
      starter_slots_rb_wr_flex: 1,
      srbwrte: 1,
      srqbrbwrte: 1,
      starter_slots_wr_te_flex: 1,
      starter_slots_dst: 1,
      starter_slots_k: 1,
      bench_slot_count: 6,
      practice_squad_slot_count: 4,
      reserve_short_term_limit: 3,

      max_roster_qb: 0,
      max_roster_rb: 0,
      max_roster_wr: 0,
      max_roster_te: 0,
      max_roster_k: 3,
      max_roster_dst: 3
    }

    const roster = {
      uid: 0,
      players: []
    }

    for (let i = 0; i < 7; i++) {
      roster.players.push({
        slot: `slot${i}`,
        pid: `player${i}`,
        pos: 'RB'
      })
    }

    const r = new Roster({ roster, league })

    r.uid.should.equal(0)
    r.players.length.should.equal(7)
  })

  it('should not exceed active roster limit', () => {
    const league = {
      starter_slots_qb: 1,
      starter_slots_rb: 1,
      starter_slots_wr: 2,
      starter_slots_te: 1,
      starter_slots_rb_wr_flex: 2,
      srbwrte: 1,
      sqbrbwrte: 1,
      starter_slots_wr_te_flex: 2,
      starter_slots_dst: 1,
      starter_slots_k: 1,
      bench_slot_count: 5,
      practice_squad_slot_count: 4,
      reserve_short_term_limit: 3,

      max_roster_qb: 0,
      max_roster_rb: 0,
      max_roster_wr: 0,
      max_roster_te: 0,
      max_roster_k: 3,
      max_roster_dst: 3
    }

    const roster = {
      uid: 0,
      players: []
    }

    for (let i = 0; i < 18; i++) {
      roster.players.push({
        slot: roster_slot_types.BENCH,
        pid: `player${i}`,
        pos: 'RB'
      })
    }

    const r = new Roster({ roster, league })

    r.uid.should.equal(0)
    r.players.length.should.equal(18)
    r.isFull.should.equal(true)

    const hasSlot = r.has_bench_space_for_position('RB')
    hasSlot.should.equal(false)
  })

  it('should not exceed position limit', () => {
    const league = {
      starter_slots_qb: 0,
      starter_slots_rb: 1,
      starter_slots_wr: 1,
      starter_slots_te: 0,
      starter_slots_rb_wr_flex: 0,
      srbwrte: 1,
      sqbrbwrte: 0,
      starter_slots_wr_te_flex: 0,
      starter_slots_dst: 0,
      starter_slots_k: 0,
      bench_slot_count: 2,
      practice_squad_slot_count: 4,
      reserve_short_term_limit: 3,

      max_roster_qb: 0,
      max_roster_rb: 2,
      max_roster_wr: 0,
      max_roster_te: 0,
      max_roster_k: 3,
      max_roster_dst: 3
    }

    const roster = {
      uid: 0,
      players: []
    }

    for (let i = 0; i < 2; i++) {
      roster.players.push({
        slot: roster_slot_types.BENCH,
        pid: `player-wr-${i}`,
        pos: 'WR'
      })
    }

    for (let i = 0; i < 2; i++) {
      roster.players.push({
        slot: roster_slot_types.BENCH,
        pid: `player-rb-${i}`,
        pos: 'RB'
      })
    }

    const r = new Roster({ roster, league })

    r.uid.should.equal(0)
    r.players.length.should.equal(4)
    r.isFull.should.equal(false)

    const hasSlot = r.has_bench_space_for_position('RB')
    hasSlot.should.equal(false)
  })

  it('remove/add player + roster limit + get open slot', () => {
    const league = {
      starter_slots_qb: 0,
      starter_slots_rb: 1,
      starter_slots_wr: 1,
      starter_slots_te: 0,
      starter_slots_rb_wr_flex: 0,
      srbwrte: 1,
      sqbrbwrte: 0,
      starter_slots_wr_te_flex: 0,
      starter_slots_dst: 0,
      starter_slots_k: 0,
      bench_slot_count: 2,
      practice_squad_slot_count: 4,
      reserve_short_term_limit: 3,

      max_roster_qb: 0,
      max_roster_rb: 0,
      max_roster_wr: 0,
      max_roster_te: 0,
      max_roster_k: 3,
      max_roster_dst: 3
    }

    const roster = {
      uid: 0,
      players: []
    }

    for (let i = 0; i < 2; i++) {
      roster.players.push({
        slot: roster_slot_types.BENCH,
        pid: `player-wr-${i}`,
        pos: 'WR'
      })
    }

    for (let i = 0; i < 2; i++) {
      roster.players.push({
        slot: roster_slot_types.BENCH,
        pid: `player-rb-${i}`,
        pos: 'RB'
      })
    }

    const r = new Roster({ roster, league })

    r.uid.should.equal(0)
    r.players.length.should.equal(4)
    r.isFull.should.equal(false)

    const hasSlot = r.has_bench_space_for_position('RB')
    hasSlot.should.equal(true)

    r.addPlayer({
      slot: roster_slot_types.BENCH,
      pid: 'player-rb-add',
      pos: 'RB'
    })
    r.removePlayer('player-rb-0')

    r.players.length.should.equal(4)
    r.isFull.should.equal(false)

    const hasSlot2 = r.has_bench_space_for_position('RB')
    hasSlot2.should.equal(true)
  })

  it('addPlayer preserves extensions', () => {
    const league = {
      starter_slots_qb: 1,
      starter_slots_rb: 2,
      starter_slots_wr: 2,
      starter_slots_te: 1,
      starter_slots_rb_wr_flex: 1,
      srbwrte: 1,
      srqbrbwrte: 1,
      starter_slots_wr_te_flex: 1,
      starter_slots_dst: 1,
      starter_slots_k: 1,
      bench_slot_count: 6,
      practice_squad_slot_count: 4,
      reserve_short_term_limit: 3,
      max_roster_qb: 0,
      max_roster_rb: 0,
      max_roster_wr: 0,
      max_roster_te: 0,
      max_roster_k: 3,
      max_roster_dst: 3
    }

    const roster = {
      uid: 0,
      tid: 1,
      week: 1,
      year: 2024,
      lid: 1,
      players: []
    }

    const r = new Roster({ roster, league })

    // Add player with extensions
    r.addPlayer({
      slot: roster_slot_types.BENCH,
      pid: 'player-with-extensions',
      pos: 'RB',
      value: 10,
      extensions: 3
    })

    // Verify extensions are stored
    const player = r.get('player-with-extensions')
    player.extensions.should.equal(3)

    // Verify extensions are included in rosters_players getter
    const rosterPlayers = r.rosters_players
    const addedPlayer = rosterPlayers.find(
      (p) => p.pid === 'player-with-extensions'
    )
    addedPlayer.extensions.should.equal(3)
  })

  it('addPlayer defaults extensions to 0', () => {
    const league = {
      starter_slots_qb: 1,
      starter_slots_rb: 2,
      starter_slots_wr: 2,
      starter_slots_te: 1,
      starter_slots_rb_wr_flex: 1,
      srbwrte: 1,
      srqbrbwrte: 1,
      starter_slots_wr_te_flex: 1,
      starter_slots_dst: 1,
      starter_slots_k: 1,
      bench_slot_count: 6,
      practice_squad_slot_count: 4,
      reserve_short_term_limit: 3,
      max_roster_qb: 0,
      max_roster_rb: 0,
      max_roster_wr: 0,
      max_roster_te: 0,
      max_roster_k: 3,
      max_roster_dst: 3
    }

    const roster = {
      uid: 0,
      tid: 1,
      week: 1,
      year: 2024,
      lid: 1,
      players: []
    }

    const r = new Roster({ roster, league })

    // Add player without extensions parameter
    r.addPlayer({
      slot: roster_slot_types.BENCH,
      pid: 'player-no-extensions',
      pos: 'WR',
      value: 5
    })

    // Verify extensions default to 0
    const player = r.get('player-no-extensions')
    player.extensions.should.equal(0)

    // Verify in rosters_players getter
    const rosterPlayers = r.rosters_players
    const addedPlayer = rosterPlayers.find(
      (p) => p.pid === 'player-no-extensions'
    )
    addedPlayer.extensions.should.equal(0)
  })

  it('should include signed practice squad in position limits', () => {
    const league = {
      starter_slots_qb: 0,
      starter_slots_rb: 1,
      starter_slots_wr: 1,
      starter_slots_te: 0,
      starter_slots_rb_wr_flex: 0,
      srbwrte: 1,
      sqbrbwrte: 0,
      starter_slots_wr_te_flex: 0,
      starter_slots_dst: 0,
      starter_slots_k: 0,
      bench_slot_count: 5,
      practice_squad_slot_count: 4,
      reserve_short_term_limit: 3,

      max_roster_qb: 0,
      max_roster_rb: 0,
      max_roster_wr: 0,
      max_roster_te: 0,
      max_roster_k: 0,
      max_roster_dst: 3 // Position limit of 3 DST
    }

    const roster = {
      uid: 0,
      players: []
    }

    // Add 1 DST on bench
    roster.players.push({
      slot: roster_slot_types.BENCH,
      pid: 'dst-bench',
      pos: 'DST'
    })

    // Add 2 DST on signed practice squad (slots 12 and 15)
    roster.players.push({
      slot: roster_slot_types.PS,
      pid: 'dst-ps-1',
      pos: 'DST'
    })

    roster.players.push({
      slot: roster_slot_types.PSP,
      pid: 'dst-ps-2',
      pos: 'DST'
    })

    const r = new Roster({ roster, league })

    r.uid.should.equal(0)
    r.players.length.should.equal(3)
    r.isFull.should.equal(false)

    // Should not have open bench slot for DST (1 bench + 2 signed PS = 3, which equals the limit)
    const hasSlot = r.has_bench_space_for_position('DST')
    hasSlot.should.equal(false)
  })

  it('should exclude drafted practice squad from position limits', () => {
    const league = {
      starter_slots_qb: 0,
      starter_slots_rb: 1,
      starter_slots_wr: 1,
      starter_slots_te: 0,
      starter_slots_rb_wr_flex: 0,
      srbwrte: 1,
      sqbrbwrte: 0,
      starter_slots_wr_te_flex: 0,
      starter_slots_dst: 0,
      starter_slots_k: 0,
      bench_slot_count: 5,
      practice_squad_slot_count: 4,
      reserve_short_term_limit: 3,

      max_roster_qb: 0,
      max_roster_rb: 0,
      max_roster_wr: 0,
      max_roster_te: 0,
      max_roster_k: 0,
      max_roster_dst: 3 // Position limit of 3 DST
    }

    const roster = {
      uid: 0,
      players: []
    }

    // Add 1 DST on bench
    roster.players.push({
      slot: roster_slot_types.BENCH,
      pid: 'dst-bench',
      pos: 'DST'
    })

    // Add 1 DST on signed PS
    roster.players.push({
      slot: roster_slot_types.PS,
      pid: 'dst-ps-signed',
      pos: 'DST'
    })

    // Add 2 DST on drafted practice squad (slots 16 and 17) - should NOT count
    roster.players.push({
      slot: roster_slot_types.PSD,
      pid: 'dst-psd',
      pos: 'DST'
    })

    roster.players.push({
      slot: roster_slot_types.PSDP,
      pid: 'dst-psdp',
      pos: 'DST'
    })

    const r = new Roster({ roster, league })

    r.uid.should.equal(0)
    r.players.length.should.equal(4)
    r.isFull.should.equal(false)

    // Should have open bench slot for DST (only 1 bench + 1 signed PS = 2, limit is 3)
    // Drafted PS players don't count toward position limit
    const hasSlot = r.has_bench_space_for_position('DST')
    hasSlot.should.equal(true)
  })

  it('should respect position limits even when practice squad has space', () => {
    const league = {
      starter_slots_qb: 0,
      starter_slots_rb: 1,
      starter_slots_wr: 1,
      starter_slots_te: 0,
      starter_slots_rb_wr_flex: 0,
      srbwrte: 1,
      sqbrbwrte: 0,
      starter_slots_wr_te_flex: 0,
      starter_slots_dst: 0,
      starter_slots_k: 0,
      bench_slot_count: 5,
      practice_squad_slot_count: 4, // 4 practice squad slots available
      reserve_short_term_limit: 3,

      max_roster_qb: 2, // Position limit of 2 QB
      max_roster_rb: 0,
      max_roster_wr: 0,
      max_roster_te: 0,
      max_roster_k: 0,
      max_roster_dst: 0
    }

    const roster = {
      uid: 0,
      players: []
    }

    // Add 1 QB on bench
    roster.players.push({
      slot: roster_slot_types.BENCH,
      pid: 'qb-bench',
      pos: 'QB'
    })

    // Add 1 QB on signed PS
    roster.players.push({
      slot: roster_slot_types.PS,
      pid: 'qb-ps',
      pos: 'QB'
    })

    const r = new Roster({ roster, league })

    r.uid.should.equal(0)
    r.players.length.should.equal(2)
    r.isFull.should.equal(false)
    r.hasOpenPracticeSquadSlot().should.equal(true) // PS has space

    // Should not have open bench slot for QB (1 bench + 1 signed PS = 2, which equals limit)
    // Even though PS has available space, position limit is enforced
    const hasSlot = r.has_bench_space_for_position('QB')
    hasSlot.should.equal(false)
  })

  it('should keep practice squad size limit independent from position limits', () => {
    const league = {
      starter_slots_qb: 0,
      starter_slots_rb: 1,
      starter_slots_wr: 1,
      starter_slots_te: 0,
      starter_slots_rb_wr_flex: 0,
      srbwrte: 1,
      sqbrbwrte: 0,
      starter_slots_wr_te_flex: 0,
      starter_slots_dst: 0,
      starter_slots_k: 0,
      bench_slot_count: 5,
      practice_squad_slot_count: 2, // Only 2 practice squad slots
      reserve_short_term_limit: 3,

      max_roster_qb: 5, // High position limit
      max_roster_rb: 0,
      max_roster_wr: 0,
      max_roster_te: 0,
      max_roster_k: 0,
      max_roster_dst: 0
    }

    const roster = {
      uid: 0,
      players: []
    }

    // Fill practice squad with 2 QBs
    roster.players.push({
      slot: roster_slot_types.PS,
      pid: 'qb-ps-1',
      pos: 'QB'
    })

    roster.players.push({
      slot: roster_slot_types.PSP,
      pid: 'qb-ps-2',
      pos: 'QB'
    })

    const r = new Roster({ roster, league })

    r.uid.should.equal(0)
    r.players.length.should.equal(2)

    // Practice squad is full
    r.hasOpenPracticeSquadSlot().should.equal(false)

    // But position limit still has space (2 < 5)
    r.has_bench_space_for_position('QB').should.equal(true)
  })

  it('getCountBySlot', () => {
    // TODO
  })

  it('getPlayersBySlot', () => {
    // TODO
  })

  it('isEligibleForSlot', () => {
    // TODO
  })

  describe('salary pricing', function () {
    const base_league = {
      cap: 200,
      starter_slots_qb: 1,
      starter_slots_rb: 2,
      starter_slots_wr: 2,
      starter_slots_te: 1,
      starter_slots_rb_wr_flex: 1,
      srbwrte: 1,
      srqbrbwrte: 1,
      starter_slots_wr_te_flex: 1,
      starter_slots_dst: 1,
      starter_slots_k: 1,
      bench_slot_count: 6,
      practice_squad_slot_count: 4,
      reserve_short_term_limit: 3,
      max_roster_qb: 0,
      max_roster_rb: 0,
      max_roster_wr: 0,
      max_roster_te: 0,
      max_roster_k: 3,
      max_roster_dst: 3
    }

    // 1970 and 2100 -- far enough either side of any mocked clock that these
    // stay on the intended branch of `is_before_extension_deadline`.
    const past = 1
    const future = 4102444800

    it('charges a $0 restricted free agency bid as $0, not the prior salary', () => {
      const league = {
        ...base_league,
        ext_date: past,
        restricted_free_agency_period_end: future
      }

      const roster = {
        uid: 0,
        players: [
          {
            slot: roster_slot_types.BENCH,
            pid: 'restricted',
            pos: 'WR',
            value: 42,
            tag: player_tag_types.RESTRICTED_FREE_AGENCY,
            extensions: 0,
            bid: 0
          },
          {
            slot: roster_slot_types.BENCH,
            pid: 'regular',
            pos: 'RB',
            value: 10,
            tag: player_tag_types.REGULAR,
            extensions: 0
          }
        ]
      }

      const r = new Roster({ roster, league })

      r.get('restricted').value.should.equal(0)
      // A player with no bid at all still falls back to their contract value.
      r.get('regular').value.should.equal(10)
      r.availableCap.should.equal(190)
    })

    it('charges a practice squad player their value during the extension window', () => {
      const league = {
        ...base_league,
        ext_date: future,
        restricted_free_agency_period_end: future
      }

      const roster = {
        uid: 0,
        players: [
          {
            slot: roster_slot_types.PS,
            pid: 'practice',
            pos: 'WR',
            value: 10,
            tag: player_tag_types.REGULAR,
            extensions: 0
          },
          {
            slot: roster_slot_types.BENCH,
            pid: 'active',
            pos: 'WR',
            value: 10,
            tag: player_tag_types.REGULAR,
            extensions: 0
          }
        ]
      }

      const r = new Roster({ roster, league })

      // A practice squad contract carries no extension ladder, so it prices at
      // value while an active contract picks up the next extension step.
      r.get('practice').value.should.equal(10)
      r.get('active').value.should.equal(15)
    })
  })
})
