/* global describe it before after */

import * as chai from 'chai'

import db from '#db'
import { ensure_player_alias, find_player_row } from '#libs-server'

chai.should()

// Row mirrors the real defect: NFL stored the fused legal firstName
// ("De'Zhaun-Ryan"), so formatted_name diverges from the football name
// ("De'Zhaun Stribling") that every other feed -- and NFL's own displayName --
// sends.
const PID = 'TEST-ALIA-000001'
const make_player = () => ({
  pid: PID,
  first_name: "De'Zhaun-Ryan",
  last_name: 'Stribling',
  short_name: 'D.Stribling',
  formatted_name: 'dezhaun-ryan stribling',
  primary_position: 'WR',
  secondary_position: 'WR',
  date_of_birth: '2002-12-18',
  nfl_draft_year: 2026
})

describe('LIBS-SERVER ensure_player_alias', function () {
  before(async () => {
    await db('player_aliases').where({ pid: PID }).del()
    await db('player').where({ pid: PID }).del()
    await db('player').insert(make_player())
  })

  after(async () => {
    await db('player_aliases').where({ pid: PID }).del()
    await db('player').where({ pid: PID }).del()
  })

  it('seeds an alias when the display name diverges from formatted_name', async () => {
    const added = await ensure_player_alias({
      pid: PID,
      name: "De'Zhaun Stribling",
      formatted_name: 'dezhaun-ryan stribling',
      source: 'nfl'
    })
    added.should.equal(1)

    const row = await db('player_aliases')
      .where({ pid: PID, formatted_alias: 'dezhaun stribling' })
      .first()
    row.should.be.an('object')
    row.source.should.equal('nfl')
  })

  it('is idempotent -- a second call does not duplicate the alias', async () => {
    const added = await ensure_player_alias({
      pid: PID,
      name: "De'Zhaun Stribling",
      source: 'nfl'
    })
    added.should.equal(0)

    const rows = await db('player_aliases').where({
      pid: PID,
      formatted_alias: 'dezhaun stribling'
    })
    rows.length.should.equal(1)
  })

  it('does not record an alias that equals the canonical name', async () => {
    const added = await ensure_player_alias({
      pid: PID,
      name: "De'Zhaun-Ryan Stribling",
      formatted_name: 'dezhaun-ryan stribling',
      source: 'nfl'
    })
    added.should.equal(0)
  })

  it('no-ops on missing pid or name', async () => {
    ;(await ensure_player_alias({ pid: PID, name: '' })).should.equal(0)
    ;(await ensure_player_alias({ pid: null, name: 'x y' })).should.equal(0)
  })

  it('makes the player resolvable by the football name via find_player_row', async () => {
    // Exact formatted_name never matched the football form; the seeded alias does.
    const row = await find_player_row({
      name: "De'Zhaun Stribling",
      pos: 'WR',
      nfl_draft_year: 2026
    })
    row.should.be.an('object')
    row.pid.should.equal(PID)
  })
})
