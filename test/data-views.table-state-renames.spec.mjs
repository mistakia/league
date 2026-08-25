/* global describe it */

import * as chai from 'chai'

import { SHARE_LINK_URL_SCHEMA } from 'react-table/src/constants.mjs'
import parse_table_state_from_url, {
  LEGACY_URL_PARAM_ALIASES
} from '#app/core/data-views/parse-table-state-from-url.mjs'
import {
  apply_table_state_value_renames,
  is_permanent_legacy_name,
  migrate_table_state,
  RENAME_SURFACES,
  SHORT_URL_KEY_ALIASES,
  TABLE_STATE_RENAMES
} from '#libs-shared/data-views-saved-view-migration.mjs'

const expect = chai.expect

// The surface-coverage oracle for TABLE_STATE_RENAMES, which is the declared
// registry for renames of a top-level `table_state` key and of the values
// inside one.
//
// The property it exists to hold is that FORGETTING A SURFACE IS IMPOSSIBLE
// rather than merely discouraged. The June 2026 `splits` -> `row_axes` rename
// was written out three times in three unrelated files, the URL one was
// forgotten, and 188 of 682 production data-view URLs rendered at the wrong
// grain for six weeks. Nothing could see it: both param-coverage gates walk
// KEYS, so neither can report a top-level key or value that no reader accepts.
//
// So this spec asserts the wiring in BOTH directions per surface. A declared
// surface must actually rewrite, and an UNdeclared one must actually not --
// the second half is what pins `subjects` out of the URL parser, which is a
// measured omission (4d7d9a5e4) and not an oversight.
//
// The falsification, run before this spec was trusted: drop 'short_url' from
// the `splits` declaration in TABLE_STATE_RENAMES. It reports through the
// literal pin below, and the URL gate loses `splits` from its accepted set and
// reports it against production.
//
// Worth knowing what that control found, because the first draft of this file
// had the defect it exists to catch. Every DERIVED assertion here stayed green
// under that mutation: an expectation computed from the registry agrees with
// the registry whatever it says, so the alias-set check was comparing two
// values with one source and could never fail. The literal pin is the only
// assertion in this file that can report, and everything around it is a
// consistency check on top of it.

const params = (object) => new URLSearchParams(object)
const json = (value) => JSON.stringify(value)

const each_legacy_key = () =>
  Object.entries(TABLE_STATE_RENAMES).flatMap(([current_key, entry]) =>
    Object.entries(entry.legacy_keys).map(([legacy_key, declaration]) => ({
      current_key,
      legacy_key,
      declaration
    }))
  )

