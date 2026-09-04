/* global describe, it */

import * as chai from 'chai'

import {
  get_caesars_futures_subject,
  get_caesars_futures_subject_positions
} from '#libs-server/caesars/caesars-futures-subject.mjs'

const expect = chai.expect

// Figures below were measured on a live crawl of all 16 competition tabs on
// 2026-09-04, held in scratch/league/caesars-futures-templates/.

describe('libs-server caesars futures subject', function () {
  describe('the player family', function () {
    // 310 of 318 player futures markets carry NO metadata.player. The subject
    // is only in `name`, which is the whole reason this module exists.
    it('reads the subject from name when metadata is empty', function () {
      expect(
        get_caesars_futures_subject({
          template_name: '|Player| |Total Regular Season Passing Yards|',
          name: '|Cam Ward| |Total Regular Season Passing Yards|',
          metadata: {}
        })
      ).to.deep.equal({ player_name: 'Cam Ward', positions: ['QB'] })
    })

    // The placeholder decides the grain, not the metadata. Eight player markets
    // carry a teamAbbr naming the player's club; reading it would turn those
    // eight into team markets and only those eight.
    it('stays a player market when the feed also supplies a team', function () {
      expect(
        get_caesars_futures_subject({
          template_name: '|Player| |Total Regular Season Sacks|',
          name: '|Abdul Carter| |Total Regular Season Sacks|',
          metadata: { teamAbbr: 'NYG' }
        })
      ).to.deep.equal({
        player_name: 'Abdul Carter',
        positions: ['DL', 'DE', 'DT', 'NT', 'LB', 'ILB', 'OLB', 'MLB', 'EDGE']
      })
    })
  })

  // THE DISAMBIGUATOR, AND THE ONLY THING IT MAY DO.
  //
  // Three Josh Allens (QB BUF, DL JAX, retired OL) and two active Justin
  // Jeffersons (WR MIN, LB CLE) cost 9 futures markets their selection_pid on
  // every run, because _select_best_match refuses on multiple matches. The
  // importer applies these positions as a SECOND pass, so the set can only turn
  // a null into a pid.
  describe('the statistic-to-position map', function () {
    it('reads a quarterback statistic as quarterback-only', function () {
      expect(
        get_caesars_futures_subject_positions(
          'Total Regular Season Passing Yards'
        )
      ).to.deep.equal(['QB'])
      expect(
        get_caesars_futures_subject_positions(
          'Total Regular Season Touchdown Passes'
        )
      ).to.deep.equal(['QB'])
    })

    // The pair that decides the six Josh Allen markets. A rushing total belongs
    // to a quarterback as readily as to a back, so the set must include QB --
    // and the combined form must resolve QB-only rather than widening, which is
    // what the first-match ordering buys.
    it('includes quarterbacks in a rushing set and keeps the combined form narrow', function () {
      expect(
        get_caesars_futures_subject_positions(
          'Total Regular Season Rushing Yards'
        )
      ).to.include('QB')
      expect(
        get_caesars_futures_subject_positions(
          'Total Regular Season Passing + Rushing Yards'
        )
      ).to.deep.equal(['QB'])
    })

    // The three Justin Jefferson markets. WR MIN and LB CLE are separated by
    // the receiving set holding neither LB nor any of its spellings.
    it('reads a receiving statistic as skill positions only', function () {
      const positions = get_caesars_futures_subject_positions(
        'Total Regular Season Receiving Yards'
      )
      expect(positions).to.include('WR')
      expect(positions).to.not.include('LB')
      expect(
        get_caesars_futures_subject_positions('Total Regular Season Receptions')
      ).to.include('WR')
    })

    // An unmapped statistic must yield an EMPTY set, not a guess. The importer
    // skips the second pass entirely on empty, so the market keeps the safe
    // null it already had.
    it('returns an empty set for a statistic it does not know', function () {
      expect(
        get_caesars_futures_subject_positions(
          'Total Regular Season Field Goals'
        )
      ).to.deep.equal([])
      expect(get_caesars_futures_subject_positions('')).to.deep.equal([])
      expect(get_caesars_futures_subject_positions(undefined)).to.deep.equal([])
    })
  })

  describe('the team family', function () {
    it('reads metadata.teamAbbr without parsing the name', function () {
      expect(
        get_caesars_futures_subject({
          template_name: '|Team| |Regular Season Wins|',
          name: '|Arizona Cardinals| |Regular Season Wins|',
          metadata: { teamAbbr: 'ARI' }
        })
      ).to.deep.equal({ nfl_team: 'ARI' })
    })

    // Caesars writes the Rams as LAR; league's canonical abbreviation is LA.
    // Storing the raw value would use a team code nothing else in the database
    // does, so this is the assertion that keeps the join working.
    it('normalises the vendor abbreviation to league canon', function () {
      expect(
        get_caesars_futures_subject({
          template_name: '|Team| |Regular Season Wins|',
          name: '|Los Angeles Rams| |Regular Season Wins|',
          metadata: { teamAbbr: 'LAR' }
        })
      ).to.deep.equal({ nfl_team: 'LA' })
    })

    it('falls back to the name when teamAbbr is missing', function () {
      expect(
        get_caesars_futures_subject({
          template_name: '|Team| |Regular Season Wins|',
          name: '|Los Angeles Rams| |Regular Season Wins|',
          metadata: {}
        })
      ).to.deep.equal({ nfl_team: 'LA' })
    })
  })

  describe('markets with no market-level subject', function () {
    // 861 of 1,542 futures markets are single-segment templates where the
    // SELECTION is the subject. Inventing a market-level subject for these
    // would attribute a whole field of players to one of them.
    it('declines on a single-segment template', function () {
      expect(
        get_caesars_futures_subject({
          template_name: '|Regular Season MVP|',
          name: '|Regular Season MVP|',
          metadata: {}
        })
      ).to.equal(null)
    })

    // THE CASE THAT MOTIVATES THE PLACEHOLDER RULE. The statistic-first
    // arrangement puts the STATISTIC in the leading segment, so reading
    // position blindly would return a player named 'Most Passing Yards'.
    it('declines on a statistic-first template', function () {
      expect(
        get_caesars_futures_subject({
          template_name:
            '|Most Passing Yards| |Regular Season - Individual Player|',
          name: '|Most Passing Yards| |Regular Season - Individual Player|',
          metadata: {}
        })
      ).to.equal(null)
    })

    it('declines on every statistic-first template in the family', function () {
      const statistic_first = [
        '|Most Receiving Yards| |Regular Season - Individual Player|',
        '|Most Sacks In a Single Game| |Regular Season - Individual Player|',
        '|Longest Rush| |Regular Season|',
        '|Total Overtime Games| |Regular Season|'
      ]

      for (const template_name of statistic_first) {
        expect(
          get_caesars_futures_subject({
            template_name,
            name: template_name,
            metadata: {}
          })
        ).to.equal(null)
      }
    })
  })

  describe('the alignment assertion', function () {
    // Taking the leading segment by POSITION is only safe while the two strings
    // are aligned -- measured 318 of 318 with zero exceptions. A drifted name
    // shape must refuse rather than return a confidently wrong player.
    it('throws when the trailing segments disagree', function () {
      expect(() =>
        get_caesars_futures_subject({
          template_name: '|Player| |Total Regular Season Sacks|',
          name: '|Cam Ward| |Total Regular Season Rushing Yards|',
          metadata: {}
        })
      ).to.throw(/does not align/)
    })

    it('throws when the name has a different segment count', function () {
      expect(() =>
        get_caesars_futures_subject({
          template_name: '|Player| |Total Regular Season Sacks|',
          name: '|Cam Ward|',
          metadata: {}
        })
      ).to.throw(/does not align/)
    })

    it('does not throw on the aligned form', function () {
      expect(() =>
        get_caesars_futures_subject({
          template_name: '|Player| |Total Regular Season Sacks|',
          name: '|Cam Ward| |Total Regular Season Sacks|',
          metadata: {}
        })
      ).to.not.throw()
    })
  })

  it('returns null on absent input rather than throwing', function () {
    expect(get_caesars_futures_subject({})).to.equal(null)
    expect(get_caesars_futures_subject()).to.equal(null)
  })
})
