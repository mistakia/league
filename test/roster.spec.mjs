/* global describe it */
import chai from 'chai'

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
      ir: 2,

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
      ir: 2,

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

    const hasSlot = r.hasOpenBenchSlot('RB')
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
      ir: 2,

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

    const hasSlot = r.hasOpenBenchSlot('RB')
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
      ir: 2,

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

    const hasSlot = r.hasOpenBenchSlot('RB')
    hasSlot.should.equal(true)

    r.addPlayer({
      slot: constants.slots.BENCH,
      pid: 'player-rb-add',
      pos: 'RB'
    })
    r.removePlayer('player-rb-0')

    r.players.length.should.equal(4)
    r.isFull.should.equal(false)

    const hasSlot2 = r.hasOpenBenchSlot('RB')
    hasSlot2.should.equal(true)
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