describe('data-views table-state rename registry', function () {
  describe('the declaration itself', function () {
    it('renames onto a key the share-link schema still accepts', function () {
      for (const current_key of Object.keys(TABLE_STATE_RENAMES)) {
        expect(
          SHARE_LINK_URL_SCHEMA.table_state,
          `${current_key} is not a live table_state key`
        ).to.have.property(current_key)
      }
    })

    it('never aliases a legacy key the schema still accepts', function () {
      // An alias shadowing a live key would silently outrank it.
      for (const { legacy_key } of each_legacy_key()) {
        expect(
          SHARE_LINK_URL_SCHEMA.table_state,
          `${legacy_key} is both legacy and live`
        ).to.not.have.property(legacy_key)
      }
    })

    it('declares a non-empty surface set drawn from the known surfaces', function () {
      for (const { legacy_key, declaration } of each_legacy_key()) {
        expect(declaration.surfaces, legacy_key).to.be.an('array').that.is.not
          .empty
        for (const surface of declaration.surfaces) {
          expect(
            RENAME_SURFACES,
            `${legacy_key} names an unknown surface`
          ).to.include(surface)
        }
      }
    })

    it('justifies its surface set at the point of declaration', function () {
      // The note is what answers "can we ever delete this", which is the
      // question the file exists to answer by construction.
      for (const { legacy_key, declaration } of each_legacy_key()) {
        expect(declaration.note, legacy_key).to.be.a('string')
        expect(declaration.note.length, legacy_key).to.be.greaterThan(40)
      }
    })

    it('pins the declared surface set literally', function () {
      // THE ANCHOR. Every other assertion in this file derives its expectation
      // from the registry, so all of them agree with the registry no matter
      // what it says -- including the alias-set check below, which compares two
      // values that both derive from here and therefore cannot fail. Dropping
      // 'short_url' from `splits` was confirmed to leave all of them green.
      //
      // So the surface set is pinned as literal data. Adding or retiring a
      // rename costs one deliberate edit here, which is the point: a surface
      // cannot leave the wiring without someone saying so in a diff.
      const declared = Object.fromEntries(
        each_legacy_key().map(({ legacy_key, declaration }) => [
          legacy_key,
          declaration.surfaces
        ])
      )

      expect(declared).to.eql({
        splits: ['saved_view', 'local_storage', 'short_url'],
        subjects: ['saved_view', 'local_storage']
      })
    })

    it('derives permanence from the short-URL surface alone', function () {
      for (const { legacy_key, declaration } of each_legacy_key()) {
        expect(is_permanent_legacy_name(declaration), legacy_key).to.equal(
          declaration.surfaces.includes('short_url')
        )
      }
    })
  })

  describe('short_url surface', function () {
    it('derives the URL alias set from the registry, both directions', function () {
      const declared = Object.fromEntries(
        each_legacy_key()
          .filter(({ declaration }) =>
            declaration.surfaces.includes('short_url')
          )
          .map(({ legacy_key, current_key }) => [legacy_key, current_key])
      )

      expect(SHORT_URL_KEY_ALIASES).to.eql(declared)
      expect(LEGACY_URL_PARAM_ALIASES).to.eql(declared)
    })

    it('rewrites every legacy key it declares', function () {
      for (const {
        legacy_key,
        current_key,
        declaration
      } of each_legacy_key()) {
        if (!declaration.surfaces.includes('short_url')) continue

        const result = parse_table_state_from_url(
          params({ [legacy_key]: json(['week']) })
        )
        expect(result[current_key], `${legacy_key} -> ${current_key}`).to.eql([
          'week'
        ])
      }
    })

    it('rewrites no legacy key it does not declare', function () {
      // `subjects` is the live instance: its ?subjects= fallback shipped in
      // e1cf78e71 and was deliberately removed in 4d7d9a5e4 because subjects
      // never shipped publicly, so no share link can carry it. If that ever
      // stops being true the declaration changes, not this spec.
      for (const {
        legacy_key,
        current_key,
        declaration
      } of each_legacy_key()) {
        if (declaration.surfaces.includes('short_url')) continue

        const result = parse_table_state_from_url(
          params({ [legacy_key]: json(['team']) })
        )
        expect(
          result[current_key],
          `${legacy_key} must not reach a URL`
        ).to.not.eql(['team'])
      }
    })
  })

  describe('saved_view and local_storage surfaces', function () {
    it('rewrites every legacy key declared on a persisted surface', function () {
      for (const {
        legacy_key,
        current_key,
        declaration
      } of each_legacy_key()) {
        const persisted = ['saved_view', 'local_storage'].some((surface) =>
          declaration.surfaces.includes(surface)
        )
        if (!persisted) continue

        const { changed, table_state } = migrate_table_state({
          [legacy_key]: ['team']
        })
        expect(changed, legacy_key).to.equal(true)
        expect(table_state, legacy_key).to.not.have.property(legacy_key)
        expect(table_state[current_key], legacy_key).to.eql(['team'])
      }
    })

    it('drops the legacy key without overwriting a present current key', function () {
      for (const { legacy_key, current_key } of each_legacy_key()) {
        const { table_state } = migrate_table_state({
          [legacy_key]: ['team'],
          [current_key]: ['player']
        })
        expect(table_state).to.not.have.property(legacy_key)
        expect(table_state[current_key], legacy_key).to.eql(['player'])
      }
    })

    it('still defaults row_grain to player', function () {
      expect(migrate_table_state({}).table_state.row_grain).to.eql(['player'])
      expect(
        migrate_table_state({ subjects: [] }).table_state.row_grain
      ).to.eql(['player'])
    })
  })

  describe('value renames', function () {
    // Every declared value map is EMPTY today, so the real registry proves
    // nothing on its own. A synthetic registry drives the mechanism and the
    // real one is asserted inert beside it -- the pair is what makes this
    // verified rather than merely unexercised.
    const synthetic = {
      row_axes: {
        legacy_keys: {},
        legacy_values: {
          year: {
            to: 'season_year',
            surfaces: ['saved_view', 'short_url'],
            note: 'synthetic, spec only'
          }
        }
      },
      row_grain: {
        legacy_keys: {},
        legacy_values: {
          squad: {
            to: 'team',
            surfaces: ['saved_view'],
            note: 'synthetic, spec only'
          }
        }
      }
    }

    it('rewrites a declared value on a surface that declares it', function () {
      const { table_state, changed } = apply_table_state_value_renames(
        { row_axes: ['year', 'week'] },
        { surfaces: ['short_url'], registry: synthetic }
      )
      expect(changed).to.equal(true)
      expect(table_state.row_axes).to.eql(['season_year', 'week'])
    })

    it('leaves a declared value alone on a surface it does not declare', function () {
      const { table_state, changed } = apply_table_state_value_renames(
        { row_grain: ['squad'] },
        { surfaces: ['short_url'], registry: synthetic }
      )
      expect(changed).to.equal(false)
      expect(table_state.row_grain).to.eql(['squad'])
    })

    it('leaves an undeclared value alone and preserves position', function () {
      const { table_state } = apply_table_state_value_renames(
        { row_axes: ['week', 'year'] },
        { surfaces: ['saved_view'], registry: synthetic }
      )
      expect(table_state.row_axes).to.eql(['week', 'season_year'])
    })

    it('ignores a key holding a non-array', function () {
      const input = { row_axes: { week: true } }
      const { table_state, changed } = apply_table_state_value_renames(input, {
        surfaces: ['short_url'],
        registry: synthetic
      })
      expect(changed).to.equal(false)
      expect(table_state).to.equal(input)
    })

    it('is inert against the real registry', function () {
      const input = { row_axes: ['year', 'week'], row_grain: ['player'] }
      const { table_state, changed } = apply_table_state_value_renames(input, {
        surfaces: RENAME_SURFACES
      })
      expect(changed).to.equal(false)
      expect(table_state).to.equal(input)
    })

    it('reaches the short-URL path', function () {
      // Pinned through the public entry point rather than the helper, so the
      // wiring is asserted and not just the mechanism. The real registry is
      // empty, so the assertion is that a value passes through unchanged --
      // which goes red the moment a value rule is added without this spec
      // gaining a case for it.
      const result = parse_table_state_from_url(
        params({ row_axes: json(['year']) })
      )
      expect(result.row_axes).to.eql(['year'])
    })
  })
})
