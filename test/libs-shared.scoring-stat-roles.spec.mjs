/* global describe, it, before */
import * as chai from 'chai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  scoring_stat_roles,
  scoring_stat_role_stat_ids,
  stat_ids_for_role,
  stat_role_fallback_pid_columns,
  apply_stat_role
} from '#libs-shared/scoring-stat-roles.mjs'
import {
  FUMBLE_RETURN_TOUCHDOWN_STAT_IDS,
  FUMBLE_LOST_STAT_IDS,
  PUNT_RETURN_TOUCHDOWN_STAT_IDS,
  KICKOFF_RETURN_TOUCHDOWN_STAT_IDS
} from '#libs-server/data-views/nfl-play-stats-attribution.mjs'

process.env.NODE_ENV = 'test'
chai.should()
const expect = chai.expect

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.resolve(__dirname, '..')

// Consistency spec for libs-shared/scoring-stat-roles.mjs.
//
// The invariant these replace was a prose comment in the attribution module
// asserting that every stat id it owned was also a `case` in the switch. A
// comment cannot fail, and the cost of drift is silent: the from-plays path and
// the gamelogs path credit different players for the same play, which shows up
// as a scoring residual nobody can attribute.
describe('libs-shared/scoring-stat-roles', function () {
  describe('registry shape', function () {
    it('gives every role a name, at least one stat id and at least one increment', function () {
      for (const role of scoring_stat_roles) {
        role.name.should.be.a('string').and.not.be.empty
        role.stat_ids.should.be.an('array').that.is.not.empty
        role.increments.should.be.an('array').that.is.not.empty
      }
    })

    it('claims each stat id exactly once across all roles', function () {
      const seen = new Set()
      const duplicated = scoring_stat_role_stat_ids.filter((id) => {
        if (seen.has(id)) return true
        seen.add(id)
        return false
      })

      duplicated.should.eql([])
    })

    it('throws on an unknown role name rather than returning nothing', function () {
      expect(() => stat_ids_for_role('no_such_role')).to.throw(
        /unknown scoring stat role/
      )
    })
  })

  // The whole point of the registry: one enumeration, several consumers.
  describe('derived consumers', function () {
    it('supplies the attribution module its four stat id arrays', function () {
      FUMBLE_RETURN_TOUCHDOWN_STAT_IDS.should.eql([56, 58, 60, 62])
      FUMBLE_LOST_STAT_IDS.should.eql([106])
      PUNT_RETURN_TOUCHDOWN_STAT_IDS.should.eql([34, 36])
      KICKOFF_RETURN_TOUCHDOWN_STAT_IDS.should.eql([46, 48])
    })

    it('supplies the gamelog generator its fallback pid columns', function () {
      stat_role_fallback_pid_columns.should.eql({ 106: 'player_fuml_pid' })
    })
  })

  describe('apply_stat_role', function () {
    it('increments the role field and reports the hit', function () {
      const stats = { two_point_conversions: 0 }

      apply_stat_role({ stat_id: 77, stats }).should.equal(true)
      stats.two_point_conversions.should.equal(1)
    })

    it('reports a miss and touches nothing for an unowned stat id', function () {
      const stats = { two_point_conversions: 0 }

      apply_stat_role({ stat_id: 70, stats }).should.equal(false)
      stats.two_point_conversions.should.equal(0)
    })
  })

  // This is the structural guard. A registry id left behind as a `case` would
  // be unreachable -- the registry lookup runs first and `continue`s -- so the
  // switch arm would read as live code while contributing nothing, which is the
  // shape that survives review.
  describe('no stat id is served twice', function () {
    let switch_source

    before(function () {
      switch_source = fs.readFileSync(
        path.join(repo_root, 'libs-shared/calculate-stats-from-play-stats.mjs'),
        'utf8'
      )
    })

    it('leaves no bespoke case for any registry stat id', function () {
      const duplicated = scoring_stat_role_stat_ids.filter((id) =>
        new RegExp(`^\\s*case ${id}:`, 'm').test(switch_source)
      )

      duplicated.should.eql([])
    })

    // Positive control: the pattern must be able to match, or the assertion
    // above is vacuous and reads as a pass no matter what the file holds.
    it('still finds the bespoke cases the registry does not own', function () {
      for (const id of [70, 72, 69]) {
        new RegExp(`^\\s*case ${id}:`, 'm')
          .test(switch_source)
          .should.equal(true, `case ${id} should still be in the switch`)
      }
    })
  })
})
