/* global describe it */

// Payload-parsing tests for the external-league trade importer.
//
// The fixtures below are real Sleeper responses captured from league
// 1182953443152855040 (a 12-team dynasty superflex league) while designing the
// schema, trimmed to the fields the parser reads. They are the reason these
// tests are worth having: this parser's job is to survive a vendor payload it
// does not control, and the failure mode is silent -- a dropped draft_picks
// array or a mis-attributed roster id produces rows that look fine and encode
// the wrong exchange.

import * as chai from 'chai'

import {
  derive_is_superflex,
  parse_sleeper_league,
  parse_sleeper_trade,
  parse_sleeper_transactions
} from '#libs-server/external-league-trades/sleeper-trade-parser.mjs'

const expect = chai.expect

const dynasty_superflex_league = {
  league_id: '1182953443152855040',
  name: 'TA1 - Traders Anonymous',
  season: '2025',
  total_rosters: 12,
  previous_league_id: '1048178518657568768',
  settings: { type: 2, num_teams: 12, taxi_slots: 4, best_ball: 0 },
  roster_positions: [
    'QB',
    'RB',
    'RB',
    'WR',
    'WR',
    'WR',
    'TE',
    'FLEX',
    'FLEX',
    'SUPER_FLEX',
    'BN'
  ],
  scoring_settings: { rec: 1.0, pass_td: 4, bonus_rec_te: 0.5 }
}

// Real week-1 trade: three players moving both directions plus a 2027 2nd.
const player_and_pick_trade = {
  type: 'trade',
  status: 'complete',
  transaction_id: '1270939998643834880',
  created: 1757378217901,
  roster_ids: [5, 10],
  adds: { 12503: 10, 12534: 5, 9500: 5 },
  drops: { 12503: 5, 12534: 10, 9500: 10 },
  draft_picks: [
    {
      round: 2,
      season: '2027',
      league_id: null,
      roster_id: 5,
      owner_id: 10,
      previous_owner_id: 5
    }
  ],
  waiver_budget: []
}

