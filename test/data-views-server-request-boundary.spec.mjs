/* global describe it */

import * as chai from 'chai'

import { process_params_with_backwards_compatibility } from '#libs-server/get-data-view-results.mjs'
import {
  PARAM_KEY_RENAMES,
  build_param_key_rewrite
} from '#libs-shared/data-views-saved-view-migration.mjs'
import nfl_plays_column_params, {
  nfl_games_params
} from '#libs-shared/nfl-plays-column-params.mjs'
import team_column_params from '#libs-shared/nfl-plays-team-column-params.mjs'
import * as common_column_params from '#libs-shared/common-column-params.mjs'

const expect = chai.expect

// The SERVER request boundary, which is a different layer from the client
// saved-view migration and is the only rewrite a raw API caller ever gets. A
// caller that never opens the app -- a script, a notebook, someone's curl --
// persists nothing and runs no migration, so a legacy param key reaching this
// boundary unrewritten is a filter silently dropped, not a stale view.
//
// Before the widening this boundary rewrote only the nine keys the private
// compat file happened to list; it now derives the whole `param_key` level from
// the registry. These assertions pin the two properties that widening depends
// on and that nothing else checks.
describe('data view server request boundary', function () {
  describe('legacy param key rewriting', function () {
    it('rewrites every registry param key to its LIVE terminal, not its next hop', function () {
      // pru_ngs -> pru -> ngs_pass_rushers. The boundary applies renames in ONE
      // pass, so a rewrite landing on the intermediate `pru` reintroduces
      // exactly the dead-target bug the fold was made to fix.
      const result = process_params_with_backwards_compatibility({
        pru_ngs: [1]
      })

      expect(result).to.have.property('ngs_pass_rushers')
      expect(result).to.not.have.property('pru_ngs')
      expect(result).to.not.have.property('pru')
    })

    it('rewrites a key the old nine-key compat file never covered', function () {
      // The widening in one assertion: any registry param_key rename outside
      // the nine the private compat file listed is a rewrite the boundary did
      // not perform before. Picked from the registry rather than hardcoded so
      // it cannot go stale against a key that is later retired.
      const rewrite = build_param_key_rewrite()
      const [legacy_key, live_key] = [...rewrite.entries()].find(
        ([from]) =>
          ![
            'box_ngs',
            'pru_ngs',
            'air_yards_ngs',
            'time_to_throw_ngs',
            'route_ngs',
            'man_zone_ngs',
            'cov_type_ngs',
            'cov_type',
            'qb_pressure_ngs'
          ].includes(from)
      )

      const result = process_params_with_backwards_compatibility({
        [legacy_key]: ['probe']
      })

      expect(result[live_key]).to.deep.equal(['probe'])
      expect(result).to.not.have.property(legacy_key)
    })

    it('keeps the CANONICAL value when a request carries both spellings', function () {
      // The legacy key is the stale copy by construction, matching the
      // saved-view migrator's rule. This is the assertion the widening most
      // needs: the output param keys previously ran through a separate loop
      // that resolved both-keys this way, and folding them into the general
      // rewrite silently inverted it to legacy-wins until this was pinned.
      const result = process_params_with_backwards_compatibility({
        rate_type_column_params: ['stale'],
        output_column_params: ['canonical']
      })

      expect(result.output_column_params).to.deep.equal(['canonical'])
      expect(result).to.not.have.property('rate_type_column_params')
    })

    it('takes the legacy value when only the legacy spelling is present', function () {
      const result = process_params_with_backwards_compatibility({
        rate_type_column_params: ['only']
      })

      expect(result.output_column_params).to.deep.equal(['only'])
      expect(result).to.not.have.property('rate_type_column_params')
    })
  })

  describe('the widening is non-shadowing', function () {
    it('rewrites no key that is itself a live param name', function () {
      // The whole safety argument for widening from 9 keys to 190: a legacy
      // `from` that is ALSO a live param name would mean a currently VALID
      // request gets rewritten into a different one. Asserted over the union
      // every reader carries rather than over nfl_plays alone, because a key
      // live only on the games/team/common surfaces would shadow just as hard
      // and is exactly what a per-module spot check misses.
      const live_param_names = new Set([
        ...Object.keys(nfl_plays_column_params),
        ...Object.keys(nfl_games_params),
        ...Object.keys(team_column_params),
        ...Object.keys(common_column_params)
      ])

      const shadowing = Object.keys(PARAM_KEY_RENAMES).filter((legacy_key) =>
        live_param_names.has(legacy_key)
      )

      expect(shadowing).to.deep.equal([])
    })

    it('leaves a params object carrying only live keys untouched', function () {
      const params = { pos: ['WR'], ngs_pass_rushers: [1] }

      expect(
        process_params_with_backwards_compatibility({ ...params })
      ).to.deep.equal(params)
    })
  })
})
