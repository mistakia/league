/* global describe before beforeEach it */
import * as chai from 'chai'

import knex from '#db'
import updatePlayer from '#libs-server/update-player.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

// Must satisfy the player_pid_format check constraint.
const test_pid = 'TEST-POSN-999001'

const insert_test_player = async ({ primary_position }) => {
  await knex('player').where({ pid: test_pid }).del()
  await knex('player').insert({
    pid: test_pid,
    first_name: 'Position',
    last_name: 'Fixture',
    short_name: 'P.Fixture',
    formatted_name: 'position fixture',
    primary_position,
    secondary_position: primary_position,
    position_depth: primary_position,
    current_nfl_team: 'INA'
  })
}

const read_test_player = async () => {
  const rows = await knex('player').where({ pid: test_pid })
  return rows[0]
}

describe('LIBS-SERVER update-player primary_position', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    await insert_test_player({ primary_position: 'WR' })
  })

  it('refuses the write without allow_primary_position_write', async () => {
    const changes = await updatePlayer({
      pid: test_pid,
      update: { primary_position: 'TE' },
      source: 'test'
    })

    expect(changes).to.equal(0)
    const player_row = await read_test_player()
    expect(player_row.primary_position).to.equal('WR')
  })

  it('lands the write with allow_primary_position_write', async () => {
    const changes = await updatePlayer({
      pid: test_pid,
      update: { primary_position: 'TE' },
      allow_primary_position_write: true,
      source: 'test'
    })

    expect(changes).to.equal(1)
    const player_row = await read_test_player()
    expect(player_row.primary_position).to.equal('TE')
  })

  // allow_protected_props gates external IDs and is passed by eight importers.
  // It must not carry primary_position along with it.
  it('is not unlocked by allow_protected_props', async () => {
    const changes = await updatePlayer({
      pid: test_pid,
      update: { primary_position: 'TE' },
      allow_protected_props: true,
      source: 'test'
    })

    expect(changes).to.equal(0)
    const player_row = await read_test_player()
    expect(player_row.primary_position).to.equal('WR')
  })

  it('normalizes a vendor spelling before writing', async () => {
    await updatePlayer({
      pid: test_pid,
      update: { primary_position: 'ed' },
      allow_primary_position_write: true,
      source: 'test'
    })

    const player_row = await read_test_player()
    expect(player_row.primary_position).to.equal('EDGE')
  })

  // secondary_position was never gated, so an importer could always write it.
  // Normalization has to cover it regardless of the flag.
  it('normalizes secondary_position without the flag', async () => {
    await updatePlayer({
      pid: test_pid,
      update: { secondary_position: 'saf' },
      source: 'test'
    })

    const player_row = await read_test_player()
    expect(player_row.secondary_position).to.equal('S')
  })

  it('throws on an unmapped position rather than storing it', async () => {
    let thrown
    try {
      await updatePlayer({
        pid: test_pid,
        update: { primary_position: 'UNK' },
        allow_primary_position_write: true,
        source: 'test'
      })
    } catch (error) {
      thrown = error
    }

    expect(thrown).to.be.an('error')
    expect(thrown.message).to.match(/unmapped position value/)
    const player_row = await read_test_player()
    expect(player_row.primary_position).to.equal('WR')
  })
})