describe('libs-server external-league-trades sleeper-trade-parser', function () {
  describe('derive_is_superflex', function () {
    it('detects an explicit SUPER_FLEX slot', function () {
      expect(derive_is_superflex(['QB', 'RB', 'SUPER_FLEX'])).to.equal(true)
    })

    // A 2QB league moves QB value just like superflex does. Matching only the
    // SUPER_FLEX literal would file these as single-QB and make every QB trade
    // in them uncomparable.
    it('treats a two-QB league as superflex', function () {
      expect(derive_is_superflex(['QB', 'QB', 'RB', 'WR'])).to.equal(true)
    })

    it('does not flag a single-QB league', function () {
      expect(derive_is_superflex(['QB', 'RB', 'WR', 'FLEX'])).to.equal(false)
    })

    it('handles a missing roster_positions array', function () {
      expect(derive_is_superflex(undefined)).to.equal(false)
    })
  })

  describe('parse_sleeper_league', function () {
    it('maps format metadata from a real dynasty superflex payload', function () {
      const row = parse_sleeper_league({
        league: dynasty_superflex_league,
        discovered_via: 'seed'
      })

      expect(row.platform).to.equal('sleeper')
      expect(row.external_league_id).to.equal('1182953443152855040')
      expect(row.season_year).to.equal(2025)
      expect(row.league_format).to.equal('dynasty')
      expect(row.is_superflex).to.equal(true)
      expect(row.is_best_ball).to.equal(false)
      expect(row.points_per_reception).to.equal(1)
      expect(row.tight_end_premium).to.equal(0.5)
      expect(row.passing_touchdown_points).to.equal(4)
      expect(row.num_teams).to.equal(12)
      expect(row.taxi_slots).to.equal(4)
      expect(row.previous_external_league_id).to.equal('1048178518657568768')
      expect(row.discovered_via).to.equal('seed')
    })

    it('maps redraft and keeper league types', function () {
      const redraft = parse_sleeper_league({
        league: { ...dynasty_superflex_league, settings: { type: 0 } }
      })
      expect(redraft.league_format).to.equal('redraft')

      const keeper = parse_sleeper_league({
        league: { ...dynasty_superflex_league, settings: { type: 1 } }
      })
      expect(keeper.league_format).to.equal('keeper')
    })

    // Guessing a format is worse than dropping the league: dynasty and redraft
    // price the same player completely differently.
    it('rejects a league whose type is unknown rather than guessing', function () {
      const row = parse_sleeper_league({
        league: { ...dynasty_superflex_league, settings: { type: 99 } }
      })
      expect(row).to.equal(null)
    })

    it('returns null for an empty payload', function () {
      expect(parse_sleeper_league({ league: null })).to.equal(null)
    })

    // Sleeper ends a league-season chain with the STRING "0" rather than null.
    // Treating that as a real id sends the history crawl off to fetch league 0,
    // which 404s and books a phantom "skipped" league on every chain walked.
    it('treats a "0" previous_league_id as end-of-chain', function () {
      const row = parse_sleeper_league({
        league: { ...dynasty_superflex_league, previous_league_id: '0' }
      })
      expect(row.previous_external_league_id).to.equal(null)
    })

    it('treats a missing previous_league_id as end-of-chain', function () {
      const row = parse_sleeper_league({
        league: { ...dynasty_superflex_league, previous_league_id: null }
      })
      expect(row.previous_external_league_id).to.equal(null)
    })
  })

  describe('parse_sleeper_trade', function () {
    const parsed = parse_sleeper_trade({
      transaction: player_and_pick_trade,
      external_league_id: '1182953443152855040',
      season_year: 2025,
      platform_transaction_bucket: 1
    })

    it('maps the trade row', function () {
      expect(parsed.trade.external_transaction_id).to.equal(
        '1270939998643834880'
      )
      expect(parsed.trade.external_league_id).to.equal('1182953443152855040')
      expect(parsed.trade.season_year).to.equal(2025)
      expect(parsed.trade.platform_transaction_bucket).to.equal(1)
      expect(parsed.trade.num_sides).to.equal(2)
      expect(parsed.trade.processed_at.getTime()).to.equal(1757378217901)
    })

    it('emits one leg per moved player and per pick', function () {
      expect(parsed.legs).to.have.lengthOf(4)
      expect(
        parsed.legs.filter((l) => l.leg_type === 'player')
      ).to.have.lengthOf(3)
      expect(parsed.legs.filter((l) => l.leg_type === 'pick')).to.have.lengthOf(
        1
      )
    })

    // adds names the receiver and drops the sender for the same player; getting
    // this backwards inverts the entire exchange.
    it('takes direction from adds (receiver) and drops (sender)', function () {
      const leg = parsed.legs.find((l) => l.external_player_id === '12503')
      expect(leg.to_roster_id).to.equal(10)
      expect(leg.from_roster_id).to.equal(5)

      const reverse = parsed.legs.find((l) => l.external_player_id === '9500')
      expect(reverse.to_roster_id).to.equal(5)
      expect(reverse.from_roster_id).to.equal(10)
    })

    // owner_id is the receiver, previous_owner_id the sender, and roster_id the
    // roster the pick originally belonged to. All three are different numbers
    // and conflating them mis-attributes the pick.
    it('distinguishes pick receiver, sender, and original owner', function () {
      const pick = parsed.legs.find((l) => l.leg_type === 'pick')
      expect(pick.to_roster_id).to.equal(10)
      expect(pick.from_roster_id).to.equal(5)
      expect(pick.pick_original_roster_id).to.equal(5)
      expect(pick.pick_season_year).to.equal(2027)
      expect(pick.pick_round).to.equal(2)
      expect(pick.external_player_id).to.equal(null)
    })

    it('assigns contiguous leg indexes', function () {
      expect(parsed.legs.map((l) => l.leg_index)).to.eql([0, 1, 2, 3])
    })

    // A pick-only trade is a real exchange and must not be dropped for having
    // no players; picks dominate dynasty trading.
    it('parses a trade carrying only draft picks', function () {
      const result = parse_sleeper_trade({
        transaction: {
          type: 'trade',
          status: 'complete',
          transaction_id: '999',
          created: 1757860222578,
          roster_ids: [3, 6],
          adds: null,
          drops: null,
          draft_picks: [
            {
              round: 1,
              season: '2028',
              roster_id: 3,
              owner_id: 6,
              previous_owner_id: 3
            },
            {
              round: 3,
              season: '2027',
              roster_id: 6,
              owner_id: 3,
              previous_owner_id: 6
            }
          ],
          waiver_budget: []
        },
        external_league_id: 'L',
        season_year: 2025,
        platform_transaction_bucket: 2
      })

      expect(result.legs).to.have.lengthOf(2)
      expect(result.legs.every((l) => l.leg_type === 'pick')).to.equal(true)
    })

    it('parses FAAB legs', function () {
      const result = parse_sleeper_trade({
        transaction: {
          type: 'trade',
          status: 'complete',
          transaction_id: '1000',
          created: 1757860222578,
          roster_ids: [1, 2],
          adds: { 4034: 1 },
          drops: { 4034: 2 },
          waiver_budget: [{ sender: 1, receiver: 2, amount: 15 }]
        },
        external_league_id: 'L',
        season_year: 2025,
        platform_transaction_bucket: 3
      })

      const faab = result.legs.find((l) => l.leg_type === 'faab')
      expect(faab.faab_amount).to.equal(15)
      expect(faab.from_roster_id).to.equal(1)
      expect(faab.to_roster_id).to.equal(2)
    })

    // Only completed trades are realized exchanges. A vetoed or pending trade
    // carries no indifference constraint.
    it('rejects non-complete trades', function () {
      for (const status of ['vetoed', 'pending', 'failed']) {
        const result = parse_sleeper_trade({
          transaction: { ...player_and_pick_trade, status },
          external_league_id: 'L',
          season_year: 2025,
          platform_transaction_bucket: 1
        })
        expect(result, status).to.equal(null)
      }
    })

    it('rejects non-trade transaction types', function () {
      const result = parse_sleeper_trade({
        transaction: { ...player_and_pick_trade, type: 'waiver' },
        external_league_id: 'L',
        season_year: 2025,
        platform_transaction_bucket: 1
      })
      expect(result).to.equal(null)
    })

    // A "trade" where everything flows to one roster is not an exchange and
    // would enter the fit as a free acquisition.
    it('rejects a one-sided trade', function () {
      const result = parse_sleeper_trade({
        transaction: {
          type: 'trade',
          status: 'complete',
          transaction_id: '1001',
          created: 1757860222578,
          roster_ids: [1, 2],
          adds: { 4034: 1, 5555: 1 },
          drops: { 4034: 2, 5555: 2 }
        },
        external_league_id: 'L',
        season_year: 2025,
        platform_transaction_bucket: 1
      })
      expect(result).to.equal(null)
    })

    it('rejects a trade with no assets at all', function () {
      const result = parse_sleeper_trade({
        transaction: {
          type: 'trade',
          status: 'complete',
          transaction_id: '1002',
          created: 1757860222578,
          roster_ids: [1, 2]
        },
        external_league_id: 'L',
        season_year: 2025,
        platform_transaction_bucket: 1
      })
      expect(result).to.equal(null)
    })

    // Three-way trades occur and must not be flattened into a two-side
    // assumption.
    it('records more than two sides when present', function () {
      const result = parse_sleeper_trade({
        transaction: {
          type: 'trade',
          status: 'complete',
          transaction_id: '1003',
          created: 1757860222578,
          roster_ids: [1, 2, 3],
          adds: { 100: 1, 200: 2, 300: 3 },
          drops: { 100: 2, 200: 3, 300: 1 }
        },
        external_league_id: 'L',
        season_year: 2025,
        platform_transaction_bucket: 1
      })
      expect(result.trade.num_sides).to.equal(3)
      expect(result.legs).to.have.lengthOf(3)
    })
  })

  describe('parse_sleeper_transactions', function () {
    it('keeps only completed trades from a mixed payload', function () {
      const results = parse_sleeper_transactions({
        transactions: [
          player_and_pick_trade,
          { type: 'waiver', status: 'complete', transaction_id: 'w1' },
          { type: 'free_agent', status: 'complete', transaction_id: 'f1' },
          { ...player_and_pick_trade, transaction_id: 'v1', status: 'vetoed' }
        ],
        external_league_id: '1182953443152855040',
        season_year: 2025,
        platform_transaction_bucket: 1
      })

      expect(results).to.have.lengthOf(1)
      expect(results[0].trade.external_transaction_id).to.equal(
        '1270939998643834880'
      )
    })

    it('handles an empty payload', function () {
      expect(
        parse_sleeper_transactions({
          transactions: [],
          external_league_id: 'L',
          season_year: 2025,
          platform_transaction_bucket: 1
        })
      ).to.have.lengthOf(0)
    })
  })
})
