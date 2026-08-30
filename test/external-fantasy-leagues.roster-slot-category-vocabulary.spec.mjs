/* global describe it */

// Every adapter that emits a `roster_slot_category` is writing for one reader:
// ROSTER_SLOT_BY_CATEGORY in the sync. A category the map does not name is
// benched -- ESPN emitted STARTER against a map declaring STARTING and the
// fallback absorbed it for as long as it was wrong. The same drift on
// INJURED_RESERVE puts an IR player on the active roster instead.
//
// The producer half of this already had a case, inside the DB-seeded
// roster-sync-writes spec, but it compared ESPN against a hand-written copy of
// the four category names. That is fixturing one side of the contract: add a
// fifth category to the map and the copy silently stops covering it, which is
// the drift worth catching. Both halves are imported real here, and the check
// is hermetic -- the vocabulary question needs no roster, no league and no
// database, so it does not pay for one.
//
// Only ESPN and Sleeper are covered because only they emit the field; MFL,
// Fleaflicker and Yahoo never set it and the sync's null guard skips them. A
// new emitter belongs in `emitters` below.

import * as chai from 'chai'

import ESPNAdapter from '#libs-server/external-fantasy-leagues/adapters/espn.mjs'
import SleeperAdapter from '#libs-server/external-fantasy-leagues/adapters/sleeper.mjs'
import { ROSTER_SLOT_BY_CATEGORY } from '#libs-server/external-fantasy-leagues/sync/roster-sync.mjs'

const expect = chai.expect

// Each entry drives the REAL adapter method the sync calls, over inputs that
// reach every branch including the unrecognized-input default.
const emitters = {
  espn: () => {
    const adapter = new ESPNAdapter()
    // Every lineup slot id the adapter knows, plus one it does not.
    return [0, 2, 4, 6, 16, 17, 20, 21, 23, 9999].map(
      (lineupSlotId) =>
        adapter.determine_roster_slot_info_espn({ lineupSlotId }).category
    )
  },
  sleeper: () => {
    const adapter = new SleeperAdapter()
    const roster = {
      starters: ['starter-1'],
      reserve: ['reserve-1'],
      taxi: ['taxi-1'],
      players: ['starter-1', 'reserve-1', 'taxi-1', 'bench-1']
    }
    return ['starter-1', 'reserve-1', 'taxi-1', 'bench-1'].map(
      (player_id) =>
        adapter.determine_roster_slot_info(player_id, roster).category
    )
  }
}

describe('external fantasy leagues roster slot category vocabulary', function () {
  for (const [platform, emit_categories] of Object.entries(emitters)) {
    it(`every category ${platform} emits is one the sync maps`, () => {
      const emitted = emit_categories()

      // Without this the case passes on an adapter method that started
      // returning nothing, which is the shape a refactor produces.
      expect(
        emitted.length,
        `${platform} emitted no categories at all, so the assertion below ` +
          'iterates nothing and cannot fail'
      ).to.be.greaterThan(0)

      for (const category of new Set(emitted)) {
        expect(
          Object.prototype.hasOwnProperty.call(
            ROSTER_SLOT_BY_CATEGORY,
            category
          ),
          `${platform} emits roster_slot_category '${category}', which ` +
            'ROSTER_SLOT_BY_CATEGORY does not name -- the sync benches it and ' +
            'says so only in a log line'
        ).to.equal(true)
      }
    })
  }

  it('the canonical map still names the categories the adapters rely on', () => {
    // The pair the contract is actually about. Asserting only "everything
    // emitted is mapped" passes just as well when the map is widened to
    // anything, or when an adapter stops emitting a category entirely.
    // It also catches the lazy repair of the drift that started this: adding
    // STARTER to the map rather than fixing the adapter would satisfy every
    // case above while leaving two names for one concept.
    expect(
      Object.keys(ROSTER_SLOT_BY_CATEGORY).sort(),
      'the canonical category set changed. If an adapter genuinely needs a new ' +
        'category, add it here and to ROSTER_SLOT_BY_CATEGORY together. If this ' +
        'is a widening that absorbs a drifted emission, fix the adapter instead'
    ).to.deep.equal(['BENCH', 'INJURED_RESERVE', 'PRACTICE_SQUAD', 'STARTING'])
  })
})
