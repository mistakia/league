/* global describe, it, beforeEach */

import * as chai from 'chai'

import {
  get_market_type,
  unmapped_subcategories_by_offer_category,
  unmapped_offer_categories
} from '#libs-server/draftkings/draftkings-market-types.mjs'
import {
  known_unmapped_subcategory_ids,
  known_unmapped_offer_category_ids
} from '#libs-server/draftkings/draftkings-constants.mjs'
import {
  player_prop_types,
  team_game_market_types
} from '#libs-shared/bookmaker-constants.mjs'

const expect = chai.expect

// The two offer categories that had no handler at all until 2026-09-04. Absent
// from the dispatcher's switch, every market under them fell to its default
// arm and returned null across 89,950 markets. The sixteen ids below are the
// complete modelable set arriving under them since 2025-08-01, read back from
// source_market_name, which embeds the vendor's own categoryId.
const offer_526_mappings = {
  4631: team_game_market_types.GAME_FIRST_HALF_MONEYLINE,
  4641: team_game_market_types.GAME_SECOND_HALF_MONEYLINE,
  13582: team_game_market_types.GAME_FIRST_HALF_ALT_SPREAD,
  13583: team_game_market_types.GAME_SECOND_HALF_ALT_SPREAD,
  13584: team_game_market_types.GAME_FIRST_HALF_ALT_TOTAL,
  13585: team_game_market_types.GAME_SECOND_HALF_ALT_TOTAL
}

const offer_527_mappings = {
  4632: team_game_market_types.GAME_FIRST_QUARTER_MONEYLINE,
  4642: team_game_market_types.GAME_SECOND_QUARTER_MONEYLINE,
  4643: team_game_market_types.GAME_THIRD_QUARTER_MONEYLINE,
  4644: team_game_market_types.GAME_FOURTH_QUARTER_MONEYLINE,
  13525: team_game_market_types.GAME_FIRST_QUARTER_ALT_SPREAD,
  13526: team_game_market_types.GAME_FIRST_QUARTER_ALT_TOTAL,
  16078: team_game_market_types.GAME_SECOND_QUARTER_ALT_SPREAD,
  15707: team_game_market_types.GAME_SECOND_QUARTER_ALT_TOTAL,
  16079: team_game_market_types.GAME_THIRD_QUARTER_ALT_SPREAD,
  15708: team_game_market_types.GAME_THIRD_QUARTER_ALT_TOTAL
}

// An id no DraftKings payload has ever carried, used to drive the default arms.
// Deliberately not a real id: a real one would start passing the moment someone
// mapped it, turning this spec red for the wrong reason.
const never_published_subcategory_id = 999999
const never_published_category_id = 999998

const collected_subcategories = (offer_category_id) => [
  ...(unmapped_subcategories_by_offer_category.get(offer_category_id) ?? [])
]

