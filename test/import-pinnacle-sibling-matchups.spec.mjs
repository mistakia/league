/* global describe it */
import * as chai from 'chai'

import { filter_sibling_game_matchups } from '#scripts/import-pinnacle-odds.mjs'

const expect = chai.expect

/*
  Pinnacle returns a game as a TREE from /leagues/889/matchups, and this
  importer used to make every node its own listing because source_event_id is
  the matchup id.

  Every fixture below is REDUCED FROM A REAL CACHED PAYLOAD rather than
  invented -- the ids, rotations, parent links and market counts are the ones
  the feed actually published -- because the whole question is which field
  distinguishes a republication from a real container, and a synthetic payload
  would be built from the answer being tested.
*/

// Rams at Seahawks, cached week 15 of 2025. One primary carrying markets, two
// republications carrying none, all on rotation 101.
const republished_game = [
  {
    id: 1620659044,
    type: 'matchup',
    parentId: null,
    rotation: 101,
    totalMarketCount: 8,
    isLive: false
  },
  {
    id: 1621287983,
    type: 'matchup',
    parentId: 1620659044,
    rotation: 101,
    totalMarketCount: 0,
    isLive: false
  },
  {
    id: 1621287985,
    type: 'matchup',
    parentId: 1620659044,
    rotation: 101,
    totalMarketCount: 0,
    isLive: false
  }
]

// Carolina at Tampa Bay, cached week 18 of 2025. A parented game container
// carrying TEN markets whose pregame parent (1621503970) is no longer in the
// feed.
const live_container_with_absent_parent = [
  {
    id: 1621800358,
    type: 'matchup',
    parentId: 1621503970,
    rotation: 9345,
    totalMarketCount: 10,
    isLive: true,
    liveMode: 'live_delay',
    status: 'started'
  }
]

// A player prop hangs off its game by parentId exactly as a sibling container
// does. This is the look-alike the type check has to tell apart.
const player_prop = {
  id: 1621953857,
  type: 'special',
  parentId: 1620659044,
  totalMarketCount: 1,
  special: { category: 'Player Props', description: 'Total Receiving Yards' }
}

const ids_of = (matchups) => matchups.map(({ id }) => id)

describe('import-pinnacle-odds sibling matchups', function () {
  it('drops the republished containers and keeps the primary', () => {
    const result = filter_sibling_game_matchups(republished_game)

    expect(ids_of(result)).to.deep.equal([1620659044])
  })

  it('keeps a parented game container whose parent is absent from the payload', () => {
    // The must-KEEP direction, and the reason the anchor is parent presence
    // rather than totalMarketCount. This container carries markets, is live,
    // and nothing else in the payload republishes it -- dropping it loses the
    // game's live markets outright.
    const result = filter_sibling_game_matchups(
      live_container_with_absent_parent
    )

    expect(ids_of(result)).to.deep.equal([1621800358])
  })

  it('keeps a MARKETLESS parented container whose parent is absent', () => {
    // The only fixture here that is SYNTHETIC, and it is the one that pins the
    // design choice. Parent-presence and `totalMarketCount === 0` agree on
    // every case the cached payloads contain, so without this the two rules
    // are indistinguishable and rewiring to the market count stays green --
    // measured, it did.
    //
    // This input separates them: zero markets, but no parent in the payload to
    // have republished it. Keeping it is the fail-safe direction, because a
    // child whose parent is absent is the only record of that game and the
    // cost of keeping a stray listing is a finding on a detector that already
    // watches for it. The market-count rule drops it and loses the game.
    const orphan_without_markets = [
      {
        id: 1621800358,
        type: 'matchup',
        parentId: 1621503970,
        totalMarketCount: 0,
        isLive: true
      }
    ]

    const result = filter_sibling_game_matchups(orphan_without_markets)

    expect(ids_of(result)).to.deep.equal([1621800358])
  })

  it('keeps a special even though it names a parent that IS present', () => {
    // The DECOY. A rule keyed on `parentId != null` alone, without the type
    // check, deletes every player prop in the feed while still passing the
    // first assertion above.
    const result = filter_sibling_game_matchups([
      ...republished_game,
      player_prop
    ])

    expect(ids_of(result)).to.deep.equal([1620659044, 1621953857])
  })

  it('keeps BOTH listings of a genuine reschedule', () => {
    // The control that separates a republication from a book really listing a
    // game twice. Vikings at Rams was moved for the January 2025 wildfires; a
    // relisting arrives as a second ROOT, not as a child, so nothing here
    // touches it and the game correctly keeps emitting two events.
    const rescheduled = [
      { id: 1600000001, type: 'matchup', parentId: null, totalMarketCount: 42 },
      { id: 1600000999, type: 'matchup', parentId: null, totalMarketCount: 37 }
    ]

    const result = filter_sibling_game_matchups(rescheduled)

    expect(ids_of(result)).to.deep.equal([1600000001, 1600000999])
  })

  it('leaves a payload with no republication untouched', () => {
    const clean = [
      { id: 1, type: 'matchup', parentId: null, totalMarketCount: 12 },
      { id: 2, type: 'special', parentId: 1, totalMarketCount: 1 },
      { id: 3, type: 'matchup', parentId: null, totalMarketCount: 9 }
    ]

    expect(filter_sibling_game_matchups(clean)).to.have.lengthOf(3)
  })

  it('collapses a game to ONE event id where it previously emitted three', () => {
    // The property the fix exists for, asserted as the importer would read it:
    // source_event_id is the matchup id, so distinct surviving matchup ids for
    // one game IS the listing count that reaches prop_markets_index.
    const before = new Set(ids_of(republished_game))
    const after = new Set(
      ids_of(filter_sibling_game_matchups(republished_game))
    )

    expect(before.size).to.equal(3)
    expect(after.size).to.equal(1)
  })
})
