/* global describe it */

import * as chai from 'chai'

import build_tag_board, {
  contract_key,
  post_deadline_salary,
  passes_consecutive_year_check,
  build_rfa_schedule,
  resolve_rookie_class_year,
  COVERAGE_PRECISE_MIN
} from '#libs-server/tag-board/build-tag-board.mjs'

chai.should()
const expect = chai.expect

// The live 2026 GENESIS LEAGUE settings the board reads from the seasons row.
const season = {
  lid: 1,
  year: 2026,
  league_format_id: 'genesis_10_team',
  fqb: 39,
  frb: 41,
  fwr: 28,
  fte: 10,
  tag2: 1,
  tag3: 1,
  tag4: 2,
  ext_date: 1785470399,
  restricted_free_agency_period_start: 1785556800,
  restricted_free_agency_period_end: 1787371199,
  draft_start: 1787371200
}

// 9 starters + 7 bench = an active roster limit of 16.
const league_format = {
  id: 'genesis_10_team',
  cap: 200,
  format_category: 5,
  sqb: 1,
  srb: 2,
  swr: 2,
  ste: 1,
  srbwr: 0,
  srbwrte: 1,
  sqbrbwrte: 1,
  swrte: 0,
  sdst: 1,
  sk: 0,
  bench: 7
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
  nfl_draft_year = 2020
}) => ({
  row: { tid, pid, pos, slot, tag, extensions },
  contract: [contract_key(tid, pid), value],
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
  viewer_rfa_bids = null
}) => {
  const specs = player_specs.map(make_player)
  return {
    lid: 1,
    year: 2026,
    now_unix,
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
    rookie_class_year: 2025,
    viewer_tid,
    viewer_cutlist,
    viewer_rfa_bids
  }
}

const two_teams = [
  { uid: 1, name: 'Alpha', draft_order: 2 },
  { uid: 2, name: 'Beta', draft_order: 1 }
]

const team_board = (board, tid) =>
  board.tag_board.find((row) => row.tid === tid)
const team_exposure = (board, tid) =>
  board.cap_exposure.find((row) => row.tid === tid)
const team_levers = (board, tid) =>
  board.lever_budget.find((row) => row.tid === tid)
const rules_fired = (board, tid) =>
  board.considerations[tid].map((row) => row.rule)

