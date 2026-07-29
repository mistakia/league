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
  derive_has_individual_defensive_players,
  derive_is_superflex,
  is_sleeper_identifier,
  parse_sleeper_league,
  parse_sleeper_league_member_users,
  parse_sleeper_trade,
  parse_sleeper_transactions,
  parse_sleeper_user_leagues,
  sleeper_transaction_buckets_to_fetch
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
    // These fields ride along on a payload the crawl already fetches. The unit
    // conversion is the part worth pinning: Sleeper sends last_message_time in
    // epoch MILLISECONDS, and reading it as seconds lands the timestamp in 1970,
    // which would make every liveness comparison quietly wrong rather than loud.
    describe('crawl-captured payload fields', function () {
      it('converts last_message_time from epoch milliseconds', function () {
        const row = parse_sleeper_league({
          league: {
            league_id: 'L1',
            season: '2026',
            settings: { type: 2 },
            last_message_time: 1785222390958
          }
        })

        expect(row.last_message_at).to.be.instanceOf(Date)
        expect(row.last_message_at.getTime()).to.equal(1785222390958)
        expect(row.last_message_at.getUTCFullYear()).to.equal(2026)
      })

      it('captures status, draft id, settings and metadata', function () {
        const row = parse_sleeper_league({
          league: {
            league_id: 'L1',
            season: '2026',
            status: 'in_season',
            draft_id: '1312541013801209856',
            settings: { type: 2, trade_deadline: 99 },
            metadata: { division_1: 'East' }
          }
        })

        expect(row.league_status).to.equal('in_season')
        expect(row.external_draft_id).to.equal('1312541013801209856')
        expect(JSON.parse(row.league_settings).trade_deadline).to.equal(99)
        expect(JSON.parse(row.league_metadata).division_1).to.equal('East')
      })

      it('leaves the optional fields null rather than inventing values', function () {
        const row = parse_sleeper_league({
          league: { league_id: 'L1', season: '2026', settings: { type: 2 } }
        })

        expect(row.league_status).to.equal(null)
        expect(row.external_draft_id).to.equal(null)
        expect(row.last_message_at).to.equal(null)
        // Absent objects still serialise, so a read site never has to branch
        // between null and '{}'.
        expect(row.league_settings).to.be.a('string')
        expect(row.league_metadata).to.equal('{}')
      })

      // Same "0" sentinel Sleeper uses to terminate a league chain. Storing it
      // would hand a later draft fetch a request guaranteed to 404.
      it('rejects a "0" sentinel draft id', function () {
        const row = parse_sleeper_league({
          league: {
            league_id: 'L1',
            season: '2026',
            settings: { type: 2 },
            draft_id: '0'
          }
        })

        expect(row.external_draft_id).to.equal(null)
      })
    })

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

  describe('derive_has_individual_defensive_players', function () {
    it('detects grouped IDP slots', function () {
      expect(
        derive_has_individual_defensive_players([
          'QB',
          'RB',
          'WR',
          'TE',
          'DL',
          'LB',
          'DB',
          'BN'
        ])
      ).to.equal(true)
    })

    it('detects specific defensive positions', function () {
      expect(
        derive_has_individual_defensive_players(['QB', 'RB', 'CB', 'BN'])
      ).to.equal(true)
      expect(
        derive_has_individual_defensive_players(['QB', 'IDP_FLEX'])
      ).to.equal(true)
    })

    // DST is a team defense, not an individual defender -- it resolves exactly
    // via the bare team abbreviation, so a DST league is NOT an IDP league and
    // must not be excluded as one.
    it('does not treat a team-defense slot as IDP', function () {
      expect(
        derive_has_individual_defensive_players([
          'QB',
          'RB',
          'WR',
          'TE',
          'FLEX',
          'SUPER_FLEX',
          'K',
          'DEF',
          'BN'
        ])
      ).to.equal(false)
    })

    it('handles a missing roster_positions array', function () {
      expect(derive_has_individual_defensive_players(null)).to.equal(false)
    })
  })

  describe('sleeper_transaction_buckets_to_fetch', function () {
    // Bucket 1 carries the entire offseason on top of week 1, so it is never
    // the one to economise on. Every assertion below starts from 1.
    it('fetches bucket 1 only for a current season that has not started', function () {
      expect(
        sleeper_transaction_buckets_to_fetch({
          league_season_year: 2026,
          current_season_year: 2026,
          current_season_week: 0
        })
      ).to.deep.equal([1])
    })

    it('fetches every bucket for a completed season', function () {
      const buckets = sleeper_transaction_buckets_to_fetch({
        league_season_year: 2025,
        current_season_year: 2026,
        current_season_week: 0
      })

      expect(buckets).to.have.lengthOf(18)
      expect(buckets[0]).to.equal(1)
      expect(buckets[17]).to.equal(18)
    })

    // One bucket of margin past the current week: our week boundary and
    // Sleeper's need not roll at the same instant, and a bucket we declined to
    // ask for is indistinguishable afterwards from one that held nothing.
    it('carries one bucket of margin past the current week', function () {
      expect(
        sleeper_transaction_buckets_to_fetch({
          league_season_year: 2026,
          current_season_year: 2026,
          current_season_week: 5
        })
      ).to.deep.equal([1, 2, 3, 4, 5, 6])
    })

    it('never exceeds bucket 18 once the postseason counter runs past it', function () {
      expect(
        sleeper_transaction_buckets_to_fetch({
          league_season_year: 2026,
          current_season_year: 2026,
          current_season_week: 22
        })
      ).to.have.lengthOf(18)
    })

    // A league-season ahead of the current one can only hold offseason trades.
    it('bounds a future league-season to bucket 1', function () {
      expect(
        sleeper_transaction_buckets_to_fetch({
          league_season_year: 2027,
          current_season_year: 2026,
          current_season_week: 0
        })
      ).to.deep.equal([1])
    })
  })

  describe('is_sleeper_identifier', function () {
    // The string "0" is Sleeper's absence sentinel and it is TRUTHY, which is
    // the trap this guard exists for -- a bare check sends the crawler off to
    // fetch entity 0 and creates a graph node that can never be expanded.
    it('rejects the string "0" absence sentinel', function () {
      expect(is_sleeper_identifier('0')).to.equal(false)
    })

    it('rejects null, undefined, and the empty string', function () {
      expect(is_sleeper_identifier(null)).to.equal(false)
      expect(is_sleeper_identifier(undefined)).to.equal(false)
      expect(is_sleeper_identifier('')).to.equal(false)
    })

    it('accepts a real id in either string or numeric form', function () {
      expect(is_sleeper_identifier('1182953443152855040')).to.equal(true)
      expect(is_sleeper_identifier(12503)).to.equal(true)
    })
  })

  describe('parse_sleeper_league_member_users', function () {
    const member_list = [
      { user_id: '331590801586524160', display_name: 'alpha' },
      { user_id: '469952154498334720', display_name: 'beta' }
    ]

    it('yields a user node and a membership edge per member', function () {
      const { users, memberships } = parse_sleeper_league_member_users({
        users: member_list,
        external_league_id: '1182953443152855040'
      })

      expect(users).to.deep.equal([
        {
          platform: 'sleeper',
          external_user_id: '331590801586524160',
          display_name: 'alpha',
          is_bot: false
        },
        {
          platform: 'sleeper',
          external_user_id: '469952154498334720',
          display_name: 'beta',
          is_bot: false
        }
      ])
      expect(memberships).to.deep.equal([
        {
          platform: 'sleeper',
          external_league_id: '1182953443152855040',
          external_user_id: '331590801586524160',
          is_owner: false
        },
        {
          platform: 'sleeper',
          external_league_id: '1182953443152855040',
          external_user_id: '469952154498334720',
          is_owner: false
        }
      ])
    })

    // display_name and is_bot ARE carried (reversed 2026-07-29 on operator
    // instruction: the graph is now the deliverable and has to be human-readable).
    // avatar and metadata are still dropped -- a content hash and notification
    // preferences inform nothing -- so the boundary is asserted rather than left
    // to drift the next time the payload grows a field.
    it('carries display_name and is_bot but not avatar or metadata', function () {
      const { users } = parse_sleeper_league_member_users({
        users: [
          {
            user_id: 'U1',
            display_name: 'alpha',
            avatar: 'abc',
            metadata: { team_name: 'Team Alpha' }
          }
        ],
        external_league_id: 'L1'
      })

      expect(Object.keys(users[0]).sort()).to.deep.equal([
        'display_name',
        'external_user_id',
        'is_bot',
        'platform'
      ])
    })

    // Sleeper omits is_bot/is_owner entirely on some payloads. They must land as
    // a known false, not null: null reads as "not learned yet", which is the
    // meaning reserved for a league whose member list has never been crawled.
    it('normalises absent is_bot and is_owner to false, not null', function () {
      const { users, memberships } = parse_sleeper_league_member_users({
        users: [{ user_id: 'U1', display_name: 'alpha' }],
        external_league_id: 'L1'
      })

      expect(users[0].is_bot).to.equal(false)
      expect(memberships[0].is_owner).to.equal(false)
    })

    it('carries is_bot and is_owner through when set', function () {
      const { users, memberships } = parse_sleeper_league_member_users({
        users: [
          { user_id: 'U1', display_name: 'alpha', is_bot: true, is_owner: true }
        ],
        external_league_id: 'L1'
      })

      expect(users[0].is_bot).to.equal(true)
      expect(memberships[0].is_owner).to.equal(true)
    })

    // A manager owning two teams appears twice, and the retained entry must be
    // the first -- otherwise which row wins depends on payload order.
    it('keeps the first payload entry when a member appears twice', function () {
      const { users } = parse_sleeper_league_member_users({
        users: [
          { user_id: 'U1', display_name: 'first', is_owner: true },
          { user_id: 'U1', display_name: 'second', is_owner: false }
        ],
        external_league_id: 'L1'
      })

      expect(users).to.have.lengthOf(1)
      expect(users[0].display_name).to.equal('first')
    })

    it('drops members whose user_id is absent or the "0" sentinel', function () {
      const { users, memberships } = parse_sleeper_league_member_users({
        users: [
          { user_id: 'U1' },
          { user_id: '0' },
          { user_id: null },
          { display_name: 'no id at all' }
        ],
        external_league_id: 'L1'
      })

      expect(users).to.have.lengthOf(1)
      expect(users[0].external_user_id).to.equal('U1')
      expect(memberships).to.have.lengthOf(1)
    })

    it('deduplicates a member appearing twice', function () {
      const { users, memberships } = parse_sleeper_league_member_users({
        users: [{ user_id: 'U1' }, { user_id: 'U1' }],
        external_league_id: 'L1'
      })

      expect(users).to.have.lengthOf(1)
      expect(memberships).to.have.lengthOf(1)
    })

    it('handles a 404 (null) member list', function () {
      const { users, memberships } = parse_sleeper_league_member_users({
        users: null,
        external_league_id: 'L1'
      })

      expect(users).to.have.lengthOf(0)
      expect(memberships).to.have.lengthOf(0)
    })
  })

  describe('parse_sleeper_user_leagues', function () {
    const redraft_league = {
      league_id: '9999999999999999999',
      name: 'Some Redraft',
      season: '2025',
      total_rosters: 10,
      settings: { type: 0 },
      roster_positions: ['QB', 'RB', 'WR', 'TE', 'BN'],
      scoring_settings: { rec: 0.5 }
    }

    it('derives a full league row from the user-leagues payload alone', function () {
      const { leagues } = parse_sleeper_user_leagues({
        leagues: [dynasty_superflex_league],
        external_user_id: 'U1'
      })

      expect(leagues).to.have.lengthOf(1)
      expect(leagues[0]).to.include({
        platform: 'sleeper',
        external_league_id: '1182953443152855040',
        season_year: 2025,
        league_format: 'dynasty',
        is_superflex: true,
        num_teams: 12,
        previous_external_league_id: '1048178518657568768'
      })
    })

    it('records the mechanism and the manager it was reached from', function () {
      const { leagues } = parse_sleeper_user_leagues({
        leagues: [dynasty_superflex_league],
        external_user_id: 'U1'
      })

      expect(leagues[0].discovered_via).to.equal('user_leagues')
      expect(leagues[0].discovered_from_external_user_id).to.equal('U1')
    })

    it('emits a membership edge per league', function () {
      const { memberships } = parse_sleeper_user_leagues({
        leagues: [dynasty_superflex_league, redraft_league],
        external_user_id: 'U1'
      })

      expect(memberships).to.deep.equal([
        {
          platform: 'sleeper',
          external_league_id: '1182953443152855040',
          external_user_id: 'U1'
        },
        {
          platform: 'sleeper',
          external_league_id: '9999999999999999999',
          external_user_id: 'U1'
        }
      ])
    })

    // Appetite filtering belongs at import, not at discovery: the row is free
    // here, and persisting it means the league is never rediscovered even if a
    // later run decides it does want redraft after all.
    it('persists leagues of every format, filtering nothing on appetite', function () {
      const { leagues } = parse_sleeper_user_leagues({
        leagues: [dynasty_superflex_league, redraft_league],
        external_user_id: 'U1'
      })

      expect(leagues.map((row) => row.league_format)).to.deep.equal([
        'dynasty',
        'redraft'
      ])
    })

    it('drops a league whose format is unusable rather than guessing', function () {
      const { leagues, memberships } = parse_sleeper_user_leagues({
        leagues: [{ league_id: 'L1', season: '2025', settings: { type: 77 } }],
        external_user_id: 'U1'
      })

      expect(leagues).to.have.lengthOf(0)
      expect(memberships).to.have.lengthOf(0)
    })

    it('deduplicates a league listed twice for one manager', function () {
      const { leagues, memberships } = parse_sleeper_user_leagues({
        leagues: [dynasty_superflex_league, dynasty_superflex_league],
        external_user_id: 'U1'
      })

      expect(leagues).to.have.lengthOf(1)
      expect(memberships).to.have.lengthOf(1)
    })

    it('handles a 404 (null) user-leagues payload', function () {
      const { leagues, memberships } = parse_sleeper_user_leagues({
        leagues: null,
        external_user_id: 'U1'
      })

      expect(leagues).to.have.lengthOf(0)
      expect(memberships).to.have.lengthOf(0)
    })
  })
})
