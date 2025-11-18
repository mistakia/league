/* global describe it */
import * as chai from 'chai'

import { constants, Roster } from '#libs-shared'

process.env.NODE_ENV = 'test'
chai.should()

describe('LIBS-SHARED Roster', function () {
  it('constructor', () => {
    const league = {
      sqb: 1,
      srb: 2,
      swr: 2,
      ste: 1,
      srbwr: 1,
      srbwrte: 1,
      srqbrbwrte: 1,
      swrte: 1,
      sdst: 1,
      sk: 1,
      bench: 6,
      ps: 4,
      reserve_short_term_limit: 3,

      mqb: 0,
      mrb: 0,
      mwr: 0,
      mte: 0,
      mk: 3,
      mdst: 3
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
      sqb: 1,
      srb: 1,
      swr: 2,
      ste: 1,
      srbwr: 2,
      srbwrte: 1,
      sqbrbwrte: 1,
      swrte: 2,
      sdst: 1,
      sk: 1,
      bench: 5,
      ps: 4,
      reserve_short_term_limit: 3,

      mqb: 0,
      mrb: 0,
      mwr: 0,
      mte: 0,
      mk: 3,
      mdst: 3
    }

    const roster = {
      uid: 0,
      players: []
    }

    for (let i = 0; i < 18; i++) {
      roster.players.push({
        slot: constants.slots.BENCH,
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
      sqb: 0,
      srb: 1,
      swr: 1,
      ste: 0,
      srbwr: 0,
      srbwrte: 1,
      sqbrbwrte: 0,
      swrte: 0,
      sdst: 0,
      sk: 0,
      bench: 2,
      ps: 4,
      reserve_short_term_limit: 3,

      mqb: 0,
      mrb: 2,
      mwr: 0,
      mte: 0,
      mk: 3,
      mdst: 3
    }

    const roster = {
      uid: 0,
      players: []
    }

    for (let i = 0; i < 2; i++) {
      roster.players.push({
        slot: constants.slots.BENCH,
        pid: `player-wr-${i}`,
        pos: 'WR'
      })
    }

    for (let i = 0; i < 2; i++) {
      roster.players.push({
        slot: constants.slots.BENCH,
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
      sqb: 0,
      srb: 1,
      swr: 1,
      ste: 0,
      srbwr: 0,
      srbwrte: 1,
      sqbrbwrte: 0,
      swrte: 0,
      sdst: 0,
      sk: 0,
      bench: 2,
      ps: 4,
      reserve_short_term_limit: 3,

      mqb: 0,
      mrb: 0,
      mwr: 0,
      mte: 0,
      mk: 3,
      mdst: 3
    }

    const roster = {
      uid: 0,
      players: []
    }

    for (let i = 0; i < 2; i++) {
      roster.players.push({
        slot: constants.slots.BENCH,
        pid: `player-wr-${i}`,
        pos: 'WR'
      })
    }

    for (let i = 0; i < 2; i++) {
      roster.players.push({
        slot: constants.slots.BENCH,
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
      slot: constants.slots.BENCH,
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
      sqb: 1,
      srb: 2,
      swr: 2,
      ste: 1,
      srbwr: 1,
      srbwrte: 1,
      srqbrbwrte: 1,
      swrte: 1,
      sdst: 1,
      sk: 1,
      bench: 6,
      ps: 4,
      reserve_short_term_limit: 3,
      mqb: 0,
      mrb: 0,
      mwr: 0,
      mte: 0,
      mk: 3,
      mdst: 3
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
      slot: constants.slots.BENCH,
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
      sqb: 1,
      srb: 2,
      swr: 2,
      ste: 1,
      srbwr: 1,
      srbwrte: 1,
      srqbrbwrte: 1,
      swrte: 1,
      sdst: 1,
      sk: 1,
      bench: 6,
      ps: 4,
      reserve_short_term_limit: 3,
      mqb: 0,
      mrb: 0,
      mwr: 0,
      mte: 0,
      mk: 3,
      mdst: 3
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
      slot: constants.slots.BENCH,
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
      sqb: 0,
      srb: 1,
      swr: 1,
      ste: 0,
      srbwr: 0,
      srbwrte: 1,
      sqbrbwrte: 0,
      swrte: 0,
      sdst: 0,
      sk: 0,
      bench: 5,
      ps: 4,
      reserve_short_term_limit: 3,

      mqb: 0,
      mrb: 0,
      mwr: 0,
      mte: 0,
      mk: 0,
      mdst: 3 // Position limit of 3 DST
    }

    const roster = {
      uid: 0,
      players: []
    }

    // Add 1 DST on bench
    roster.players.push({
      slot: constants.slots.BENCH,
      pid: 'dst-bench',
      pos: 'DST'
    })

    // Add 2 DST on signed practice squad (slots 12 and 15)
    roster.players.push({
      slot: constants.slots.PS,
      pid: 'dst-ps-1',
      pos: 'DST'
    })

    roster.players.push({
      slot: constants.slots.PSP,
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
      sqb: 0,
      srb: 1,
      swr: 1,
      ste: 0,
      srbwr: 0,
      srbwrte: 1,
      sqbrbwrte: 0,
      swrte: 0,
      sdst: 0,
      sk: 0,
      bench: 5,
      ps: 4,
      reserve_short_term_limit: 3,

      mqb: 0,
      mrb: 0,
      mwr: 0,
      mte: 0,
      mk: 0,
      mdst: 3 // Position limit of 3 DST
    }

    const roster = {
      uid: 0,
      players: []
    }

    // Add 1 DST on bench
    roster.players.push({
      slot: constants.slots.BENCH,
      pid: 'dst-bench',
      pos: 'DST'
    })

    // Add 1 DST on signed PS
    roster.players.push({
      slot: constants.slots.PS,
      pid: 'dst-ps-signed',
      pos: 'DST'
    })

    // Add 2 DST on drafted practice squad (slots 16 and 17) - should NOT count
    roster.players.push({
      slot: constants.slots.PSD,
      pid: 'dst-psd',
      pos: 'DST'
    })

    roster.players.push({
      slot: constants.slots.PSDP,
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
      sqb: 0,
      srb: 1,
      swr: 1,
      ste: 0,
      srbwr: 0,
      srbwrte: 1,
      sqbrbwrte: 0,
      swrte: 0,
      sdst: 0,
      sk: 0,
      bench: 5,
      ps: 4, // 4 practice squad slots available
      reserve_short_term_limit: 3,

      mqb: 2, // Position limit of 2 QB
      mrb: 0,
      mwr: 0,
      mte: 0,
      mk: 0,
      mdst: 0
    }

    const roster = {
      uid: 0,
      players: []
    }

    // Add 1 QB on bench
    roster.players.push({
      slot: constants.slots.BENCH,
      pid: 'qb-bench',
      pos: 'QB'
    })

    // Add 1 QB on signed PS
    roster.players.push({
      slot: constants.slots.PS,
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
      sqb: 0,
      srb: 1,
      swr: 1,
      ste: 0,
      srbwr: 0,
      srbwrte: 1,
      sqbrbwrte: 0,
      swrte: 0,
      sdst: 0,
      sk: 0,
      bench: 5,
      ps: 2, // Only 2 practice squad slots
      reserve_short_term_limit: 3,

      mqb: 5, // High position limit
      mrb: 0,
      mwr: 0,
      mte: 0,
      mk: 0,
      mdst: 0
    }

    const roster = {
      uid: 0,
      players: []
    }

    // Fill practice squad with 2 QBs
    roster.players.push({
      slot: constants.slots.PS,
      pid: 'qb-ps-1',
      pos: 'QB'
    })

    roster.players.push({
      slot: constants.slots.PSP,
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
})
