/* global describe it */
import * as chai from 'chai'

import {
  build_untyped_market_key,
  is_untyped_market_key,
  build_market_label,
  build_market_group,
  build_market_navigation
} from '#app/views/components/selected-player-markets/market-navigation.js'

process.env.NODE_ENV = 'test'
const expect = chai.expect

// The Betting Markets tab's first goal is to REACH any of a player's markets.
// The old navigator keyed every untyped market on its source_market_name, which
// for the worst player produced 570 entries of raw enum strings under three
// headings. The two assertions that matter are that the count drops and that
// nothing becomes unreachable; a collapse that loses a market would satisfy the
// first alone.
describe('APP selected-player-markets navigation', function () {
  // Stands in for one player's payload: a realistic typed set plus an untyped
  // tail from two books, which is the shape that caused the explosion.
  const build_market_keys = () => {
    const typed = [
      'GAME_PASSING_YARDS',
      'GAME_ALT_PASSING_YARDS',
      'GAME_RUSHING_YARDS',
      'GAME_RECEIVING_YARDS',
      'GAME_RECEPTIONS',
      'GAME_PASSING_TOUCHDOWNS',
      'GAME_PASSING_INTERCEPTIONS',
      'GAME_FIELD_GOALS_MADE',
      'GAME_DEFENSE_SACKS',
      'ANYTIME_TOUCHDOWN',
      'GAME_TWO_PLUS_TOUCHDOWNS',
      'GAME_PASSING_RUSHING_YARDS',
      'GAME_FIRST_QUARTER_PASSING_YARDS',
      'GAME_FIRST_HALF_ALT_RUSHING_YARDS',
      'SEASON_PASSING_YARDS'
    ]
    const untyped = ['DRAFTKINGS', 'FANDUEL'].map(build_untyped_market_key)
    return [...typed, ...untyped]
  }

  describe('reaching every market', function () {
    it('emits exactly one option per key, losing none', function () {
      const market_keys = build_market_keys()
      const options = build_market_navigation(market_keys)

      // The reachability assertion. A collapse that dropped a key would still
      // reduce the entry count, which is why the count alone is not the check.
      expect(options.map((option) => option.key).sort()).to.deep.equal(
        [...market_keys].sort()
      )
      expect(options.length).to.equal(market_keys.length)
    })

    it('gives every option a label and a group', function () {
      for (const option of build_market_navigation(build_market_keys())) {
        expect(option.label, option.key).to.be.a('string').that.is.not.empty
        expect(option.group, option.key).to.be.a('string').that.is.not.empty
      }
    })

    it('keeps a book untyped tail as one reachable entry', function () {
      const key = build_untyped_market_key('DRAFTKINGS')
      expect(is_untyped_market_key(key)).to.equal(true)
      expect(build_market_group(key)).to.equal('Uncategorized')
      expect(build_market_label(key)).to.equal('Draftkings — uncategorized')
    })

    it('cannot collide an untyped key with a market type', function () {
      // Every real market_type is bare SCREAMING_SNAKE. The prefix is what keeps
      // a book named like a market type from taking over its entry.
      expect(is_untyped_market_key('GAME_PASSING_YARDS')).to.equal(false)
      expect(build_untyped_market_key('GAME_PASSING_YARDS')).to.not.equal(
        'GAME_PASSING_YARDS'
      )
    })
  })

  describe('labels', function () {
    it('shortens the common types', function () {
      expect(build_market_label('GAME_PASSING_YARDS')).to.equal('Pass Yds')
      expect(build_market_label('GAME_ALT_PASSING_YARDS')).to.equal(
        'Alt Pass Yds'
      )
      expect(build_market_label('GAME_RECEPTIONS')).to.equal('Rec')
      expect(build_market_label('GAME_PASSING_INTERCEPTIONS')).to.equal(
        'Pass Ints'
      )
    })

    it('names the awkward ones explicitly rather than deriving them', function () {
      expect(build_market_label('ANYTIME_TOUCHDOWN')).to.equal('Anytime TD')
      expect(build_market_label('GAME_TWO_PLUS_TOUCHDOWNS')).to.equal('2+ TDs')
      expect(build_market_label('GAME_PASSING_RUSHING_YARDS')).to.equal(
        'Pass + Rush Yds'
      )
    })

    it('carries the period into the label where two options would otherwise read alike', function () {
      // Both are passing yards. Without the period in the label the option list
      // shows the same string twice in different groups.
      expect(build_market_label('GAME_PASSING_YARDS')).to.equal('Pass Yds')
      expect(build_market_label('GAME_FIRST_QUARTER_PASSING_YARDS')).to.equal(
        'First Quarter Pass Yds'
      )
      expect(build_market_label('GAME_FIRST_HALF_ALT_RUSHING_YARDS')).to.equal(
        'First Half Alt Rush Yds'
      )
    })

    it('labels an unrecognised type rather than dropping it', function () {
      // The market-type taxonomy is under active normalisation, so a shape this
      // module has never seen has to survive it.
      const label = build_market_label('GAME_SOMETHING_BRAND_NEW')
      expect(label).to.be.a('string').that.is.not.empty
      expect(build_market_group('GAME_SOMETHING_BRAND_NEW')).to.be.a('string')
        .that.is.not.empty
    })
  })

  describe('groups', function () {
    it('groups by period and stat family', function () {
      expect(build_market_group('GAME_PASSING_YARDS')).to.equal(
        'Game · Passing'
      )
      expect(build_market_group('SEASON_PASSING_YARDS')).to.equal(
        'Season · Passing'
      )
      expect(build_market_group('GAME_FIRST_QUARTER_PASSING_YARDS')).to.equal(
        'First Quarter · Passing'
      )
      expect(build_market_group('GAME_RECEPTIONS')).to.equal('Game · Receiving')
      expect(build_market_group('GAME_DEFENSE_SACKS')).to.equal(
        'Game · Defense'
      )
      expect(build_market_group('GAME_FIELD_GOALS_MADE')).to.equal(
        'Game · Kicking'
      )
    })

    it('keeps a combined market out of the single-stat groups', function () {
      // Pass + rush yards matches both PASSING and RUSHING, so order in the
      // family table is load-bearing rather than incidental.
      expect(build_market_group('GAME_PASSING_RUSHING_YARDS')).to.equal(
        'Game · Combined'
      )
      expect(build_market_group('GAME_RUSHING_RECEIVING_YARDS')).to.equal(
        'Game · Combined'
      )
    })

    it('orders options so each group heading appears once', function () {
      // MUI Autocomplete groups CONSECUTIVE options only, so an unsorted list
      // renders the same heading several times. This is the assertion that
      // catches it, and it fails if the sort is removed.
      const options = build_market_navigation(build_market_keys())
      const headings = options.map((option) => option.group)
      const first_seen = headings.filter(
        (heading, index) => headings.indexOf(heading) === index
      )
      expect(headings.length).to.be.greaterThan(first_seen.length)

      let previous = null
      const runs = []
      for (const heading of headings) {
        if (heading !== previous) runs.push(heading)
        previous = heading
      }
      expect(runs).to.deep.equal(first_seen)
    })

    it('puts per-game markets first and the uncategorized tail last', function () {
      const options = build_market_navigation(build_market_keys())
      expect(options[0].group).to.match(/^Game/)
      expect(options[options.length - 1].group).to.equal('Uncategorized')
    })
  })
})
