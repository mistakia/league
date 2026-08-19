/* global describe before beforeEach it */
import * as chai from 'chai'

import knex from '#db'
import updatePlayer from '#libs-server/update-player.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

// Must satisfy the player_pid_format check constraint.
const test_pid = 'TEST-UCOL-999001'

const insert_test_player = async () => {
  await knex('player').where({ pid: test_pid }).del()
  await knex('player').insert({
    pid: test_pid,
    first_name: 'Unknown',
    last_name: 'Column',
    short_name: 'U.Column',
    formatted_name: 'unknown column',
    primary_position: 'WR',
    secondary_position: 'WR',
    position_depth: 'WR',
    current_nfl_team: 'INA'
  })
}

const read_test_player = async () => {
  const rows = await knex('player').where({ pid: test_pid })
  return rows[0]
}

describe('LIBS-SERVER update-player unknown column', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    await insert_test_player()
  })

  // The regression this guards: a plural/singular typo on a real column name
  // (pro_bowl_selections vs. the real pro_bowls_selections) silently dropped
  // both fields on every import run for as long as the typo stood, with no
  // error and no log line -- see scripts/import-player-draft-position-pfr.mjs.
  it('throws on a key that is not a column on player, rather than silently dropping it', async () => {
    let thrown
    try {
      await updatePlayer({
        pid: test_pid,
        update: { pro_bowl_selections: 3 },
        source: 'test'
      })
    } catch (error) {
      thrown = error
    }

    expect(thrown).to.be.an('error')
    expect(thrown.message).to.match(/pro_bowl_selections/)
    expect(thrown.message).to.match(/not a column/)
  })

  it('reports zero changes for a legitimate no-op update', async () => {
    const changes = await updatePlayer({
      pid: test_pid,
      update: { primary_position: 'WR' },
      source: 'test'
    })

    expect(changes).to.equal(0)
  })

  it('still writes a recognised column after validating the key set', async () => {
    const changes = await updatePlayer({
      pid: test_pid,
      update: { hometown: 'Testville' },
      source: 'test'
    })

    expect(changes).to.equal(1)
    const player_row = await read_test_player()
    expect(player_row.hometown).to.equal('Testville')
  })
})
