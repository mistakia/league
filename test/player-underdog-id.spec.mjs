/* global describe it before after */

import * as chai from 'chai'
import fs from 'fs/promises'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'

import db from '#db'
import { find_player_row, updatePlayer } from '#libs-server'

const __dirname = dirname(fileURLToPath(import.meta.url))
chai.should()

const make_player = (pid, underdog_id) => ({
  pid,
  fname: 'Test',
  lname: pid,
  pname: 'T.' + pid,
  formatted: pid.toLowerCase(),
  pos: 'WR',
  pos1: 'WR',
  dob: '1995-01-01',
  nfl_draft_year: 2017,
  underdog_id
})

const PID_A = 'TEST-UDOG-A'
const PID_B = 'TEST-UDOG-B'

describe('LIBS-SERVER player underdog_id', function () {
  before(async () => {
    // underdog_id is not yet in the canonical schema dump (added via the gated
    // export:schema). Load the non-destructive adhoc DDL if the column is
    // absent. PG-version-agnostic (no NULLS NOT DISTINCT), so it runs on the
    // local PG 14.
    const has_column = await db.schema.hasColumn('player', 'underdog_id')
    if (!has_column) {
      const ddl = await fs.readFile(
        path.resolve(
          __dirname,
          '../db/adhoc/2026-06-10-player-underdog-id.sql'
        ),
        'utf8'
      )
      await db.raw(ddl)
    }
    await db('player').whereIn('pid', [PID_A, PID_B]).del()
    await db('player').insert([
      make_player(PID_A, 'UD-AAA'),
      make_player(PID_B, 'UD-BBB')
    ])
  })

  after(async () => {
    await db('player').whereIn('pid', [PID_A, PID_B]).del()
  })

  it('find_player_row matches by underdog_id', async () => {
    const row = await find_player_row({ underdog_id: 'UD-AAA' })
    row.should.be.an('object')
    row.pid.should.equal(PID_A)
  })

  it('update-player refuses to overwrite an existing underdog_id without allow_protected_props', async () => {
    const player_row = await db('player').where({ pid: PID_A }).first()
    const changes = await updatePlayer({
      player_row,
      update: { underdog_id: 'UD-CHANGED' }
    })
    changes.should.equal(0)
    const after_row = await db('player').where({ pid: PID_A }).first()
    after_row.underdog_id.should.equal('UD-AAA')
  })

  it('update-player overwrites with allow_protected_props=true', async () => {
    const player_row = await db('player').where({ pid: PID_B }).first()
    const changes = await updatePlayer({
      player_row,
      update: { underdog_id: 'UD-FORCED' },
      allow_protected_props: true
    })
    changes.should.equal(1)
    const after_row = await db('player').where({ pid: PID_B }).first()
    after_row.underdog_id.should.equal('UD-FORCED')
  })
})