describe('tag board', function () {
  describe('post-deadline salary', function () {
    it('extends a regular contract up the ladder', function () {
      post_deadline_salary({
        tag: 1,
        pos: 'WR',
        extensions: 2,
        value: 30,
        season
      }).should.equal(45)
    })

    it('replaces a franchise-tagged value with the stored position price', function () {
      // Not 61 + 5: the tag REPLACES the value rather than freezing it.
      post_deadline_salary({
        tag: 2,
        pos: 'RB',
        extensions: 0,
        value: 61,
        season
      }).should.equal(41)
    })

    it('zeroes a rookie-tagged contract', function () {
      // Constitution Article VIII §3. get_extension_amount returns the
      // unchanged value here, and following it understates nothing but
      // overstates the tagged team's cap line.
      post_deadline_salary({
        tag: 3,
        pos: 'RB',
        extensions: 0,
        value: 10,
        season
      }).should.equal(0)
    })

    it('leaves a restricted free agency contract pending', function () {
      post_deadline_salary({
        tag: 4,
        pos: 'WR',
        extensions: 1,
        value: 21,
        season
      }).should.equal(21)
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
            // rookie -> 0, replacing 10
            { tid: 1, pid: 'ROO', pos: 'RB', tag: 3, value: 10 },
            // restricted free agency -> unchanged 21
            { tid: 1, pid: 'RFA', pos: 'WR', tag: 4, value: 21 },
            { tid: 2, pid: 'B1', pos: 'WR', tag: 1, extensions: 0, value: 10 }
          ]
        })
      )

      const exposure = team_exposure(board, 1)
      exposure.current_salary.should.equal(112)
      exposure.post_extension_salary.should.equal(87)
      exposure.current_room.should.equal(88)
      exposure.post_extension_room.should.equal(113)
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

  describe('lever budget', function () {
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

      const spent = team_levers(board, 1)
      spent.franchise.remaining.should.equal(0)
      spent.rookie.remaining.should.equal(0)
      spent.restricted_free_agency.remaining.should.equal(0)

      const unspent = team_levers(board, 2)
      unspent.franchise.remaining.should.equal(1)
      unspent.rookie.remaining.should.equal(1)
      unspent.restricted_free_agency.remaining.should.equal(2)

      board.league_market.teams_with_unspent_lever.franchise.should.equal(1)
      board.league_market.unspent_lever_count.franchise.should.equal(1)

      // the discriminating case: one team holds two unspent nominations, so
      // the team count and the tag count must not agree. rendering the team
      // count as a tag count halves the stated supply.
      board.league_market.teams_with_unspent_lever.restricted_free_agency.should.equal(
        1
      )
      board.league_market.unspent_lever_count.restricted_free_agency.should.equal(
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

      team_levers(board, 1).franchise.remaining.should.equal(0)
    })

    it('withholds candidate eligibility once the lever is spent', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            // extension price 60 > the $41 RB franchise price, so the price
            // screen passes; the lever is gone regardless.
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
        { tid: 1, pid: 'CMC', year: 2025 },
        { tid: 1, pid: 'CMC', year: 2024 }
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
        franchise_tag_history: [{ tid: 1, pid: 'CMC', year: 2025 }]
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
          { tid: 2, pid: 'SAQ', year: 2025 },
          { tid: 1, pid: 'SAQ', year: 2024 }
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
        (row) => row.rule === 'empty_screen' && row.inputs.lever === 'franchise'
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
      board.lever_budget
        .find((r) => r.tid === 2)
        .franchise.remaining.should.equal(0)
      board.league_market.teams_with_franchise_candidate.should.not.include(2)
      expect(board.league_market.candidate_concentration.WR).to.equal(undefined)

      const fired = board.considerations[1].filter(
        (row) => row.rule === 'empty_screen' && row.inputs.lever === 'franchise'
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
        (row) => row.rule === 'empty_screen' && row.inputs.lever === 'rookie'
      )
      fired.should.have.length(1)
      fired[0].inputs.rivals.should.eql([])
    })
  })

  describe('rookie screen', function () {
    it('resolves eligibility to the most recent completed draft class', function () {
      const season_rows = [
        {
          year: 2024,
          rookie_draft_completed_at: null,
          draft_start: 1721707200
        },
        {
          year: 2025,
          rookie_draft_completed_at: 1755187200,
          draft_start: 1752552000
        },
        // 2026's draft has not run yet.
        { year: 2026, rookie_draft_completed_at: null, draft_start: 1787371200 }
      ]
      resolve_rookie_class_year({ season_rows, now_unix }).should.equal(2025)
    })

    it('falls back to draft_start when no completion timestamp is recorded', function () {
      const season_rows = [
        {
          year: 2023,
          rookie_draft_completed_at: null,
          draft_start: 1687147200
        },
        { year: 2024, rookie_draft_completed_at: null, draft_start: 1721707200 }
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
      // Saving is the whole extension price the $0 tag replaces.
      rows.find((p) => p.pid === 'R25').rookie_saving.should.equal(13)
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
      expect(row.divergence).to.equal(null)
      board.divergence.map((r) => r.pid).should.not.include('RETIRED')
    })
  })

  describe('rank divergence', function () {
    it('reads positive when a contract is paid above its market standing', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            // Highest salary, worst market standing.
            { tid: 1, pid: 'OVER', value: 90, dynasty_value: 100 },
            { tid: 1, pid: 'FAIR', value: 5, dynasty_value: 9000 },
            { tid: 2, pid: 'B1', value: 20, dynasty_value: 5000 }
          ]
        })
      )

      const over = board.divergence.find((row) => row.pid === 'OVER')
      over.salary_rank.should.equal(1)
      over.dynasty_rank.should.equal(3)
      over.divergence.should.equal(2)
      board.divergence[0].pid.should.equal('OVER')
    })

    it('excludes tagged contracts from the screen', function () {
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
              dynasty_value: 100
            },
            { tid: 1, pid: 'FAIR', value: 5, dynasty_value: 9000 },
            { tid: 2, pid: 'B1', value: 20, dynasty_value: 5000 }
          ]
        })
      )

      board.divergence.map((row) => row.pid).should.not.include('TAGGED')
    })
  })

  describe('bid capacity', function () {
    it('adds attachable release salary to post-extension room', function () {
      const board = build_tag_board(
        build_fixture({
          teams: two_teams,
          players: [
            { tid: 1, pid: 'OVER', value: 90, dynasty_value: 100 },
            { tid: 1, pid: 'FAIR', value: 5, dynasty_value: 9000 },
            { tid: 2, pid: 'B1', value: 20, dynasty_value: 5000 }
          ]
        })
      )

      const capacity = board.bid_capacity.find((row) => row.tid === 1)
      // 200 - (95 + 10) = 95 of room, plus the $95 overpaid contract.
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
          { uid: 5, name: 'Fifth', draft_order: 1 },
          { uid: 9, name: 'Ninth', draft_order: 3 },
          { uid: 2, name: 'Second', draft_order: 2 }
        ]
      })

      schedule.map((row) => row.tid).should.eql([9, 2, 5])
      schedule[0].windows.should.have.length(2)

      const day = 24 * 60 * 60
      const start = season.restricted_free_agency_period_start
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
      freshness.next_deadline.field.should.equal('ext_date')
      freshness.next_deadline.at_iso.should.equal(
        new Date(season.ext_date * 1000).toISOString()
      )
    })
  })

  describe('information boundary', function () {
    const cutlist = [
      { tid: 1, pid: 'A1', sort_order: 0 },
      { tid: 2, pid: 'B1', sort_order: 0 }
    ]
    const bids = [
      { tid: 1, pid: 'A1', bid: 21, submitted: 1, announced: null },
      { tid: 2, pid: 'B1', bid: 40, submitted: 1, announced: null }
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
            { tid: 1, pid: 'A1', bid: 21, submitted: 1 },
            { tid: 1, pid: 'A2', bid: 5, submitted: 1 }
          ]
        })
      )

      const offers = board.private.restricted_free_agency_offers
      offers.map((row) => row.pid).should.eql(['A1', 'A2'])
      for (const offer of offers) {
        expect(offer.bid).to.equal(undefined)
        expect(offer.retention_threshold).to.equal(undefined)
      }
      // The amounts and both derived thresholds (25 and 7) stay out entirely.
      const serialized = JSON.stringify(board)
      serialized.should.not.include('retention_threshold')
      serialized.should.not.include('"bid"')
      rules_fired(board, 1).should.not.include('own_nomination_exposure')
    })
  })

  describe('considerations', function () {
    it('states whether the remaining levers close the overage', function () {
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
        (row) => row.rule === 'lever_sufficiency'
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

    it('names the divergence between the largest saving and the best-ranked candidate', function () {
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
              dynasty_value: 500
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

    it('withholds the divergence once the franchise tag is already spent', function () {
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

      board.lever_budget
        .find((row) => row.tid === 1)
        .franchise.remaining.should.equal(0)
      rules_fired(board, 1).should.not.include('saving_and_quality_diverge')
    })
  })
})
