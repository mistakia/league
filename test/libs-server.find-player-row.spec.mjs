/* global describe it before after */

import * as chai from 'chai'

import db from '#db'
import { find_player_row } from '#libs-server'
import { Errors } from '#libs-shared'

const expect = chai.expect
chai.should()

// find_player_row had no spec at all until this file. The lookup it performs is
// an else-if ladder over ~23 external id columns that is ALSO exclusive with the
// name/date-of-birth branch, so which parameters a caller passes silently decides
// which ones are HONORED. Every case below is a fact about that ladder.

const ESB_PID = 'TEST-FPRW-000001'
const NAME_PID = 'TEST-FPRW-000002'
const PFR_PID = 'TEST-FPRW-000003'
const TWIN_A_PID = 'TEST-FPRW-000004'
const TWIN_B_PID = 'TEST-FPRW-000005'

const ALL_PIDS = [ESB_PID, NAME_PID, PFR_PID, TWIN_A_PID, TWIN_B_PID]

const make_player = (overrides) => ({
  first_name: 'Fixture',
  last_name: 'Player',
  short_name: 'F.Player',
  formatted_name: 'fixture player',
  primary_position: 'WR',
  secondary_position: 'WR',
  date_of_birth: '2001-03-04',
  nfl_draft_year: 2023,
  ...overrides
})

describe('LIBS-SERVER find_player_row', function () {
  before(async () => {
    await db('player').whereIn('pid', ALL_PIDS).del()
    await db('player').insert([
      make_player({
        pid: ESB_PID,
        first_name: 'Esbonly',
        last_name: 'Carrier',
        formatted_name: 'esbonly carrier',
        esb_player_id: 'TESTESB01'
      }),
      // The row a minting caller must find. It carries NO esb id -- exactly the
      // shape a feed that mints without one (SIS draft profiles) leaves behind.
      make_player({
        pid: NAME_PID,
        first_name: 'Namematch',
        last_name: 'Only',
        formatted_name: 'namematch only',
        nfl_draft_year: 2025
      }),
      make_player({
        pid: PFR_PID,
        first_name: 'Pfronly',
        last_name: 'Carrier',
        formatted_name: 'pfronly carrier',
        pfr_player_id: 'TestPfr01'
      }),
      make_player({
        pid: TWIN_A_PID,
        first_name: 'SameName',
        last_name: 'Twin',
        formatted_name: 'samename twin',
        nfl_draft_year: 2014
      }),
      make_player({
        pid: TWIN_B_PID,
        first_name: 'SameName',
        last_name: 'Twin',
        formatted_name: 'samename twin',
        nfl_draft_year: 2023
      })
    ])
  })

  after(async () => {
    await db('player').whereIn('pid', ALL_PIDS).del()
  })

  it('resolves a player by a single external id', async () => {
    const row = await find_player_row({ esb_player_id: 'TESTESB01' })
    row.should.be.an('object')
    row.pid.should.equal(ESB_PID)
  })

  it('resolves a player by name and draft year', async () => {
    const row = await find_player_row({
      name: 'Namematch Only',
      nfl_draft_year: 2025
    })
    row.should.be.an('object')
    row.pid.should.equal(NAME_PID)
  })

  it('abstains with MatchedMultiplePlayers when a name matches two rows', async () => {
    let thrown
    try {
      await find_player_row({ name: 'SameName Twin' })
    } catch (err) {
      thrown = err
    }
    expect(thrown).to.be.instanceof(Errors.MatchedMultiplePlayers)
  })

  it('returns undefined for an external id no row carries', async () => {
    const row = await find_player_row({ esb_player_id: 'TESTESB-ABSENT' })
    expect(row).to.equal(undefined)
  })

  // The duplicate-minting enabling condition. A caller holding an id that no row
  // carries YET, who also holds the name and draft year that DO identify an
  // existing row, gets an id-only query: the name branch never runs, the lookup
  // returns undefined, and a caller that mints on undefined mints a second person.
  // Refusing the call is what makes the trap unreachable -- silently dropping half
  // the caller's evidence is the defect, and returning undefined for it is
  // indistinguishable from "no such player" at every call site.
  it('refuses a lookup that bundles an external id with a name', async () => {
    let thrown
    try {
      await find_player_row({
        esb_player_id: 'TESTESB-ABSENT',
        name: 'Namematch Only',
        nfl_draft_year: 2025
      })
    } catch (err) {
      thrown = err
    }
    expect(thrown, 'expected a refusal, got a silent id-only query').to.be.an(
      'error'
    )
    thrown.message.should.match(/esb_player_id/)
  })

  it('refuses a lookup that bundles an external id with a date of birth', async () => {
    let thrown
    try {
      await find_player_row({
        esb_player_id: 'TESTESB-ABSENT',
        date_of_birth: '2001-03-04'
      })
    } catch (err) {
      thrown = err
    }
    expect(thrown, 'expected a refusal, got a silent id-only query').to.be.an(
      'error'
    )
  })

  // Two ids do not AND -- the ladder takes the first branch that matches its
  // parameter, so a caller passing both gets the earlier one and never learns the
  // later one was ignored. Here pfr precedes esb, so the bundle resolves to the
  // pfr row: a confident WRONG match rather than an abstention.
  it('refuses a lookup that bundles two external ids', async () => {
    let thrown
    try {
      await find_player_row({
        pfr_player_id: 'TestPfr01',
        esb_player_id: 'TESTESB01'
      })
    } catch (err) {
      thrown = err
    }
    expect(
      thrown,
      'expected a refusal, got the first id in ladder order'
    ).to.be.an('error')
    thrown.message.should.match(/pfr_player_id/)
    thrown.message.should.match(/esb_player_id/)
  })

  // sleeper_player_id was the one id outside the ladder, ANDing rather than
  // excluding. It is a ladder branch now, so it refuses a bundle like the rest.
  it('refuses a bundle involving sleeper_player_id, which used to AND', async () => {
    let thrown
    try {
      await find_player_row({
        sleeper_player_id: 'TestSleeper01',
        name: 'Namematch Only'
      })
    } catch (err) {
      thrown = err
    }
    expect(thrown).to.be.an('error')
    thrown.message.should.match(/sleeper_player_id/)
  })

  it('refuses with AmbiguousPlayerLookup, distinct from MatchedMultiplePlayers', async () => {
    let thrown
    try {
      await find_player_row({
        esb_player_id: 'TESTESB01',
        name: 'Esbonly Carrier'
      })
    } catch (err) {
      thrown = err
    }
    // A caller that mints on anything other than MatchedMultiplePlayers must not
    // read this refusal as an abstention and mint on it.
    expect(thrown).to.be.instanceof(Errors.AmbiguousPlayerLookup)
    expect(thrown).to.not.be.instanceof(Errors.MatchedMultiplePlayers)
  })

  // The ladder still resolves one dimension per call, which is what every caller
  // relies on. An id lookup ignores no evidence now because it can carry none.
  it('still resolves an id lookup passed on its own after the guard', async () => {
    const row = await find_player_row({ pfr_player_id: 'TestPfr01' })
    row.should.be.an('object')
    row.pid.should.equal(PFR_PID)
  })
})
