/* global describe it */
import * as chai from 'chai'

import { player_could_have_played } from '#libs-server/player-era.mjs'

const expect = chai.expect

describe('LIBS SERVER player_could_have_played', function () {
  it('rejects a drafted player in any season before their draft', () => {
    // shi smith, drafted 2021, carried 261 gamelog rows spanning 2001-2016.
    const shi_smith = { nfl_draft_year: 2021, draft_round: 6 }
    expect(
      player_could_have_played({ player: shi_smith, season_year: 2016 })
    ).to.equal(false)
    expect(
      player_could_have_played({ player: shi_smith, season_year: 2020 })
    ).to.equal(false)
  })

  it('accepts a drafted player in their draft season and after', () => {
    const shi_smith = { nfl_draft_year: 2021, draft_round: 6 }
    expect(
      player_could_have_played({ player: shi_smith, season_year: 2021 })
    ).to.equal(true)
    expect(
      player_could_have_played({ player: shi_smith, season_year: 2023 })
    ).to.equal(true)
  })

  it('accepts an undrafted player inside the entry-year grace window', () => {
    // The false-positive class this module exists for: `nfl_draft_year` on an
    // undrafted row is an entry year, not a debut year. cory procter carries
    // 2007 against real gamelogs from 2005 and 2006.
    const cory_procter = { nfl_draft_year: 2007, draft_round: 0 }
    expect(
      player_could_have_played({ player: cory_procter, season_year: 2006 })
    ).to.equal(true)
    expect(
      player_could_have_played({ player: cory_procter, season_year: 2005 })
    ).to.equal(true)
  })

  it('rejects an undrafted player beyond the grace window', () => {
    // Two years absorbs the bookkeeping offset; past that the gap is a
    // different person rather than a mis-recorded entry year.
    const cory_procter = { nfl_draft_year: 2007, draft_round: 0 }
    expect(
      player_could_have_played({ player: cory_procter, season_year: 2004 })
    ).to.equal(false)
    expect(
      player_could_have_played({ player: cory_procter, season_year: 1999 })
    ).to.equal(false)
  })

  it('treats a null draft_round as undrafted rather than as drafted', () => {
    const undrafted = { nfl_draft_year: 2010, draft_round: null }
    expect(
      player_could_have_played({ player: undrafted, season_year: 2008 })
    ).to.equal(true)
    expect(
      player_could_have_played({ player: undrafted, season_year: 2007 })
    ).to.equal(false)
  })

  it('passes every case where the evidence cannot falsify', () => {
    // The predicate rejects an impossible attribution; it never confirms a
    // possible one, so absent evidence has to pass.
    expect(
      player_could_have_played({
        player: { nfl_draft_year: null, draft_round: 3 },
        season_year: 2005
      })
    ).to.equal(true)
    expect(
      player_could_have_played({
        player: { nfl_draft_year: 2021, draft_round: 6 },
        season_year: null
      })
    ).to.equal(true)
    expect(
      player_could_have_played({ player: null, season_year: 2005 })
    ).to.equal(true)
  })
})
