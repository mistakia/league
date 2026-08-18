/* global describe it */

import * as chai from 'chai'

import build_tag_board, {
  contract_key,
  post_deadline_salary,
  passes_consecutive_year_check,
  build_rfa_schedule,
  resolve_rookie_class_year,
  COVERAGE_PRECISE_MIN,
  RESTRICTED_FREE_AGENCY_NOMINATION_MINIMUM_MARKET_GAP,
  RESTRICTED_FREE_AGENCY_NOMINATION_REPLACEMENT_FLOOR_POINTS
} from '#libs-server/tag-board/build-tag-board.mjs'

chai.should()
const expect = chai.expect

// The live 2026 GENESIS LEAGUE settings the board reads from the seasons row.
const season = {
  lid: 1,
  year: 2026,
  league_format_id: 'genesis_10_team',
  franchise_tag_salary_quarterback: 39,
  franchise_tag_salary_running_back: 41,
  franchise_tag_salary_wide_receiver: 28,
  franchise_tag_salary_tight_end: 10,
  franchise_tag_limit: 1,
  rookie_tag_limit: 1,
  restricted_free_agency_tag_limit: 2,
  // These stand in for `seasons` timestamptz columns, so the fixture carries
  // Dates exactly as node-pg would hand them back.
  extension_deadline_at: new Date(1785470399 * 1000),
  restricted_free_agency_period_start: new Date(1785556800 * 1000),
  restricted_free_agency_period_end: new Date(1787371199 * 1000),
  draft_start: new Date(1787371200 * 1000)
}

// `season` carries Dates (the columns are timestamptz); the build_tag_board
// contract is still epoch seconds for `now_unix`.
const ext_date_unix = Math.round(season.extension_deadline_at.getTime() / 1000)

// 9 starters + 7 bench = an active roster limit of 16.
const league_format = {
  id: 'genesis_10_team',
  salary_cap: 200,
  format_category: 5,
  starter_slots_quarterback: 1,
  starter_slots_running_back: 2,
  starter_slots_wide_receiver: 2,
  starter_slots_tight_end: 1,
  starter_slots_running_back_wide_receiver_flex: 0,
  starter_slots_running_back_wide_receiver_tight_end_flex: 1,
  starter_slots_superflex: 1,
  starter_slots_wide_receiver_tight_end_flex: 0,
  starter_slots_defense_special_teams: 1,
  starter_slots_kicker: 0,
  bench_slot_count: 7
}

const now_unix = 1785000000

const make_player = ({
  tid,
  pid,
  pos = 'WR',
  slot = 11,
  tag = 1,
  extensions = 0,
  value = 10,
  dynasty_value = 5000,
  coverage = 0.89,
  nfl_draft_year = 2020,
  // Both projection inputs use `null` for "no projection row at all", which is
  // distinct from a real value of 0. Market salary defaults to absent so a
  // fixture opts into the shed pool.
  market_salary = null,
  // Above replacement and inside the nomination band, with room on both sides,
  // so a fixture that cares about either opts in explicitly. Do NOT set this to
  // a threshold value: a default sitting on a boundary makes every unrelated
  // test silently sensitive to that threshold moving.
  pts_added = 10
}) => ({
  row: { tid, pid, player_position: pos, slot, tag, extensions },
  contract: [contract_key(tid, pid), value],
  market_salary: market_salary === null ? null : [pid, market_salary],
  pts_added: pts_added === null ? null : [pid, pts_added],
  dynasty:
    dynasty_value === null
      ? null
      : [
          pid,
          {
            player_id: pid,
            composite_value: dynasty_value,
            composite_coverage_score: coverage
          }
        ],
  player: [pid, { name: pid, pos, nfl_draft_year }]
})

const build_fixture = ({
  players: player_specs,
  teams,
  franchise_tag_history = [],
  viewer_tid = null,
  viewer_cutlist = null,
  viewer_rfa_bids = null,
  // Default is the unprocessed state, in which the board projects the ladder; a
  // fixture opts into processed state explicitly. This is deliberately NOT
  // derived from `now_unix` — the clock and the transactions move at different
  // moments, and the window between them is the bug this predicate exists for.
  extensions_processed = false,
  now_unix: fixture_now_unix = now_unix
}) => {
  const specs = player_specs.map(make_player)
  return {
    lid: 1,
    year: 2026,
    now_unix: fixture_now_unix,
    extensions_processed,
    season,
    league_format,
    teams,
    roster_rows: specs.map((spec) => spec.row),
    contracts: new Map(specs.map((spec) => spec.contract)),
    franchise_tag_history,
    dynasty_values: new Map(
      specs.filter((spec) => spec.dynasty).map((spec) => spec.dynasty)
    ),
    players: new Map(specs.map((spec) => spec.player)),
    projected_market_salary: new Map(
      specs
        .filter((spec) => spec.market_salary)
        .map((spec) => spec.market_salary)
    ),
    projected_points_added: new Map(
      specs.filter((spec) => spec.pts_added).map((spec) => spec.pts_added)
    ),
    rookie_class_year: 2025,
    viewer_tid,
    viewer_cutlist,
    viewer_rfa_bids
  }
}

const two_teams = [
  { team_id: 1, name: 'Alpha', draft_order: 2 },
  { team_id: 2, name: 'Beta', draft_order: 1 }
]

const team_board = (board, tid) =>
  board.tag_board.find((row) => row.tid === tid)
const team_exposure = (board, tid) =>
  board.cap_exposure.find((row) => row.tid === tid)
const team_tag_budget = (board, tid) =>
  board.tag_budget.find((row) => row.tid === tid)
const rules_fired = (board, tid) =>
  board.considerations[tid].map((row) => row.rule)

