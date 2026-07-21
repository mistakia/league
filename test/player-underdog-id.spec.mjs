/* global describe it before after */

import * as chai from 'chai'

import db from '#db'
import { find_player_row, updatePlayer } from '#libs-server'

chai.should()

const make_player = (pid, underdog_player_id) => ({
  pid,
  first_name: 'Test',
  last_name: pid,
  short_name: 'T.' + pid,
  formatted_name: pid.toLowerCase(),
  primary_position: 'WR',
  secondary_position: 'WR',
  date_of_birth: '1995-01-01',
  nfl_draft_year: 2017,
  underdog_player_id
})

const PID_A = 'TEST-UDOG-000001'
const PID_B = 'TEST-UDOG-000002'

describe('LIBS-SERVER player underdog_id', function () {
  before(async () => {
    await db('player').whereIn('pid', [PID_A, PID_B]).del()
    await db('player').insert([
      make_player(PID_A, 'UD-AAA'),
      make_player(PID_B, 'UD-BBB')
    ])
  })

  after(async () => {
    await db('player').whereIn('pid', [PID_A, PID_B]).del()
  })

  it('find_player_row matches by underdog_player_id', async () => {
    const row = await find_player_row({ underdog_player_id: 'UD-AAA' })
    row.should.be.an('object')
    row.pid.should.equal(PID_A)
  })

  it('update-player refuses to overwrite an existing underdog_player_id without allow_protected_props', async () => {
    const player_row = await db('player').where({ pid: PID_A }).first()
    const changes = await updatePlayer({
      player_row,
      update: { underdog_player_id: 'UD-CHANGED' }
    })
    changes.should.equal(0)
    const after_row = await db('player').where({ pid: PID_A }).first()
    after_row.underdog_player_id.should.equal('UD-AAA')
  })

  it('update-player overwrites with allow_protected_props=true', async () => {
    const player_row = await db('player').where({ pid: PID_B }).first()
    const changes = await updatePlayer({
      player_row,
      update: { underdog_player_id: 'UD-FORCED' },
      allow_protected_props: true
    })
    changes.should.equal(1)
    const after_row = await db('player').where({ pid: PID_B }).first()
    after_row.underdog_player_id.should.equal('UD-FORCED')
  })
})
