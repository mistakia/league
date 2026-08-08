/* global describe, it */
import * as chai from 'chai'

import { era_permits_identifier_attach } from '#libs-server/era-permits-identifier-attach.mjs'

process.env.NODE_ENV = 'test'
chai.should()

// The shape this guard exists for, taken from DEVI-TAYL-016049. gsis_it_player_id
// 40080 carries 956 snaps across 2016 and 2017 (measured against production
// 2026-08-05). The row it belongs to is an ordinary drafted-2013 player -- the
// defect is a NAME match landing that identifier on a DIFFERENT Devin Taylor
// whose career starts years later, which is how `nfl_draft_year` 2013 became
// 2022 on a single conflated row.
//
// Note both rows below carry the `0000-00-00` sentinel rather than a real birth
// date. That is not incidental: `player_could_have_played` lets a usable birth
// date decide on its own, so this guard can only ever fire on a row without
// one. That is the population it is for.
const SNAP_SEASONS = [2016, 2017]

const era_impossible_row = {
  pid: 'DEVI-TAYL-999999',
  date_of_birth: '0000-00-00',
  nfl_draft_year: 2022,
  draft_round: 4
}

const same_era_row = {
  pid: 'DEVI-TAYL-016049',
  date_of_birth: '0000-00-00',
  nfl_draft_year: 2013,
  draft_round: 4
}

describe('LIBS-SERVER era_permits_identifier_attach', function () {
  it('refuses to attach an identifier to a row that had not entered the league', () => {
    const result = era_permits_identifier_attach({
      player_row: era_impossible_row,
      season_years: SNAP_SEASONS
    })

    result.permitted.should.equal(false)
    // The EARLIEST season is what falsifies, and the caller logs it.
    result.season_year.should.equal(2016)
  })

  it('permits an ordinary same-era match', () => {
    era_permits_identifier_attach({
      player_row: same_era_row,
      season_years: SNAP_SEASONS
    }).permitted.should.equal(true)
  })

  it('falsifies on the earliest season, not the latest', () => {
    // Drafted 2017: possible for the 2017 snaps, impossible for the 2016 ones.
    // Reading the max would have permitted this attach.
    era_permits_identifier_attach({
      player_row: {
        date_of_birth: '0000-00-00',
        nfl_draft_year: 2017,
        draft_round: 1
      },
      season_years: SNAP_SEASONS
    }).permitted.should.equal(false)
  })

  it('permits when a usable birth date clears the age floor, whatever the draft year says', () => {
    // A draft year contradicting a birth date is evidence the row merges two
    // people, not evidence about this season. Deferring to the birth date here
    // is `player_could_have_played`'s contract and this guard must not
    // second-guess it.
    era_permits_identifier_attach({
      player_row: {
        date_of_birth: '1989-11-15',
        nfl_draft_year: 2022,
        draft_round: 4
      },
      season_years: SNAP_SEASONS
    }).permitted.should.equal(true)
  })

  it('permits an undrafted row inside the entry-year grace window', () => {
    // `nfl_draft_year` is an entry year rather than a debut year for an
    // undrafted player, and routinely postdates the real first appearance.
    era_permits_identifier_attach({
      player_row: {
        date_of_birth: '0000-00-00',
        nfl_draft_year: 2018,
        draft_round: 0
      },
      season_years: SNAP_SEASONS
    }).permitted.should.equal(true)
  })

  it('permits when there is no season evidence to falsify with', () => {
    // Absent evidence must never be read as a rejection -- an empty list means
    // the identifier was observed nowhere, not that the match is wrong.
    era_permits_identifier_attach({
      player_row: era_impossible_row,
      season_years: []
    }).permitted.should.equal(true)

    era_permits_identifier_attach({
      player_row: era_impossible_row,
      season_years: undefined
    }).permitted.should.equal(true)
  })

  it('ignores unusable season values rather than letting them decide', () => {
    era_permits_identifier_attach({
      player_row: era_impossible_row,
      season_years: [null, 0, 'not a season']
    }).permitted.should.equal(true)

    // A junk value alongside a real one must not become the minimum.
    era_permits_identifier_attach({
      player_row: same_era_row,
      season_years: [0, 2016]
    }).permitted.should.equal(true)
  })
})