describe('libs-server draftkings market types', function () {
  beforeEach(function () {
    unmapped_subcategories_by_offer_category.clear()
    unmapped_offer_categories.clear()
  })

  describe('offer categories 526 (Halves) and 527 (Quarters)', function () {
    it('maps every subcategory arriving under Halves', function () {
      for (const [subcategoryId, expected] of Object.entries(
        offer_526_mappings
      )) {
        expect(
          get_market_type({ offerCategoryId: 526, subcategoryId }),
          `subcategoryId ${subcategoryId}`
        ).to.equal(expected)
      }
    })

    it('maps every subcategory arriving under Quarters', function () {
      for (const [subcategoryId, expected] of Object.entries(
        offer_527_mappings
      )) {
        expect(
          get_market_type({ offerCategoryId: 527, subcategoryId }),
          `subcategoryId ${subcategoryId}`
        ).to.equal(expected)
      }
    })

    // The point of adding the handlers is not only the sixteen mappings: they
    // convert an unknown CATEGORY into an unknown SUBCATEGORY, which is the
    // granularity a human can act on.
    it('reports an unrecognised id under them as a subcategory, not a category', function () {
      expect(
        get_market_type({
          offerCategoryId: 527,
          subcategoryId: never_published_subcategory_id
        })
      ).to.equal(null)

      expect(collected_subcategories(527)).to.eql([
        never_published_subcategory_id
      ])
      expect([...unmapped_offer_categories]).to.eql([])
    })
  })

  // Two quarter-scoped player subcategories that an earlier reading routed into
  // 526 and 527, where no market ever reaches them. They arrive under the
  // passing and rushing prop categories, which already have handlers.
  describe('the two player subcategories that arrive elsewhere', function () {
    it('maps 19111 under Passing Props, not under Quarters', function () {
      expect(
        get_market_type({ offerCategoryId: 1000, subcategoryId: 19111 })
      ).to.equal(player_prop_types.GAME_FIRST_QUARTER_PASSING_COMPLETIONS)

      expect(
        get_market_type({ offerCategoryId: 527, subcategoryId: 19111 })
      ).to.equal(null)
    })

    it('maps 19117 under Rushing Props to the type that already existed', function () {
      expect(
        get_market_type({ offerCategoryId: 1001, subcategoryId: 19117 })
      ).to.equal(player_prop_types.GAME_FIRST_QUARTER_RUSHING_ATTEMPTS)

      // 18524 is the same product under DraftKings' prior key. Both must land
      // on one type, and that type predates this mapping rather than being
      // coined for it.
      expect(
        get_market_type({ offerCategoryId: 1001, subcategoryId: 18524 })
      ).to.equal(player_prop_types.GAME_FIRST_QUARTER_RUSHING_ATTEMPTS)

      expect(
        get_market_type({ offerCategoryId: 526, subcategoryId: 19117 })
      ).to.equal(null)
    })
  })

  describe('the gap collector', function () {
    it('keys an unmapped subcategory by the category it arrived under', function () {
      get_market_type({
        offerCategoryId: 1000,
        subcategoryId: never_published_subcategory_id
      })
      get_market_type({
        offerCategoryId: 1342,
        subcategoryId: never_published_subcategory_id
      })

      expect(collected_subcategories(1000)).to.eql([
        never_published_subcategory_id
      ])
      expect(collected_subcategories(1342)).to.eql([
        never_published_subcategory_id
      ])
      expect([...unmapped_offer_categories]).to.eql([])
    })

    // An entire unmodelled category never reaches a handler, so a collector
    // wired only to the handlers cannot see it. That is exactly how 526 and 527
    // stayed dark, and it is the arm this case exists to pin.
    it('reports an unmodelled category under the category arm alone', function () {
      expect(
        get_market_type({
          offerCategoryId: never_published_category_id,
          subcategoryId: 4631
        })
      ).to.equal(null)

      expect([...unmapped_offer_categories]).to.eql([
        never_published_category_id
      ])
      expect(unmapped_subcategories_by_offer_category.size).to.equal(0)
    })

    it('stays empty on a mapped subcategory', function () {
      expect(
        get_market_type({ offerCategoryId: 527, subcategoryId: 4642 })
      ).to.equal(team_game_market_types.GAME_SECOND_QUARTER_MONEYLINE)

      expect(unmapped_subcategories_by_offer_category.size).to.equal(0)
      expect([...unmapped_offer_categories]).to.eql([])
    })
  })

  // Position-group season leaders signalled 2026-09-05 (128447): DraftKings
  // splits the stat-leader products by position group. Same metric as the
  // league-wide leaders, narrower field, so one existing type each.
  describe('offer category 1595 position-group season leaders', function () {
    it('maps 15816 (QB rushing lead) to the existing rushing-leader type', function () {
      expect(
        get_market_type({ offerCategoryId: 1595, subcategoryId: 15816 })
      ).to.equal(player_prop_types.SEASON_LEADER_RUSHING_YARDS)
    })

    it('maps 20232 (RB/TE receiving lead) to the existing receiving-leader type', function () {
      expect(
        get_market_type({ offerCategoryId: 1595, subcategoryId: 20232 })
      ).to.equal(player_prop_types.SEASON_LEADER_RECEIVING_YARDS)
    })
  })

  // DraftKings renumbered two TD Scorers subcategories and the handler kept the
  // retired ids. 11819 and 11820 have published nothing since records begin,
  // while their live successors landed in the declined set and wrote null
  // market_type on every observation. Both types already existed.
  describe('offer category 1003 renumbered TD scorer subcategories', function () {
    it('maps 11818 (Last TD Scorer, Inc OT) to the existing last-scorer type', function () {
      expect(
        get_market_type({ offerCategoryId: 1003, subcategoryId: 11818 })
      ).to.equal(player_prop_types.GAME_LAST_TOUCHDOWN_SCORER)
    })

    it('maps 12451 (1st Team TD Scorer) to the existing first-team-scorer type', function () {
      expect(
        get_market_type({ offerCategoryId: 1003, subcategoryId: 12451 })
      ).to.equal(player_prop_types.GAME_FIRST_TEAM_TOUCHDOWN_SCORER)
    })

    it('keeps the retired 11820 on the same type as its successor', function () {
      expect(
        get_market_type({ offerCategoryId: 1003, subcategoryId: 11820 })
      ).to.equal(player_prop_types.GAME_FIRST_TEAM_TOUCHDOWN_SCORER)
    })

    it('still collects an unrecognised 1003 subcategory as a gap', function () {
      unmapped_subcategories_by_offer_category.clear()

      expect(
        get_market_type({ offerCategoryId: 1003, subcategoryId: 999999 })
      ).to.equal(null)
      expect(unmapped_subcategories_by_offer_category.get(1003)).to.include(
        999999
      )

      unmapped_subcategories_by_offer_category.clear()
    })
  })

  // The seeded sets are what keep the importer's signal readable: the collector
  // records everything, and without a gate the subcategory arm names the same
  // 221 ids and the category arm the same 42 on every run.
  describe('the known-unmapped sets', function () {
    it('rules out only ids no modelled category maps', function () {
      const modelled_category_ids = [
        492, 526, 527, 528, 529, 530, 634, 787, 820, 1000, 1001, 1002, 1003,
        1076, 1163, 1286, 1342, 1595, 1759
      ]

      for (const subcategoryId of known_unmapped_subcategory_ids) {
        for (const offerCategoryId of modelled_category_ids) {
          expect(
            get_market_type({ offerCategoryId, subcategoryId }),
            `subcategoryId ${subcategoryId} under offer category ${offerCategoryId}`
          ).to.equal(null)
        }
      }
    })

    // Both sets are seeded from a replay of the mapper over production's
    // dispatch tuples, so a mapped id appearing in either would silence a
    // signal that should fire.
    it('excludes every id this change newly maps', function () {
      for (const subcategory_id of [
        ...Object.keys(offer_526_mappings),
        ...Object.keys(offer_527_mappings),
        19111,
        19117,
        // Found by the sweep rather than under 526/527: unmapped subcategories
        // whose market_type was declared all along.
        15006,
        15008,
        15948,
        16924,
        18525,
        // Position-group season leaders under 1595 (2026-09-05).
        15816,
        20232,
        // Renumbered TD scorer subcategories under 1003 (2026-09-05).
        11818,
        12451
      ]) {
        expect(
          known_unmapped_subcategory_ids.has(Number(subcategory_id)),
          `subcategoryId ${subcategory_id}`
        ).to.equal(false)
      }

      expect(known_unmapped_offer_category_ids.has(526)).to.equal(false)
      expect(known_unmapped_offer_category_ids.has(527)).to.equal(false)
    })
  })
})
