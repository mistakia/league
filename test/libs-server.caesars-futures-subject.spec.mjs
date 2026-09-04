/* global describe, it */

import * as chai from 'chai'

import { get_caesars_futures_subject } from '#libs-server/caesars/caesars-futures-subject.mjs'

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
      ).to.deep.equal({ player_name: 'Cam Ward' })
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
      ).to.deep.equal({ player_name: 'Abdul Carter' })
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
