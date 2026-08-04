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

  it('rejects a player who had not been born twenty years before the season', () => {
    // The residual the draft check alone left behind: a player row born 2000
    // carrying 62 gamelog rows from 2001-2006.
    const josh_williams = {
      nfl_draft_year: 2025,
      draft_round: 0,
      date_of_birth: '2000-06-09'
    }
    expect(
      player_could_have_played({ player: josh_williams, season_year: 2001 })
    ).to.equal(false)
  })

  it('accepts a twenty-year-old, the youngest a real NFL player has been', () => {
    // amobi okoye, rookie season 2007. The predicate must never reject him.
    const amobi_okoye = {
      nfl_draft_year: 2007,
      draft_round: 1,
      date_of_birth: '1987-06-03'
    }
    expect(
      player_could_have_played({ player: amobi_okoye, season_year: 2007 })
    ).to.equal(true)
  })

  it('rejects on birth date even when the draft year would accept', () => {
    // The two falsifiers are independent, and this is the case that needs the
    // birth date: a conflated row whose draft year is plausible for the season
    // while the person named could not have been there.
    const conflated = {
      nfl_draft_year: 2001,
      draft_round: 3,
      date_of_birth: '1999-01-14'
    }
    expect(
      player_could_have_played({ player: conflated, season_year: 2002 })
    ).to.equal(false)
  })

  it('accepts on birth date when the draft year is the field that is wrong', () => {
    // The regression this ordering exists to prevent, with the real row. The
    // 2013 devin taylor was born 1989-11-15 and drafted in round 4, but his
    // `player` row is a merge with a later player and reads
    // `nfl_draft_year: 2022`. Draft-year-only, that condemns his real
    // 2013-2015 Detroit gamelogs -- 19 of the 450 rows a repair run deleted.
    const devin_taylor = {
      nfl_draft_year: 2022,
      draft_round: 4,
      date_of_birth: '1989-11-15'
    }
    expect(
      player_could_have_played({ player: devin_taylor, season_year: 2013 })
    ).to.equal(true)
  })

  it('accepts a father whose row carries his son the draft year', () => {
    // The same shape at its most extreme, and the largest single group in that
    // deletion: kwamie lassiter (Cardinals, 1995-2003) born 1969-12-03, on a
    // row carrying kwamie lassiter II's 2022 entry year. 58 rows.
    const kwamie_lassiter = {
      nfl_draft_year: 2022,
      draft_round: 0,
      date_of_birth: '1969-12-03'
    }
    expect(
      player_could_have_played({ player: kwamie_lassiter, season_year: 2001 })
    ).to.equal(true)
  })

  it('passes a DRAFTED player whose birth date clears the floor and whose draft year does not', () => {
    // maurice alexander, as production carried him on 2026-08-04. dob and
    // draft_round 4 are the 2014 Utah State safety; college and
    // nfl_draft_year 2020 came from a later same-name player's importer match.
    // The draft-only predicate NULLed his 204 correct 2014-2019 play stats and
    // KEPT the 33 rows from 2024 that belong to the intruder -- this pins the
    // dob-present case that f26685ef3 fixed, on a drafted row, where the old
    // `nfl_draft_year <= season_year` branch had no grace window at all.
    const maurice_alexander = {
      nfl_draft_year: 2020,
      draft_round: 4,
      date_of_birth: '1991-02-16'
    }
    expect(
      player_could_have_played({
        player: maurice_alexander,
        season_year: 2014
      })
    ).to.equal(true)
    expect(
      player_could_have_played({
        player: maurice_alexander,
        season_year: 2019
      })
    ).to.equal(true)
  })

  it('still falls back to the draft year when no birth date is recorded', () => {
    // The fallback is not dead code: it is the only evidence for a row with no
    // usable birth date, and it must keep rejecting there.
    const no_birth_date = { nfl_draft_year: 2021, draft_round: 6 }
    expect(
      player_could_have_played({ player: no_birth_date, season_year: 2016 })
    ).to.equal(false)
  })

  it('ignores the 0000-00-00 unknown-birth-date sentinel', () => {
    // `date_of_birth` is a varchar and spells absent as a zero date. Reading a
    // year off it would reject every row the player appears in.
    const unknown_dob = {
      nfl_draft_year: 2010,
      draft_round: 2,
      date_of_birth: '0000-00-00'
    }
    expect(
      player_could_have_played({ player: unknown_dob, season_year: 2012 })
    ).to.equal(true)
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
