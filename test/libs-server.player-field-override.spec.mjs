/* global describe before beforeEach it */
import * as chai from 'chai'

import knex from '#db'
import updatePlayer from '#libs-server/update-player.mjs'
import set_player_field_override from '#libs-server/set-player-field-override.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

// Must satisfy the player_pid_format check constraint.
const test_pid = 'TEST-OVER-999101'
const other_pid = 'TEST-OVER-999102'

const provenance = {
  provider_name: 'sleeper',
  adjudicated_by: 'test-operator',
  evidence_source: 'nflverse gsis 00-0038999; ESPN athlete 4368172',
  reason: 'row held an id belonging to a different same-named human'
}

const insert_test_player = async ({ pid, ...fields }) => {
  await knex('player_field_override').where({ pid }).del()
  await knex('player_changelog').where({ pid }).del()
  await knex('player').where({ pid }).del()
  await knex('player').insert({
    pid,
    first_name: 'Override',
    last_name: 'Fixture',
    short_name: 'O.Fixture',
    formatted_name: `override fixture ${pid}`,
    primary_position: 'WR',
    secondary_position: 'WR',
    position_depth: 'WR',
    current_nfl_team: 'INA',
    ...fields
  })
}

const read_player = async (pid) => {
  const rows = await knex('player').where({ pid })
  return rows[0]
}

const read_changelog = async (pid, column_name) =>
  knex('player_changelog').where({ pid, column_name }).orderBy('changed_at')