describe('tag board', function () {
  describe('post-deadline salary', function () {
    it('extends a regular contract up the ladder', function () {
      post_deadline_salary({
        tag: 1,
        pos: 'WR',
        extensions: 2,
        player_salary: 30,
        season,
        extensions_processed: false
      }).should.equal(45)
    })

    it('replaces a franchise-tagged value with the stored position price', function () {
      // Not 61 + 5: the tag REPLACES the value rather than freezing it.
      post_deadline_salary({
        tag: 2,
        pos: 'RB',
        extensions: 0,
        player_salary: 61,
        season,
        extensions_processed: false
      }).should.equal(41)
    })

    it('leaves a rookie-tagged contract at its recorded value', function () {
      // Constitution Article VIII §3 prices the EXTENSION at $0 — the contract
      // is not extended by $5, it does not become a $0 salary. Not 15, not 0.
      post_deadline_salary({
        tag: 3,
        pos: 'RB',
        extensions: 0,
        player_salary: 10,
        season,
        extensions_processed: false
      }).should.equal(10)
    })

    it('extends a restricted free agency contract up the regular ladder', function () {
      // Not 21. `process-extensions.mjs` coerces the tag to REGULAR before
      // pricing, so a tag-4 player is charged the ordinary ladder at the
      // deadline; projecting the stored value instead reports a number the
      // writer of record never writes. Confirmed against league 1, where all 14
      // tag-4 players carry a 2026 EXTENSION transaction at the ladder price.
      post_deadline_salary({
        tag: 4,
        pos: 'WR',
        extensions: 1,
        player_salary: 21,
        season,
        extensions_processed: false
      }).should.equal(31)
    })

    it('prices a restricted free agent identically to a regular contract', function () {
      // The disclosure property, pinned as a test because a tag-4 arm that
      // returns anything else leaks the tag: the tag is private until the
      // nomination is announced, and any per-tag difference in a PUBLIC salary
      // figure recovers it by comparison against the stored value.
      const args = {
        pos: 'WR',
        extensions: 1,
        player_salary: 21,
        season,
        extensions_processed: false
      }
      post_deadline_salary({ ...args, tag: 4 }).should.equal(
        post_deadline_salary({ ...args, tag: 1 })
      )
    })

    // The ladder is a PROJECTION of an extension that has not happened yet.
    // Once process-extensions.mjs has written the extended value as a new
    // transaction and incremented `extensions`, the stored value is already the
    // post-deadline salary and applying the ladder again would double-extend
    // every regular contract off a taller base.
    it('applies the ladder while the extensions are unprocessed', function () {
      post_deadline_salary({
        tag: 1,
        pos: 'WR',
        extensions: 2,
        player_salary: 15,
        season,
        extensions_processed: false
      }).should.equal(30)
    })

    it('returns the stored value once the extensions are processed', function () {
      // Not 15 + (3+1)*5 = 35, and not the 30 + (3+1)*5 = 50 the processed row
      // would produce: the transaction carries $30 with `extensions` already
      // incremented, and $30 is the answer.
      post_deadline_salary({
        tag: 1,
        pos: 'WR',
        extensions: 3,
        player_salary: 30,
        season,
        extensions_processed: true
      }).should.equal(30)
    })

    it('leaves a processed franchise contract at its stored price', function () {
      // The FRANCHISE_TAG transaction already carries the position price, so
      // re-deriving it is a no-op here — but a franchise price that had since
      // moved would otherwise silently overwrite the signed one.
      post_deadline_salary({
        tag: 2,
        pos: 'RB',
        extensions: 0,
        player_salary: 41,
        season,
        extensions_processed: true
      }).should.equal(41)
    })
  })

  describe('cap exposure', function () {
    it('sums the four tag cases across the active roster', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            // 20 + (0+1)*5 = 25
            { tid: 1, pid: 'REG', pos: 'WR', tag: 1, extensions: 0, value: 20 },
            // franchise RB -> 41, replacing 61
            { tid: 1, pid: 'FRA', pos: 'RB', tag: 2, value: 61 },
            // rookie -> unchanged 10 (the extension is free, the salary stays)
            { tid: 1, pid: 'ROO', pos: 'RB', tag: 3, value: 10 },
            // restricted free agency -> 21 + (0+1)*5 = 26, the regular ladder
            { tid: 1, pid: 'RFA', pos: 'WR', tag: 4, value: 21 },
            { tid: 2, pid: 'B1', pos: 'WR', tag: 1, extensions: 0, value: 10 }
          ]
        })
      )

      const exposure = team_exposure(board, 1)
      exposure.current_salary.should.equal(112)
      // 25 (regular) + 41 (franchise price) + 10 (rookie, unchanged) + 26 (RFA,
      // priced as regular the way process-extensions.mjs charges it)
      exposure.post_extension_salary.should.equal(102)
      exposure.current_room.should.equal(88)
      exposure.post_extension_room.should.equal(98)
    })

    it('reports an overage as negative post-extension room', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            { tid: 1, pid: 'A1', value: 150, extensions: 3 },
            { tid: 1, pid: 'A2', value: 60, extensions: 0 },
            { tid: 2, pid: 'B1', value: 10 }
          ]
        })
      )

      // (150 + 20) + (60 + 5) = 235 against a 200 cap.
      team_exposure(board, 1).post_extension_room.should.equal(-35)
      board.league_market.post_extension_room.teams_over_cap.should.equal(1)
    })

    // The N.Collins case from the live 2026 board: $15 raw with two extensions
    // reads $30 while unprocessed. Once processed, the transaction carries $30
    // and `extensions` is 3, and an ungated ladder would render $50.
    it('carries the ladder into cap exposure while unprocessed', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            { tid: 1, pid: 'COL', value: 15, extensions: 2, market_salary: 12 },
            { tid: 2, pid: 'B1', value: 10 }
          ],
          extensions_processed: false
        })
      )

      team_exposure(board, 1).post_extension_salary.should.equal(30)
      const row = board.market_pool.find((entry) => entry.pid === 'COL')
      row.post_deadline_salary.should.equal(30)
      row.market_gap.should.equal(18)
    })

    it('does not re-apply the ladder to a processed contract', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            { tid: 1, pid: 'COL', value: 30, extensions: 3, market_salary: 12 },
            { tid: 2, pid: 'B1', value: 10 }
          ],
          extensions_processed: true,
          now_unix: ext_date_unix
        })
      )

      // 30, not 30 + (3 + 1) * 5 = 50.
      team_exposure(board, 1).post_extension_salary.should.equal(30)
      const row = board.market_pool.find((entry) => entry.pid === 'COL')
      row.post_deadline_salary.should.equal(30)
      row.market_gap.should.equal(18)
    })

    // The regression this predicate exists for: the deadline has passed on the
    // clock and the cron has not yet run, so no EXTENSION transaction exists and
    // the stored values are still pre-extension. A clock-keyed branch returns
    // them as-is and understates the whole board. Both the ladder and the
    // franchise price must still be projected here.
    it('projects the ladder past extension_deadline_at while nothing is processed', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            { tid: 1, pid: 'COL', value: 15, extensions: 2, market_salary: 12 },
            { tid: 1, pid: 'FRA', pos: 'RB', tag: 2, value: 61 },
            { tid: 2, pid: 'B1', value: 10 }
          ],
          extensions_processed: false,
          now_unix: ext_date_unix + 1
        })
      )

      // 30 (projected ladder, not the stored 15) + 41 (franchise price, not the
      // stored pre-tag 61).
      team_exposure(board, 1).post_extension_salary.should.equal(71)
      const row = board.market_pool.find((entry) => entry.pid === 'COL')
      row.post_deadline_salary.should.equal(30)
      row.market_gap.should.equal(18)
    })

    it('counts only active-roster slots', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            { tid: 1, pid: 'ACT', slot: 11, value: 20 },
            { tid: 1, pid: 'PSQ', slot: 12, value: 40 },
            { tid: 1, pid: 'IRE', slot: 13, value: 40 },
            { tid: 2, pid: 'B1', value: 10 }
          ]
        })
      )

      const exposure = team_exposure(board, 1)
      exposure.active_roster_count.should.equal(1)
      exposure.post_extension_salary.should.equal(25)
    })
  })

  describe('tag budget', function () {
    it('nets the limits against tags already consumed', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            { tid: 1, pid: 'FRA', tag: 2, pos: 'RB', value: 50 },
            { tid: 1, pid: 'ROO', tag: 3, value: 10 },
            { tid: 1, pid: 'RF1', tag: 4, value: 21 },
            { tid: 1, pid: 'RF2', tag: 4, value: 1 },
            { tid: 2, pid: 'B1', value: 10 }
          ]
        })
      )

      const spent = team_tag_budget(board, 1)
      spent.franchise.remaining.should.equal(0)
      spent.rookie.remaining.should.equal(0)
      spent.restricted_free_agency.remaining.should.equal(0)

      const unspent = team_tag_budget(board, 2)
      unspent.franchise.remaining.should.equal(1)
      unspent.rookie.remaining.should.equal(1)
      unspent.restricted_free_agency.remaining.should.equal(2)

      board.league_market.teams_with_unspent_tag.franchise.should.equal(1)
      board.league_market.unspent_tag_count.franchise.should.equal(1)

      // the discriminating case: one team holds two unspent nominations, so
      // the team count and the tag count must not agree. rendering the team
      // count as a tag count halves the stated supply.
      board.league_market.teams_with_unspent_tag.restricted_free_agency.should.equal(
        1
      )
      board.league_market.unspent_tag_count.restricted_free_agency.should.equal(
        2
      )
    })

    it('counts tags on practice squad and reserve rows against the limit', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            { tid: 1, pid: 'A1', value: 10 },
            { tid: 1, pid: 'PSF', slot: 12, tag: 2, pos: 'RB', value: 50 },
            { tid: 2, pid: 'B1', value: 10 }
          ]
        })
      )

      team_tag_budget(board, 1).franchise.remaining.should.equal(0)
    })

    it('withholds candidate eligibility once the tag is spent', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            // extension price 60 > the $41 RB franchise price, so the price
            // screen passes; the tag is gone regardless.
            { tid: 1, pid: 'BIG', pos: 'RB', value: 55, extensions: 0 },
            { tid: 1, pid: 'FRA', pos: 'RB', tag: 2, value: 50 },
            { tid: 2, pid: 'B1', value: 10 }
          ]
        })
      )

      const candidate = team_board(board, 1).players.find(
        (row) => row.pid === 'BIG'
      )
      candidate.franchise_saving.should.equal(19)
      candidate.eligibility.franchise.should.equal(false)
    })
  })

  describe('franchise screen', function () {
    it('excludes a player tagged by this team in each of the two prior years', function () {
      const franchise_tag_history = [
        { tid: 1, pid: 'CMC', season_year: 2025 },
        { tid: 1, pid: 'CMC', season_year: 2024 }
      ]
      passes_consecutive_year_check({
        tid: 1,
        pid: 'CMC',
        year: 2026,
        franchise_tag_history
      }).should.equal(false)

      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          franchise_tag_history,
          players: [
            { tid: 1, pid: 'CMC', pos: 'RB', value: 39, extensions: 1 },
            { tid: 2, pid: 'B1', value: 10 }
          ]
        })
      )

      const row = team_board(board, 1).players.find((p) => p.pid === 'CMC')
      // 39 + (1+1)*5 = 49 against a $41 RB price: the price screen passes.
      row.franchise_saving.should.equal(8)
      row.eligibility.franchise_consecutive_year_ok.should.equal(false)
      row.eligibility.franchise.should.equal(false)
      board.league_market.teams_with_franchise_candidate.should.not.include(1)
    })

    it('permits a player tagged by this team in only one of the two prior years', function () {
      passes_consecutive_year_check({
        tid: 1,
        pid: 'CMC',
        year: 2026,
        franchise_tag_history: [{ tid: 1, pid: 'CMC', season_year: 2025 }]
      }).should.equal(true)
    })

    it('scopes the limit to the tagging team, matching validate-franchise-tag', function () {
      // Tagged twice, but by two different teams. The code permits the 2026 tag
      // by team 1; the constitution's text does not.
      passes_consecutive_year_check({
        tid: 1,
        pid: 'SAQ',
        year: 2026,
        franchise_tag_history: [
          { tid: 2, pid: 'SAQ', season_year: 2025 },
          { tid: 1, pid: 'SAQ', season_year: 2024 }
        ]
      }).should.equal(true)
    })

    it('screens on the price inequality, not on player quality', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            // Best player on the board, but $16 extension against a $28 WR
            // price: the tag would RAISE his salary.
            {
              tid: 1,
              pid: 'CHEAP',
              pos: 'WR',
              value: 11,
              extensions: 0,
              dynasty_value: 9999
            },
            { tid: 2, pid: 'B1', value: 10 }
          ]
        })
      )

      const row = team_board(board, 1).players.find((p) => p.pid === 'CHEAP')
      row.dynasty_rank.should.equal(1)
      row.franchise_saving.should.equal(-12)
      row.eligibility.franchise.should.equal(false)
    })

    it('fires the empty-screen consideration with the count of rivals holding one', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            { tid: 1, pid: 'A1', pos: 'WR', value: 5 },
            { tid: 2, pid: 'B1', pos: 'WR', value: 40, extensions: 0 }
          ]
        })
      )

      team_board(board, 2).players[0].eligibility.franchise.should.equal(true)
      rules_fired(board, 1).should.include('empty_screen')

      const fired = board.considerations[1].filter(
        (row) => row.rule === 'empty_screen' && row.inputs.tag === 'franchise'
      )
      fired.should.have.length(1)
      fired[0].inputs.rivals.should.eql([2])
    })

    it('omits a rival whose franchise tag is already spent from the candidate lists', function () {
      // Team 2 holds a player who clears the price screen, but has already
      // spent its one franchise tag on someone else. It cannot act on the
      // candidate, so it is not a rival for team 1's empty-screen count.
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            { tid: 1, pid: 'A1', pos: 'WR', value: 5 },
            { tid: 2, pid: 'B_TAGGED', pos: 'RB', tag: 2, value: 50 },
            { tid: 2, pid: 'B_CLEARS', pos: 'WR', value: 40, extensions: 0 }
          ]
        })
      )

      // The mechanical screen still passes on the row itself...
      const row = team_board(board, 2).players.find((p) => p.pid === 'B_CLEARS')
      row.franchise_saving.should.be.above(0)
      // ...but the budget is exhausted, so eligibility and every rival-facing
      // aggregate agree that there is no candidate.
      row.eligibility.franchise.should.equal(false)
      board.tag_budget
        .find((r) => r.tid === 2)
        .franchise.remaining.should.equal(0)
      board.league_market.teams_with_franchise_candidate.should.not.include(2)
      expect(board.league_market.candidate_concentration.WR).to.equal(undefined)

      const fired = board.considerations[1].filter(
        (row) => row.rule === 'empty_screen' && row.inputs.tag === 'franchise'
      )
      fired.should.have.length(1)
      fired[0].inputs.rivals.should.eql([])
      fired[0].inputs.rival_count.should.equal(0)
      fired[0].sentence.should.contain('0 of the other 1 teams')
    })

    it('omits a rival whose rookie tag is already spent from the rookie candidate list', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            { tid: 1, pid: 'A1', pos: 'WR', value: 5, nfl_draft_year: 2020 },
            { tid: 2, pid: 'B_TAGGED', tag: 3, value: 6, nfl_draft_year: 2025 },
            { tid: 2, pid: 'B_CLASS', value: 6, nfl_draft_year: 2025 }
          ]
        })
      )

      team_board(board, 2)
        .players.find((p) => p.pid === 'B_CLASS')
        .eligibility.rookie.should.equal(false)
      board.league_market.teams_with_rookie_candidate.should.not.include(2)

      const fired = board.considerations[1].filter(
        (row) => row.rule === 'empty_screen' && row.inputs.tag === 'rookie'
      )
      fired.should.have.length(1)
      fired[0].inputs.rivals.should.eql([])
    })
  })

  describe('rookie screen', function () {
    it('resolves eligibility to the most recent completed draft class', function () {
      const season_rows = [
        {
          season_year: 2024,
          rookie_draft_completed_at: null,
          draft_start: new Date(1721707200 * 1000)
        },
        {
          season_year: 2025,
          rookie_draft_completed_at: new Date(1755187200 * 1000),
          draft_start: new Date(1752552000 * 1000)
        },
        // 2026's draft has not run yet.
        {
          season_year: 2026,
          rookie_draft_completed_at: null,
          draft_start: new Date(1787371200 * 1000)
        }
      ]
      resolve_rookie_class_year({ season_rows, now_unix }).should.equal(2025)
    })

    it('falls back to draft_start when no completion timestamp is recorded', function () {
      const season_rows = [
        {
          season_year: 2023,
          rookie_draft_completed_at: null,
          draft_start: new Date(1687147200 * 1000)
        },
        {
          season_year: 2024,
          rookie_draft_completed_at: null,
          draft_start: new Date(1721707200 * 1000)
        }
      ]
      resolve_rookie_class_year({ season_rows, now_unix }).should.equal(2024)
    })

    it('flags the completed class and not the current draft year', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            { tid: 1, pid: 'R25', value: 8, nfl_draft_year: 2025 },
            { tid: 1, pid: 'R26', value: 3, nfl_draft_year: 2026 },
            { tid: 2, pid: 'B1', value: 10 }
          ]
        })
      )

      const rows = team_board(board, 1).players
      rows.find((p) => p.pid === 'R25').eligibility.rookie.should.equal(true)
      rows.find((p) => p.pid === 'R26').eligibility.rookie.should.equal(false)
      // The tag buys the extension for $0, so it saves the $5 extension cost,
      // not the $8 value that stays on the cap line either way.
      rows.find((p) => p.pid === 'R25').rookie_saving.should.equal(5)
    })
  })

  describe('ordinal valuation', function () {
    it('emits no dollar-denominated player value anywhere in the board', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            { tid: 1, pid: 'A1', value: 20 },
            { tid: 2, pid: 'B1', value: 10 }
          ]
        })
      )

      const row = team_board(board, 1).players[0]
      expect(row.dynasty_value).to.equal(undefined)
      expect(row.market_salary).to.equal(undefined)
      expect(row.surplus).to.equal(undefined)
      row.dynasty_rank.should.be.a('number')
    })

    it('bands the rank when the composite rests on a single source', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            { tid: 1, pid: 'SOLO', value: 20, coverage: 0.47 },
            { tid: 1, pid: 'FULL', value: 20, coverage: 0.89 },
            { tid: 2, pid: 'B1', value: 10 }
          ]
        })
      )

      const rows = team_board(board, 1).players
      COVERAGE_PRECISE_MIN.should.equal(0.6)
      rows.find((p) => p.pid === 'SOLO').rank_precision.should.equal('band')
      rows.find((p) => p.pid === 'FULL').rank_precision.should.equal('precise')
      // Annotating, not suppressing: the low-coverage player keeps his rank.
      rows.find((p) => p.pid === 'SOLO').dynasty_rank.should.be.a('number')
      rows.find((p) => p.pid === 'SOLO').dynasty_band.should.be.a('string')
    })

    it('marks a contract with no market row rather than ranking it last', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            { tid: 1, pid: 'RETIRED', value: 20, dynasty_value: null },
            { tid: 1, pid: 'A2', value: 20 },
            { tid: 2, pid: 'B1', value: 10 }
          ]
        })
      )

      const row = team_board(board, 1).players.find((p) => p.pid === 'RETIRED')
      row.no_market_value.should.equal(true)
      expect(row.dynasty_rank).to.equal(null)
    })
  })

  describe('market gap', function () {
    it('measures the post-deadline salary against the single-season price', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            { tid: 1, pid: 'OVER', value: 90, market_salary: 20 },
            { tid: 1, pid: 'FAIR', value: 5, market_salary: 30 },
            { tid: 2, pid: 'B1', value: 20, market_salary: 10 }
          ]
        })
      )

      // 90 + (0 + 1) * 5 = 95 against a $20 price.
      const over = board.market_pool.find((row) => row.pid === 'OVER')
      over.market_gap.should.equal(75)
      over.under_pressure.should.equal(true)

      // 5 + 5 = 10 against a $30 price — paid below the market, not shed.
      const fair = board.market_pool.find((row) => row.pid === 'FAIR')
      fair.market_gap.should.equal(-20)
      fair.under_pressure.should.equal(false)

      board.market_pool[0].pid.should.equal('OVER')
    })

    // The replacement floor came off `under_pressure` on 2026-07-30: a
    // one-season price cannot separate a rising rookie from a finished veteran,
    // so gating on it dropped the ascending players the band exists to surface.
    // `pts_added` stays on the row as the continuous signal that separates them.
    it('keeps a below-replacement contract under pressure and annotates it', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            // Finished veteran.
            { tid: 1, pid: 'CUT', value: 20, market_salary: 0, pts_added: -80 },
            // Ascending rookie: the same $0 price, a very different contract.
            {
              tid: 1,
              pid: 'RISING',
              value: 20,
              market_salary: 0,
              pts_added: -7,
              dynasty_value: 9000
            },
            { tid: 1, pid: 'PRESSURE', value: 40, market_salary: 15 },
            { tid: 2, pid: 'B1', value: 20, market_salary: 10 }
          ]
        })
      )

      const cut = board.market_pool.find((row) => row.pid === 'CUT')
      cut.market_gap.should.equal(25)
      cut.below_replacement.should.equal(true)
      cut.under_pressure.should.equal(true)
      cut.projected_points_added.should.equal(-80)

      const rising = board.market_pool.find((row) => row.pid === 'RISING')
      rising.under_pressure.should.equal(true)
      rising.projected_points_added.should.equal(-7)
      // The one signal that orders them: the price clips at $0 for both.
      rising.projected_market_salary.should.equal(cut.projected_market_salary)

      board.market_pool
        .find((row) => row.pid === 'PRESSURE')
        .under_pressure.should.equal(true)

      // Capacity is unchanged by the screen revision — it has always been the
      // shed pool, and the shed pool is what `under_pressure` now names.
      const capacity = board.bid_capacity.find((row) => row.tid === 1)
      capacity.attachable_contract_count.should.equal(3)
      capacity.attachable_release_salary.should.equal(25 + 25 + 45)
    })

    it('ranks a row against the shed pool, not the league', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            // Highest dynasty value on the board, but paid below the market, so
            // it is not in the shed pool and carries no pool rank.
            {
              tid: 1,
              pid: 'KEPT',
              value: 5,
              market_salary: 60,
              dynasty_value: 9500
            },
            {
              tid: 1,
              pid: 'BEST',
              value: 40,
              market_salary: 5,
              dynasty_value: 9000
            },
            {
              tid: 1,
              pid: 'MID',
              value: 40,
              market_salary: 5,
              dynasty_value: 6000
            },
            {
              tid: 2,
              pid: 'WORST',
              value: 40,
              market_salary: 5,
              dynasty_value: 1000
            },
            // No dynasty row: ranked nowhere, annotated, never dropped.
            {
              tid: 2,
              pid: 'NOVALUE',
              value: 40,
              market_salary: 5,
              dynasty_value: null
            }
          ]
        })
      )

      const pool_row = (pid) => board.market_pool.find((row) => row.pid === pid)

      pool_row('BEST').pool_rank.should.equal(1)
      pool_row('MID').pool_rank.should.equal(2)
      pool_row('WORST').pool_rank.should.equal(3)
      // Four shed-pool rows, three of them carrying a dynasty value.
      pool_row('BEST').pool_size.should.equal(3)

      expect(pool_row('NOVALUE').pool_rank).to.equal(null)
      pool_row('NOVALUE').no_market_value.should.equal(true)
      pool_row('NOVALUE').under_pressure.should.equal(true)

      // Outside the shed pool entirely, despite leading the league on dynasty
      // value — the pool answers "what could become available".
      pool_row('KEPT').under_pressure.should.equal(false)
      expect(pool_row('KEPT').pool_rank).to.equal(null)
      pool_row('KEPT').dynasty_rank.should.equal(1)
    })

    it('requires the owner to be paying real money above the market', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            // The live R.Dowdle case: a $5 contract with a $3 gap. A ratio bar
            // would keep it at 0.60; no owner nominates a minimum contract.
            { tid: 1, pid: 'CHEAP', value: 1, market_salary: 3 },
            // One dollar short of the minimum, and exactly at it.
            { tid: 1, pid: 'UNDER', value: 20, market_salary: 20 },
            { tid: 1, pid: 'AT', value: 20, market_salary: 19 },
            { tid: 2, pid: 'B1', value: 20, market_salary: 10 }
          ]
        })
      )

      const pool_row = (pid) => board.market_pool.find((row) => row.pid === pid)

      pool_row('CHEAP').market_gap.should.equal(3)
      pool_row('CHEAP').under_pressure.should.equal(true)
      pool_row('CHEAP').rfa_nomination_target.should.equal(false)

      pool_row('UNDER').market_gap.should.equal(5)
      pool_row('UNDER').rfa_nomination_target.should.equal(false)

      pool_row('AT').market_gap.should.equal(
        RESTRICTED_FREE_AGENCY_NOMINATION_MINIMUM_MARKET_GAP
      )
      pool_row('AT').rfa_nomination_target.should.equal(true)
    })

    // The gap says the contract is mispriced; it does not say the player is
    // worth the nomination. The floor cuts the lower tail only — above
    // replacement there is no ceiling, because a nomination re-prices the
    // owner's own contract whatever the player's quality.
    it('requires the player to be near replacement level or better', function () {
      const floor = RESTRICTED_FREE_AGENCY_NOMINATION_REPLACEMENT_FLOOR_POINTS
      const band = -floor
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            // A star paid above the single-season market. He is a candidate:
            // the owner is overpaying, and the auction is what re-prices him.
            {
              tid: 1,
              pid: 'STAR',
              value: 50,
              market_salary: 20,
              pts_added: 125
            },
            // The K.Pickett case: no bidder at any price, so the owner releases
            // rather than nominates.
            {
              tid: 1,
              pid: 'DEAD',
              value: 20,
              market_salary: 5,
              pts_added: -218
            },
            // Just inside the floor on each side of replacement.
            {
              tid: 1,
              pid: 'FRINGE_UP',
              value: 20,
              market_salary: 5,
              pts_added: band
            },
            {
              tid: 1,
              pid: 'FRINGE_DOWN',
              value: 20,
              market_salary: 5,
              pts_added: -band
            },
            // One point outside the old two-sided band, on each side. Above
            // replacement there is no bound, so this one is still a candidate.
            {
              tid: 1,
              pid: 'JUST_OVER',
              value: 20,
              market_salary: 5,
              pts_added: band + 1
            },
            {
              tid: 1,
              pid: 'JUST_UNDER',
              value: 20,
              market_salary: 5,
              pts_added: -band - 1
            },
            // No projection at all: unscreenable on this condition rather than
            // failing it, so it stays in the table unmarked.
            {
              tid: 1,
              pid: 'NOPTS',
              value: 20,
              market_salary: 5,
              pts_added: null
            },
            { tid: 2, pid: 'B1', value: 20, market_salary: 10 }
          ]
        })
      )

      const target = (pid) =>
        board.market_pool.find((row) => row.pid === pid).rfa_nomination_target

      // Every one of these clears the gap minimum, so the gap is not what
      // separates them.
      board.market_pool
        .filter((row) => row.tid === 1)
        .every(
          (row) =>
            row.market_gap >=
            RESTRICTED_FREE_AGENCY_NOMINATION_MINIMUM_MARKET_GAP
        )
        .should.equal(true)

      target('STAR').should.equal(true)
      target('DEAD').should.equal(false)
      target('FRINGE_UP').should.equal(true)
      target('FRINGE_DOWN').should.equal(true)
      target('JUST_OVER').should.equal(true)
      target('JUST_UNDER').should.equal(false)
      target('NOPTS').should.equal(false)

      // Unmarked is not dropped: all seven stay in the pool and in the band.
      const supply = Object.values(board.market_bands.incoming_supply).flat()
      for (const pid of [
        'STAR',
        'DEAD',
        'FRINGE_UP',
        'FRINGE_DOWN',
        'JUST_OVER',
        'JUST_UNDER',
        'NOPTS'
      ]) {
        supply.should.include(pid)
      }
    })

    it('keeps a contract with no projection, marked unscreenable and sorted last', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            { tid: 1, pid: 'NOPROJ', value: 30, market_salary: null },
            { tid: 1, pid: 'OVER', value: 40, market_salary: 5 },
            { tid: 2, pid: 'B1', value: 20, market_salary: 10 }
          ]
        })
      )

      const row = board.market_pool.find((r) => r.pid === 'NOPROJ')
      expect(row.market_gap).to.equal(null)
      row.under_pressure.should.equal(false)
      board.market_pool.map((r) => r.pid).should.include('NOPROJ')
      board.market_pool[board.market_pool.length - 1].pid.should.equal('NOPROJ')
    })

    // The flag states that a contract FITS the nomination profile, not that its
    // owner may still designate one. The tag is applied before the extension
    // deadline, so a budget gate would empty the flag league-wide for the whole
    // nomination period — which is exactly when a manager reviews the screen.
    it('marks the profile whatever the owner tag budget says', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            { tid: 1, pid: 'TARGET', value: 40, market_salary: 5 },
            { tid: 2, pid: 'B1', value: 40, market_salary: 5 },
            { tid: 2, pid: 'B2', tag: 4, value: 20, market_salary: 10 },
            { tid: 2, pid: 'B3', tag: 4, value: 20, market_salary: 10 }
          ]
        })
      )

      const beta = board.tag_budget.find((row) => row.tid === 2)
      beta.restricted_free_agency.remaining.should.equal(0)

      board.market_pool
        .find((row) => row.pid === 'TARGET')
        .rfa_nomination_target.should.equal(true)
      board.market_pool
        .find((row) => row.pid === 'B1')
        .rfa_nomination_target.should.equal(true)
    })

    it('hands the viewer their own nomination candidates as a band', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          viewer_tid: 1,
          players: [
            { tid: 1, pid: 'WIDE', value: 40, market_salary: 5 },
            { tid: 1, pid: 'NARROW', value: 20, market_salary: 16 },
            // Below the replacement floor: in the pool, out of the candidates.
            {
              tid: 1,
              pid: 'DEAD',
              value: 40,
              market_salary: 5,
              pts_added: -200
            },
            { tid: 2, pid: 'RIVAL', value: 30, market_salary: 5 }
          ]
        })
      )

      board.market_bands.rfa_nomination_candidates.should.eql([
        'WIDE',
        'NARROW'
      ])
      board.market_bands.rfa_nomination_pool.should.include('RIVAL')
    })

    it('reports no nomination candidates band without a viewer', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [{ tid: 1, pid: 'A1', value: 40, market_salary: 5 }]
        })
      )

      expect(board.market_bands.rfa_nomination_candidates).to.equal(null)
    })

    // The auction supply. These rows joined market_pool on 2026-07-31; before
    // that they sat in a separate top-level key with their own rank scale, which
    // forced the page to render two tables answering one question in two units.
    it('carries the tagged players in the pool with their salary and gap', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            {
              tid: 1,
              pid: 'RFA_CHEAP',
              tag: 4,
              value: 20,
              market_salary: 8
            },
            {
              tid: 2,
              pid: 'RFA_RICH',
              tag: 4,
              value: 20,
              market_salary: 30
            },
            { tid: 1, pid: 'PLAIN', value: 40, market_salary: 5 },
            { tid: 2, pid: 'FRANCHISED', tag: 2, value: 40, market_salary: 5 }
          ]
        })
      )

      const pool_row = (pid) => board.market_pool.find((row) => row.pid === pid)

      // Most expensive season first, and only the restricted-free-agency tag.
      // A franchise-tagged contract is settled and unavailable, so it stays out
      // of the pool entirely.
      board.market_bands.restricted_free_agency_pool.should.eql([
        'RFA_RICH',
        'RFA_CHEAP'
      ])
      expect(pool_row('FRANCHISED')).to.equal(undefined)

      const row = pool_row('RFA_RICH')
      row.tag_state.should.equal('restricted_free_agency')
      row.team_name.should.equal('Beta')
      row.projected_market_salary.should.equal(30)

      // The salary and gap he actually carries. Both are public state: the
      // contract the owner holds today extended up the regular ladder, the way
      // process-extensions.mjs charges a tag-4 player at the deadline,
      // differenced against a published single-season projection. Neither is the
      // settling offer, which is blind under Article IX §2 and never enters the
      // artifact at all.
      row.post_deadline_salary.should.equal(25)
      row.market_gap.should.equal(-5)
      expect(row.player_salary).to.equal(undefined)

      // Still in neither shed pool: those describe a contract an owner might
      // shed for cap relief, and the auction is already re-settling this one.
      row.under_pressure.should.equal(false)
      row.releasable.should.equal(false)

      // Priced BELOW the market, so he does not fit the nomination profile —
      // excluded on the gap, which is now evaluable, rather than structurally.
      row.rfa_nomination_target.should.equal(false)

      // A tagged row CAN fit the profile, and does when its gap clears the
      // minimum. This is the change: the players most obviously in the
      // restricted-free-agency pool used to be the only ones it could never
      // describe, because their gap was nulled away.
      pool_row('RFA_CHEAP').market_gap.should.equal(17)
      pool_row('RFA_CHEAP').rfa_nomination_target.should.equal(true)

      // ...and so contributes nothing to its owner's capacity.
      board.bid_capacity
        .find((cap) => cap.tid === 2)
        .attachable_release_salary.should.equal(0)

      pool_row('PLAIN').tag_state.should.equal('untagged')

      board.league_market.restricted_free_agency_auction.total.should.equal(2)
      board.league_market.restricted_free_agency_auction.by_tid.should.eql([
        { tid: 1, count: 1 },
        { tid: 2, count: 1 }
      ])

      // The former top-level key is gone rather than kept alongside the band:
      // two copies of the same rows is exactly the drift the bands exist to
      // prevent.
      expect(board.restricted_free_agency_pool).to.equal(undefined)
    })

    // Pool 1. The buffer is $3 and not $6 for a structural reason: a $5 minimum
    // contract prices at $0 at best, so its gap cannot exceed $5, and any
    // threshold above $5 removes every minimum contract from the pool for being
    // cheap rather than for being fairly priced.
    it('holds a contract out of the shed pool below the market-gap buffer', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            // $18 against a $16 price: a $2 gap. Real, and not a contract
            // anyone sheds -- this is the B.Bowers case that established the
            // buffer, and it counted $18 of "releasable" salary before it.
            { tid: 1, pid: 'NEARLY_FAIR', value: 13, market_salary: 16 },
            // A $5 minimum contract at a $0 price: a $5 gap, and it STAYS. At a
            // $6 buffer this row could not qualify at any price.
            { tid: 1, pid: 'MINIMUM', value: 0, market_salary: 0 },
            { tid: 2, pid: 'B1', value: 40, market_salary: 5 }
          ]
        })
      )

      const pool_row = (pid) => board.market_pool.find((row) => row.pid === pid)

      pool_row('NEARLY_FAIR').market_gap.should.equal(2)
      pool_row('NEARLY_FAIR').under_pressure.should.equal(false)
      pool_row('NEARLY_FAIR').releasable.should.equal(false)

      pool_row('MINIMUM').post_deadline_salary.should.equal(5)
      pool_row('MINIMUM').market_gap.should.equal(5)
      pool_row('MINIMUM').under_pressure.should.equal(true)

      // Only the minimum contract funds capacity; the $2-gap row funds nothing.
      board.bid_capacity
        .find((row) => row.tid === 1)
        .attachable_release_salary.should.equal(5)
    })

    // Pool 2. `releasable` is a claim about the OWNER, `under_pressure` a fact
    // about the contract, and only the first belongs in a spending-power figure.
    it('separates a releasable contract from one merely priced above the market', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            // $60 against a $26 price: a $34 gap at ratio 0.43. An auction
            // plausibly returns him below what the contract costs today.
            { tid: 1, pid: 'REACQUIRABLE', value: 55, market_salary: 26 },
            // $55 against a $48 price: a $7 gap at ratio 0.87. A real gap, and
            // nothing to recover -- the market rates him at what he is paid.
            { tid: 1, pid: 'PRICED_FAIRLY', value: 50, market_salary: 48 },
            { tid: 2, pid: 'B1', value: 40, market_salary: 5 }
          ]
        })
      )

      const pool_row = (pid) => board.market_pool.find((row) => row.pid === pid)

      pool_row('REACQUIRABLE').market_gap.should.equal(34)
      pool_row('REACQUIRABLE').under_pressure.should.equal(true)
      pool_row('REACQUIRABLE').releasable.should.equal(true)

      pool_row('PRICED_FAIRLY').market_gap.should.equal(7)
      pool_row('PRICED_FAIRLY').under_pressure.should.equal(true)
      pool_row('PRICED_FAIRLY').releasable.should.equal(false)

      // Capacity counts the releasable contract alone. Summing the wider set
      // would credit this franchise with $55 it would never free.
      const capacity = board.bid_capacity.find((row) => row.tid === 1)
      capacity.attachable_contract_count.should.equal(1)
      capacity.attachable_release_salary.should.equal(60)
    })

    // Pool rank spans the shed pool AND the tagged players, because they are one
    // question: what could change hands this period. Ranking them separately is
    // what forced two rank scales onto one page.
    it('ranks tagged players and shed-pool contracts on one scale', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            {
              tid: 1,
              pid: 'TAGGED_BEST',
              tag: 4,
              value: 20,
              market_salary: 30,
              dynasty_value: 9500
            },
            {
              tid: 1,
              pid: 'SHED_MID',
              value: 40,
              market_salary: 5,
              dynasty_value: 7000
            },
            {
              tid: 2,
              pid: 'SHED_WORST',
              value: 40,
              market_salary: 5,
              dynasty_value: 2000
            },
            // Paid below the market and untagged: in neither set, so ranked
            // nowhere despite leading the league on dynasty value.
            {
              tid: 2,
              pid: 'KEPT',
              value: 5,
              market_salary: 60,
              dynasty_value: 9900
            }
          ]
        })
      )

      const pool_row = (pid) => board.market_pool.find((row) => row.pid === pid)

      pool_row('TAGGED_BEST').pool_rank.should.equal(1)
      pool_row('SHED_MID').pool_rank.should.equal(2)
      pool_row('SHED_WORST').pool_rank.should.equal(3)
      pool_row('TAGGED_BEST').pool_size.should.equal(3)

      expect(pool_row('KEPT').pool_rank).to.equal(null)
      pool_row('KEPT').dynasty_rank.should.equal(1)
    })

    it('declares band membership and order as pids into the pool', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          viewer_tid: 1,
          players: [
            // tid 1: two under pressure at different gaps, one paid under.
            { tid: 1, pid: 'WIDE', pos: 'WR', value: 40, market_salary: 5 },
            { tid: 1, pid: 'NARROW', pos: 'WR', value: 20, market_salary: 16 },
            { tid: 1, pid: 'FAIR', pos: 'WR', value: 5, market_salary: 40 },
            { tid: 2, pid: 'RIVAL', pos: 'RB', value: 30, market_salary: 5 }
          ]
        })
      )

      const bands = board.market_bands

      // Viewer-scoped, widest gap first, and the under-market contract is out.
      bands.contracts_under_pressure.should.eql(['WIDE', 'NARROW'])

      // League-wide, grouped by position, ordered by MARKET PRICE descending —
      // a different key from the band above. NARROW leads on a $16 price
      // despite the narrower gap, because this band answers what a bidder could
      // acquire rather than whose owner is overpaying most.
      bands.incoming_supply.should.eql({
        WR: ['NARROW', 'WIDE'],
        RB: ['RIVAL']
      })

      // The headline count is derived from the band, never counted separately.
      board.league_market.incoming_supply.should.eql({ WR: 2, RB: 1 })

      // All three clear both nomination conditions, and the pool is ordered by
      // gap rather than by team: 40, 30, then NARROW's 25 - 16 = 9.
      bands.rfa_nomination_pool.should.eql(['WIDE', 'RIVAL', 'NARROW'])

      // Every pid resolves into market_pool -- the bands are references, not
      // copies, so a band naming a row the pool does not carry is a defect.
      const pool_pids = new Set(board.market_pool.map((row) => row.pid))
      const all_band_pids = [
        ...bands.contracts_under_pressure,
        ...Object.values(bands.incoming_supply).flat(),
        ...bands.rfa_nomination_pool
      ]
      all_band_pids.every((pid) => pool_pids.has(pid)).should.equal(true)
    })

    it('reports no contracts-under-pressure band without a viewer', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [{ tid: 1, pid: 'A1', value: 40, market_salary: 5 }]
        })
      )

      // Null rather than an empty array: absent because nobody is viewing is a
      // different fact from a viewer holding no such contracts.
      expect(board.market_bands.contracts_under_pressure).to.equal(null)
      board.market_bands.incoming_supply.should.eql({ WR: ['A1'] })
    })

    it('excludes tagged contracts from the pool', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            {
              tid: 1,
              pid: 'TAGGED',
              pos: 'RB',
              tag: 2,
              value: 90,
              market_salary: 5
            },
            { tid: 1, pid: 'FAIR', value: 5, market_salary: 30 },
            { tid: 2, pid: 'B1', value: 20, market_salary: 10 }
          ]
        })
      )

      board.market_pool.map((row) => row.pid).should.not.include('TAGGED')
    })
  })

  describe('bid capacity', function () {
    it('adds attachable release salary to post-extension room', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            { tid: 1, pid: 'OVER', value: 90, market_salary: 20 },
            { tid: 1, pid: 'FAIR', value: 5, market_salary: 30 },
            { tid: 2, pid: 'B1', value: 20, market_salary: 10 }
          ]
        })
      )

      const capacity = board.bid_capacity.find((row) => row.tid === 1)
      // 200 - (95 + 10) = 95 of room, plus the $95 contract priced above the
      // market. FAIR is paid below its price and is not shed-eligible.
      capacity.cap_room.should.equal(95)
      capacity.attachable_release_salary.should.equal(95)
      capacity.capacity.should.equal(190)
      capacity.open_active_roster_spots.should.equal(14)
    })

    it('fires execution risk when the active roster is full', function () {
      const players = []
      for (let i = 0; i < 16; i += 1) {
        players.push({
          tid: 1,
          pid: `A${i}`,
          value: 1,
          dynasty_value: 1000 + i
        })
      }
      players.push({ tid: 2, pid: 'B1', value: 10 })

      const board = build_tag_board(
        build_fixture({ teams: two_teams, players })
      )
      board.bid_capacity
        .find((row) => row.tid === 1)
        .open_active_roster_spots.should.equal(0)
      rules_fired(board, 1).should.include('execution_risk')
      rules_fired(board, 2).should.not.include('execution_risk')
    })
  })

  describe('nomination schedule', function () {
    it('runs one team per day in descending draft order, cycling twice', function () {
      const schedule = build_rfa_schedule({
        season,
        teams: [
          { team_id: 5, name: 'Fifth', draft_order: 1 },
          { team_id: 9, name: 'Ninth', draft_order: 3 },
          { team_id: 2, name: 'Second', draft_order: 2 }
        ]
      })

      schedule.map((row) => row.tid).should.eql([9, 2, 5])
      schedule[0].windows.should.have.length(2)

      const day = 24 * 60 * 60
      const start = Math.round(
        season.restricted_free_agency_period_start.getTime() / 1000
      )
      schedule[0].windows[0].at_iso.should.equal(
        new Date(start * 1000).toISOString()
      )
      schedule[2].windows[0].at_iso.should.equal(
        new Date((start + 2 * day) * 1000).toISOString()
      )
      schedule[2].windows[1].at_iso.should.equal(
        new Date((start + 5 * day) * 1000).toISOString()
      )
    })
  })

  describe('calendar freshness', function () {
    it('stamps the read and names the nearest future deadline', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            { tid: 1, pid: 'A1', value: 10 },
            { tid: 2, pid: 'B1', value: 10 }
          ]
        })
      )

      const freshness = board.calendar_freshness
      freshness.read_at_iso.should.equal(
        new Date(now_unix * 1000).toISOString()
      )
      freshness.next_deadline.field.should.equal('extension_deadline_at')
      freshness.next_deadline.at_iso.should.equal(
        season.extension_deadline_at.toISOString()
      )
    })
  })

  describe('information boundary', function () {
    const cutlist = [
      { tid: 1, pid: 'A1', sort_order: 0 },
      { tid: 2, pid: 'B1', sort_order: 0 }
    ]
    const bids = [
      { tid: 1, pid: 'A1', bid_amount: 21, submitted: 1, announced: null },
      { tid: 2, pid: 'B1', bid_amount: 40, submitted: 1, announced: null }
    ]
    const players = [
      { tid: 1, pid: 'A1', value: 10 },
      { tid: 2, pid: 'B1', value: 10 }
    ]

    it('carries no private block on the public board', function () {
      const board = build_tag_board(
        build_fixture({ teams: two_teams, players })
      )
      expect(board.private).to.equal(undefined)
      expect(board.viewer_tid).to.equal(undefined)
      JSON.stringify(board).should.not.include('cutlist')
    })

    it("renders only the viewer's own cutlist and offers", function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players,
          viewer_tid: 1,
          viewer_cutlist: cutlist,
          viewer_rfa_bids: bids
        })
      )

      board.private.cutlist.map((row) => row.pid).should.eql(['A1'])
      board.private.restricted_free_agency_offers
        .map((row) => row.pid)
        .should.eql(['A1'])
      // A rival's offer amount must not appear anywhere in the artifact.
      JSON.stringify(board).should.not.include('40')
    })

    it('emits no offer amount or retention threshold, not even for the viewer', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players,
          viewer_tid: 1,
          viewer_rfa_bids: [
            { tid: 1, pid: 'A1', bid_amount: 21, submitted: 1 },
            { tid: 1, pid: 'A2', bid_amount: 5, submitted: 1 }
          ]
        })
      )

      const offers = board.private.restricted_free_agency_offers
      offers.map((row) => row.pid).should.eql(['A1', 'A2'])
      for (const offer of offers) {
        expect(offer.bid_amount).to.equal(undefined)
        expect(offer.retention_threshold).to.equal(undefined)
      }
      // The amounts and both derived thresholds (25 and 7) stay out entirely.
      const serialized = JSON.stringify(board)
      serialized.should.not.include('retention_threshold')
      serialized.should.not.include('bid_amount')
      rules_fired(board, 1).should.not.include('own_nomination_exposure')
    })
  })

  describe('considerations', function () {
    it('states whether the remaining tags close the overage', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            { tid: 1, pid: 'BIG', pos: 'RB', value: 150, extensions: 3 },
            { tid: 1, pid: 'A2', pos: 'WR', value: 60, extensions: 0 },
            { tid: 2, pid: 'B1', value: 10 }
          ]
        })
      )

      const rule = board.considerations[1].find(
        (row) => row.rule === 'tag_sufficiency'
      )
      // 170 + 65 = 235 against 200.
      rule.inputs.overage.should.equal(35)
      // Best franchise saving: 170 - 41 = 129 on the RB.
      rule.inputs.best_franchise_saving.should.equal(129)
      rule.inputs.closes_gap.should.equal(true)
      rule.sentence.should.not.match(/should|recommend|worth/i)
    })

    it('fires the constrained bidder rule only when shedding cannot clear the cap', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            // One expensive contract the market rates highly, so nothing is
            // attachable and the overage stands.
            {
              tid: 1,
              pid: 'STAR',
              value: 240,
              extensions: 0,
              dynasty_value: 9999
            },
            { tid: 2, pid: 'B1', value: 10, dynasty_value: 100 }
          ]
        })
      )

      board.bid_capacity
        .find((row) => row.tid === 1)
        .attachable_release_salary.should.equal(0)
      rules_fired(board, 1).should.include('constrained_bidder')
      rules_fired(board, 2).should.not.include('constrained_bidder')
    })

    it('names the tension between the largest saving and the best-ranked candidate', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            {
              tid: 1,
              pid: 'SAVER',
              pos: 'TE',
              value: 40,
              extensions: 0,
              dynasty_value: 100
            },
            {
              tid: 1,
              pid: 'BEST',
              pos: 'WR',
              value: 30,
              extensions: 0,
              dynasty_value: 9999
            },
            { tid: 2, pid: 'B1', value: 10, dynasty_value: 5000 }
          ]
        })
      )

      const rule = board.considerations[1].find(
        (row) => row.rule === 'saving_and_quality_diverge'
      )
      // TE: 45 - 10 = 35. WR: 35 - 28 = 7.
      rule.inputs.largest_saving.pid.should.equal('SAVER')
      rule.inputs.best_ranked.pid.should.equal('BEST')
    })

    it('vetoes a franchise candidate the projection puts below replacement', function () {
      const fixture = build_fixture({
        teams: two_teams,
        players: [
          // Screens on price: extension 32 against a TE franchise price of 10.
          {
            tid: 1,
            pid: 'BELOW',
            pos: 'TE',
            value: 17,
            extensions: 2,
            dynasty_value: 500
          },
          { tid: 2, pid: 'B1', value: 10, dynasty_value: 5000 }
        ]
      })
      fixture.projected_points_added = new Map([['BELOW', -15.09]])
      const board = build_tag_board(fixture)

      const row = board.tag_board
        .find((team) => team.tid === 1)
        .players.find((player) => player.pid === 'BELOW')
      row.franchise_saving.should.be.above(0)
      row.below_replacement.should.equal(true)
      row.eligibility.franchise.should.equal(false)
      row.eligibility.franchise_worth_ok.should.equal(false)
    })

    it('keeps an unprojected player eligible rather than suppressing him', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            {
              tid: 1,
              pid: 'NOPROJ',
              pos: 'TE',
              value: 17,
              extensions: 2,
              dynasty_value: 500,
              pts_added: null
            },
            { tid: 2, pid: 'B1', value: 10, dynasty_value: 5000 }
          ]
        })
      )

      const row = board.tag_board
        .find((team) => team.tid === 1)
        .players.find((player) => player.pid === 'NOPROJ')
      row.projection_missing.should.equal(true)
      row.below_replacement.should.equal(false)
      row.eligibility.franchise.should.equal(true)
    })

    it('withholds the saving-versus-quality tension once the franchise tag is set', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            {
              tid: 1,
              pid: 'SAVER',
              pos: 'TE',
              value: 40,
              extensions: 0,
              dynasty_value: 100
            },
            {
              tid: 1,
              pid: 'BEST',
              pos: 'WR',
              value: 30,
              extensions: 0,
              dynasty_value: 9999
            },
            // consumes the team's single franchise tag
            {
              tid: 1,
              pid: 'TAGGED',
              pos: 'RB',
              tag: 2,
              value: 50,
              dynasty_value: 4000
            },
            { tid: 2, pid: 'B1', value: 10, dynasty_value: 5000 }
          ]
        })
      )

      board.tag_budget
        .find((row) => row.tid === 1)
        .franchise.remaining.should.equal(0)
      rules_fired(board, 1).should.not.include('saving_and_quality_diverge')
    })
  })
})