describe('LIBS-SERVER player_field_override', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  beforeEach(async function () {
    this.timeout(60 * 1000)
    await insert_test_player({
      pid: test_pid,
      date_of_birth: '1997-05-17',
      sleeper_player_id: '8106'
    })
    await insert_test_player({ pid: other_pid })
  })

  describe('provenance is mandatory at write time', function () {
    // Named individually because "provenance missing" sends the caller looking
    // through four possibilities.
    for (const field of [
      'provider_name',
      'adjudicated_by',
      'evidence_source',
      'reason'
    ]) {
      it(`refuses a declaration with no ${field}`, async () => {
        const incomplete = { ...provenance }
        delete incomplete[field]

        let error
        try {
          await set_player_field_override({
            pid: test_pid,
            column_name: 'date_of_birth',
            override_value: '2000-04-20',
            ...incomplete
          })
        } catch (err) {
          error = err
        }

        expect(error).to.exist
        expect(error.message).to.include(field)

        // Nothing is recorded and nothing is written.
        const rows = await knex('player_field_override').where({
          pid: test_pid
        })
        expect(rows).to.have.length(0)
        const player_row = await read_player(test_pid)
        expect(player_row.date_of_birth).to.equal('1997-05-17')
      })

      it(`refuses a declaration whose ${field} is whitespace`, async () => {
        let error
        try {
          await set_player_field_override({
            pid: test_pid,
            column_name: 'date_of_birth',
            override_value: '2000-04-20',
            ...provenance,
            [field]: '   '
          })
        } catch (err) {
          error = err
        }

        expect(error).to.exist
        expect(error.message).to.include(field)
      })
    }

    it('refuses a column that is not on player', async () => {
      let error
      try {
        await set_player_field_override({
          pid: test_pid,
          column_name: 'not_a_real_column',
          override_value: 'x',
          ...provenance
        })
      } catch (err) {
        error = err
      }

      expect(error).to.exist
      expect(error.message).to.include('not_a_real_column')
    })

    // An override on the row's own key is not a verdict about anything, and
    // formatted_name is derived rather than learned from a provider.
    for (const column_name of ['pid', 'formatted_name']) {
      it(`refuses an override on ${column_name}`, async () => {
        let error
        try {
          await set_player_field_override({
            pid: test_pid,
            column_name,
            override_value: 'x',
            ...provenance
          })
        } catch (err) {
          error = err
        }

        expect(error).to.exist
        expect(error.message).to.include(column_name)
      })
    }

    it('refuses a pid with no player row', async () => {
      let error
      try {
        await set_player_field_override({
          pid: 'TEST-NONE-999999',
          column_name: 'date_of_birth',
          override_value: '2000-04-20',
          ...provenance
        })
      } catch (err) {
        error = err
      }

      expect(error).to.exist
      expect(error.message).to.include('TEST-NONE-999999')
    })
  })

  describe('declaring an override applies it', function () {
    it('writes the value and records the trail in player_changelog', async () => {
      const result = await set_player_field_override({
        pid: test_pid,
        column_name: 'date_of_birth',
        override_value: '2000-04-20',
        ...provenance
      })

      expect(result.is_applied).to.equal(true)

      const player_row = await read_player(test_pid)
      expect(player_row.date_of_birth).to.equal('2000-04-20')

      const changelog = await read_changelog(test_pid, 'date_of_birth')
      expect(changelog).to.have.length(1)
      expect(changelog[0].previous_value).to.equal('1997-05-17')
      expect(changelog[0].new_value).to.equal('2000-04-20')
      expect(changelog[0].source).to.equal('player-field-override')
      expect(changelog[0].reason).to.equal(provenance.reason)
    })

    // Twelve of the fourteen first-customer sleeper_player_id repairs land on a
    // null column. `if (prev)` alone would drop the trail for every one of
    // them, which is the unattributed correction this mechanism exists to end.
    it('records a changelog row even when the field was empty', async () => {
      await knex('player')
        .where({ pid: test_pid })
        .update({ sleeper_player_id: null })

      await set_player_field_override({
        pid: test_pid,
        column_name: 'sleeper_player_id',
        override_value: '11493',
        ...provenance
      })

      const player_row = await read_player(test_pid)
      expect(player_row.sleeper_player_id).to.equal('11493')

      const changelog = await read_changelog(test_pid, 'sleeper_player_id')
      expect(changelog).to.have.length(1)
      expect(changelog[0].previous_value).to.equal(null)
      expect(changelog[0].new_value).to.equal('11493')
      expect(changelog[0].source).to.equal('player-field-override')
    })

    it('is a no-op when player already holds the adjudicated value', async () => {
      const result = await set_player_field_override({
        pid: test_pid,
        column_name: 'date_of_birth',
        override_value: '1997-05-17',
        ...provenance
      })

      expect(result.is_applied).to.equal(true)
      expect(result.changes).to.equal(0)

      const changelog = await read_changelog(test_pid, 'date_of_birth')
      expect(changelog).to.have.length(0)
    })

    it('revises a verdict in place rather than creating a second row', async () => {
      await set_player_field_override({
        pid: test_pid,
        column_name: 'date_of_birth',
        override_value: '2000-04-20',
        ...provenance
      })
      await set_player_field_override({
        pid: test_pid,
        column_name: 'date_of_birth',
        override_value: '1999-04-08',
        ...provenance,
        evidence_source: 'Pro-Football-Reference PittTh00',
        reason: 'superseded by a third source'
      })

      const rows = await knex('player_field_override').where({ pid: test_pid })
      expect(rows).to.have.length(1)
      expect(rows[0].override_value).to.equal('1999-04-08')
      expect(rows[0].evidence_source).to.equal(
        'Pro-Football-Reference PittTh00'
      )

      const player_row = await read_player(test_pid)
      expect(player_row.date_of_birth).to.equal('1999-04-08')
    })
  })

  describe('the veto refuses a differing importer write', function () {
    // date_of_birth is protected by NOTHING in updatePlayer today -- no
    // protected_props entry, no combine guard, no opt-in flag -- which is
    // precisely the field three of the pending repairs are about.
    it('refuses an importer overwriting an adjudicated date_of_birth', async () => {
      await set_player_field_override({
        pid: test_pid,
        column_name: 'date_of_birth',
        override_value: '2000-04-20',
        ...provenance
      })

      const changes = await updatePlayer({
        pid: test_pid,
        update: { date_of_birth: '1997-05-17' },
        source: 'sleeper'
      })

      expect(changes).to.equal(0)
      const player_row = await read_player(test_pid)
      expect(player_row.date_of_birth).to.equal('2000-04-20')
    })

    it('is not lifted by allow_protected_props', async () => {
      await set_player_field_override({
        pid: test_pid,
        column_name: 'sleeper_player_id',
        override_value: '11493',
        ...provenance
      })

      const changes = await updatePlayer({
        pid: test_pid,
        update: { sleeper_player_id: '8106' },
        allow_protected_props: true,
        source: 'sleeper'
      })

      expect(changes).to.equal(0)
      const player_row = await read_player(test_pid)
      expect(player_row.sleeper_player_id).to.equal('11493')
    })

    it('is not lifted by allow_primary_position_write', async () => {
      await set_player_field_override({
        pid: test_pid,
        column_name: 'primary_position',
        override_value: 'TE',
        ...provenance
      })

      const changes = await updatePlayer({
        pid: test_pid,
        update: { primary_position: 'RB' },
        allow_primary_position_write: true,
        source: 'nflverse'
      })

      expect(changes).to.equal(0)
      const player_row = await read_player(test_pid)
      expect(player_row.primary_position).to.equal('TE')
    })

    // The durability test the task names: an importer re-learning the field on
    // its next run must not revert the correction.
    it('holds across repeated importer runs', async () => {
      await set_player_field_override({
        pid: test_pid,
        column_name: 'date_of_birth',
        override_value: '2000-04-20',
        ...provenance
      })

      for (let run = 0; run < 3; run++) {
        await updatePlayer({
          pid: test_pid,
          update: { date_of_birth: '1997-05-17' },
          allow_protected_props: true,
          allow_primary_position_write: true,
          source: 'sleeper'
        })
      }

      const player_row = await read_player(test_pid)
      expect(player_row.date_of_birth).to.equal('2000-04-20')

      // The refusals are silent by design; nothing should have been logged as a
      // change, so the trail holds exactly the one adjudicated write.
      const changelog = await read_changelog(test_pid, 'date_of_birth')
      expect(changelog).to.have.length(1)
    })
  })

  describe('the veto admits the adjudicated value', function () {
    it('allows an importer write that agrees with the verdict', async () => {
      await knex('player')
        .where({ pid: test_pid })
        .update({ date_of_birth: '1997-05-17' })
      await knex('player_field_override').insert({
        pid: test_pid,
        column_name: 'date_of_birth',
        override_value: '2000-04-20',
        adjudicated_at: new Date(),
        ...provenance
      })

      const changes = await updatePlayer({
        pid: test_pid,
        update: { date_of_birth: '2000-04-20' },
        source: 'nflverse'
      })

      expect(changes).to.equal(1)
      const player_row = await read_player(test_pid)
      expect(player_row.date_of_birth).to.equal('2000-04-20')
    })

    // The same-row hijack guard is exactly what an override adjudicates, so it
    // must not also refuse the adjudicated value.
    it('satisfies the protected-props same-row differing-value guard', async () => {
      const result = await set_player_field_override({
        pid: test_pid,
        column_name: 'sleeper_player_id',
        override_value: '11493',
        ...provenance
      })

      expect(result.is_applied).to.equal(true)
      const player_row = await read_player(test_pid)
      expect(player_row.sleeper_player_id).to.equal('11493')
    })

    it('satisfies the primary_position opt-in flag', async () => {
      const result = await set_player_field_override({
        pid: test_pid,
        column_name: 'primary_position',
        override_value: 'TE',
        ...provenance
      })

      expect(result.is_applied).to.equal(true)
      const player_row = await read_player(test_pid)
      expect(player_row.primary_position).to.equal('TE')
    })
  })

  describe('a clear is a verdict that the field should hold nothing', function () {
    it('applies a null override and records the trail', async () => {
      const result = await set_player_field_override({
        pid: test_pid,
        column_name: 'sleeper_player_id',
        override_value: null,
        ...provenance,
        reason: 'id belongs to a James Madison WR with no row here'
      })

      expect(result.is_applied).to.equal(true)
      const player_row = await read_player(test_pid)
      expect(player_row.sleeper_player_id).to.equal(null)

      const changelog = await read_changelog(test_pid, 'sleeper_player_id')
      expect(changelog).to.have.length(1)
      expect(changelog[0].previous_value).to.equal('8106')
      expect(changelog[0].new_value).to.equal(null)
    })

    it('refuses an importer re-populating a cleared field', async () => {
      await set_player_field_override({
        pid: test_pid,
        column_name: 'sleeper_player_id',
        override_value: null,
        ...provenance
      })

      const changes = await updatePlayer({
        pid: test_pid,
        update: { sleeper_player_id: '8106' },
        allow_protected_props: true,
        source: 'sleeper'
      })

      expect(changes).to.equal(0)
      const player_row = await read_player(test_pid)
      expect(player_row.sleeper_player_id).to.equal(null)
    })
  })

  describe('the cross-row uniqueness guard is NOT lifted', function () {
    // It protects a DIFFERENT row, and it is what mechanically enforces the
    // clear-before-set ordering when two rows swap contaminated ids -- a
    // constraint that was documented only as prose until now.
    it('refuses an override whose value another row already holds', async () => {
      await knex('player')
        .where({ pid: other_pid })
        .update({ sleeper_player_id: '11493' })

      const result = await set_player_field_override({
        pid: test_pid,
        column_name: 'sleeper_player_id',
        override_value: '11493',
        ...provenance
      })

      expect(result.is_applied).to.equal(false)
      const player_row = await read_player(test_pid)
      expect(player_row.sleeper_player_id).to.equal('8106')

      // The declaration PERSISTS so the drift check reports it. Rolling it back
      // would restore the state where an unapplied verdict is invisible.
      const rows = await knex('player_field_override').where({
        pid: test_pid,
        column_name: 'sleeper_player_id'
      })
      expect(rows).to.have.length(1)
      expect(rows[0].override_value).to.equal('11493')
    })

    it('applies once the colliding row is cleared first', async () => {
      await knex('player')
        .where({ pid: other_pid })
        .update({ sleeper_player_id: '11493' })

      const refused = await set_player_field_override({
        pid: test_pid,
        column_name: 'sleeper_player_id',
        override_value: '11493',
        ...provenance
      })
      expect(refused.is_applied).to.equal(false)

      await set_player_field_override({
        pid: other_pid,
        column_name: 'sleeper_player_id',
        override_value: null,
        ...provenance,
        reason: 'cleared so the id can be set on its rightful row'
      })

      const applied = await set_player_field_override({
        pid: test_pid,
        column_name: 'sleeper_player_id',
        override_value: '11493',
        ...provenance
      })

      expect(applied.is_applied).to.equal(true)
      const player_row = await read_player(test_pid)
      expect(player_row.sleeper_player_id).to.equal('11493')
    })
  })

  describe('an unadjudicated column is unaffected', function () {
    // The control: every guard must behave exactly as before on a field
    // carrying no verdict, whatever else this row is overridden on.
    it('leaves the existing guards intact on other columns', async () => {
      await set_player_field_override({
        pid: test_pid,
        column_name: 'date_of_birth',
        override_value: '2000-04-20',
        ...provenance
      })

      // primary_position still requires its opt-in flag.
      const refused = await updatePlayer({
        pid: test_pid,
        update: { primary_position: 'TE' },
        source: 'sleeper'
      })
      expect(refused).to.equal(0)

      // ...and still writes with it.
      const allowed = await updatePlayer({
        pid: test_pid,
        update: { primary_position: 'TE' },
        allow_primary_position_write: true,
        source: 'sleeper'
      })
      expect(allowed).to.equal(1)

      // The protected-props same-row guard still refuses a differing id.
      const hijack = await updatePlayer({
        pid: test_pid,
        update: { sleeper_player_id: '99999' },
        source: 'sleeper'
      })
      expect(hijack).to.equal(0)
      const player_row = await read_player(test_pid)
      expect(player_row.sleeper_player_id).to.equal('8106')
    })

    it('still ignores the 0000-00-00 placeholder', async () => {
      const changes = await updatePlayer({
        pid: test_pid,
        update: { date_of_birth: '0000-00-00' },
        source: 'sleeper'
      })

      expect(changes).to.equal(0)
      const player_row = await read_player(test_pid)
      expect(player_row.date_of_birth).to.equal('1997-05-17')
    })
  })
})
