/* global describe it */

// Module-level coverage for the season forecast, driven entirely from injected
// score vectors. Nothing here touches a database: `simulate_season_forecast`
// takes its context and its per-week score vectors as parameters that default
// to the real loaders, so these cases exercise the real Monte Carlo, the real
// get_playoff_seeding and the real bracket resolution against synthetic input.
// Run it with the test container STOPPED to confirm that is true.

import * as chai from 'chai'

import { simulate_season_forecast } from '#libs-server/simulation/simulate-season-forecast.mjs'

const expect = chai.expect

const TEN_TEAMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

// League 1's live 2026 configuration, read off the seasons row: ten teams, no
// divisions, six playoff places, two admitted directly on All Play, two on
// head-to-head record and two at large on points for.
const ALL_PLAY_BYE_FORMAT = {
  playoff_team_count: 6,
  bye_count: 2,
  bye_candidate_pool: 'league',
  bye_selection_method: 'all_play',
  at_large_selection_method: 'points_for',
  has_division_winner_berths: false,
  head_to_head_berth_count: 2
}

const build_teams = ({ team_ids = TEN_TEAMS, divisions = null } = {}) =>
  team_ids.map((team_id, index) => ({
    team_id,
    division: divisions ? divisions[index] : null
  }))

const build_round_robin_week = ({ team_ids, week }) => {
  const matchups = []
  for (let index = 0; index < team_ids.length; index += 2) {
    matchups.push({
      matchup_id: week * 100 + index,
      week,
      home_team_id: team_ids[index],
      away_team_id: team_ids[index + 1]
    })
  }
  return matchups
}

const zero_standings = ({ team_ids, teams }) => {
  const team_stats_by_tid = {}
  for (const team of teams) {
    team_stats_by_tid[team.team_id] = {
      tid: team.team_id,
      division: team.division,
      regular_season_wins: 0,
      regular_season_losses: 0,
      regular_season_ties: 0,
      points_for: 0,
      all_play_wins: 0,
      all_play_losses: 0,
      all_play_ties: 0
    }
  }
  return team_stats_by_tid
}

/**
 * A context the forecast can run on with no database behind it.
 */
const build_context = ({
  team_ids = TEN_TEAMS,
  divisions = null,
  weeks = [1, 2, 3],
  playoff_format = ALL_PLAY_BYE_FORMAT,
  team_stats_by_tid = null
} = {}) => {
  const teams = build_teams({ team_ids, divisions })
  const remaining_matchups = weeks.flatMap((week) =>
    build_round_robin_week({ team_ids, week })
  )

  return async () => ({
    teams,
    team_stats_by_tid: team_stats_by_tid || zero_standings({ team_ids, teams }),
    remaining_matchups,
    playoff_format,
    wildcard_week: 15,
    championship_weeks: [16, 17]
  })
}

/**
 * Independent per-team score vectors drawn from a seeded generator, with a
 * per-team mean the caller controls.
 */
const build_week_scores = ({
  team_ids,
  n_simulations,
  mean_by_team_id,
  spread = 20,
  offset = 0
}) => {
  const raw_team_scores = new Map()
  for (const [team_index, team_id] of team_ids.entries()) {
    const mean = mean_by_team_id[team_id]
    const vector = new Array(n_simulations)
    for (let index = 0; index < n_simulations; index++) {
      // Deterministic and coprime-ish so no two teams share a phase.
      const wave = Math.sin((index + offset) * (0.7 + team_index * 0.11))
      vector[index] = mean + wave * spread
    }
    raw_team_scores.set(team_id, vector)
  }
  return raw_team_scores
}

const flat_playoff_scores = ({ team_ids, n_simulations, mean_by_team_id }) => {
  const by_week = new Map()
  for (const week of [15, 16, 17]) {
    by_week.set(
      week,
      build_week_scores({
        team_ids,
        n_simulations,
        mean_by_team_id,
        offset: week * 13
      })
    )
  }
  return async () => by_week
}

describe('SIMULATION season forecast', function () {
  this.timeout(30000)

  const n_simulations = 400

  // Teams 1 and 2 are the strongest, 9 and 10 the weakest, and the ladder
  // between them is monotone -- so a working forecast has to order the odds
  // the same way, and a broken one that reads a frozen zero cannot. The gaps
  // are deliberately SMALLER than the weekly spread below: a ladder wide
  // enough to make the bottom team's bye genuinely impossible would put a
  // legitimate 0 in the output and make the non-degeneracy case below assert
  // something the format does not promise.
  const mean_by_team_id = {
    1: 110,
    2: 109,
    3: 108,
    4: 107,
    5: 106,
    6: 105,
    7: 104,
    8: 103,
    9: 102,
    10: 101
  }

  const load_week_scores = async ({ week, n_simulations: n }) =>
    build_week_scores({
      team_ids: TEN_TEAMS,
      n_simulations: n,
      mean_by_team_id,
      spread: 35,
      offset: week * 7
    })

  const run = (overrides = {}) =>
    simulate_season_forecast({
      league_id: 1,
      year: 2026,
      week: 1,
      n_simulations,
      seed: 11,
      load_context: build_context(),
      load_week_scores,
      load_playoff_scores: flat_playoff_scores({
        team_ids: TEN_TEAMS,
        n_simulations,
        mean_by_team_id
      }),
      ...overrides
    })

  it('runs the whole Monte Carlo with no database available', async () => {
    const forecast = await run()

    expect(Object.keys(forecast)).to.have.lengthOf(10)
    for (const team_id of TEN_TEAMS) {
      expect(forecast[team_id].playoff_odds).to.be.a('number')
      expect(forecast[team_id].bye_odds).to.be.a('number')
      expect(forecast[team_id].championship_odds).to.be.a('number')
    }
  })

  // The regression that actually shipped. Assert the SHAPE, not a distinct-value
  // count: the broken output already carried two distinct bye_odds and seven
  // distinct championship_odds, so `count(distinct) > 1` passes against the
  // defect it is supposed to catch.
  it('leaves no team pinned at exactly 0 or 1 on bye or playoff odds', async () => {
    const forecast = await run()

    for (const team_id of TEN_TEAMS) {
      const { bye_odds, playoff_odds } = forecast[team_id]
      expect(bye_odds, `team ${team_id} bye_odds`).to.be.above(0)
      expect(bye_odds, `team ${team_id} bye_odds`).to.be.below(1)
      expect(playoff_odds, `team ${team_id} playoff_odds`).to.be.above(0)
      expect(playoff_odds, `team ${team_id} playoff_odds`).to.be.below(1)
    }
  })

  it('orders bye odds by All Play strength, which is what the format reads', async () => {
    const forecast = await run()

    expect(forecast[1].bye_odds).to.be.above(forecast[5].bye_odds)
    expect(forecast[5].bye_odds).to.be.above(forecast[10].bye_odds)
    expect(forecast[1].playoff_odds).to.be.above(forecast[10].playoff_odds)
  })

  // The discriminating case for the defect this task exists to fix. The
  // non-degeneracy check above CANNOT see it: with All Play and points_for
  // frozen at zero every comparison ties, the stable sort falls through to
  // by_record, and record still moves -- so a frozen forecast produces
  // perfectly fractional-looking bye odds. What separates the two models is
  // WHICH team gets the bye, so this fixture makes All Play and head-to-head
  // record disagree and pins the All Play answer.
  //
  // Team 3 wins every week and team 2 loses one, so record ranks 3 above 2.
  // Team 2 outscores everyone in eight of nine all-play meetings, so All Play
  // ranks 2 above 3. The format admits on All Play, so the bye is team 2's.
  it('awards the bye on All Play rather than on head-to-head record', async () => {
    const FOUR_TEAMS = [1, 2, 3, 4]
    const scores_by_week = {
      1: { 1: 200, 2: 210, 3: 100, 4: 90 },
      2: { 1: 200, 2: 210, 3: 100, 4: 90 },
      3: { 1: 215, 2: 210, 3: 100, 4: 90 }
    }

    const forecast = await simulate_season_forecast({
      league_id: 1,
      year: 2026,
      week: 1,
      n_simulations: 50,
      seed: 5,
      load_context: build_context({
        team_ids: FOUR_TEAMS,
        weeks: [1, 2, 3],
        playoff_format: {
          playoff_team_count: 2,
          bye_count: 1,
          bye_candidate_pool: 'league',
          bye_selection_method: 'all_play',
          at_large_selection_method: 'points_for',
          has_division_winner_berths: false,
          head_to_head_berth_count: 0
        }
      }),
      load_week_scores: async ({ week, n_simulations: n }) => {
        const raw_team_scores = new Map()
        for (const team_id of FOUR_TEAMS) {
          raw_team_scores.set(
            team_id,
            new Array(n).fill(scores_by_week[week][team_id])
          )
        }
        return raw_team_scores
      },
      load_playoff_scores: flat_playoff_scores({
        team_ids: FOUR_TEAMS,
        n_simulations: 50,
        mean_by_team_id: { 1: 110, 2: 110, 3: 110, 4: 110 }
      })
    })

    expect(
      forecast[2].bye_odds,
      'the bye went to the better RECORD, so All Play is not reaching the ladder'
    ).to.equal(1)
    expect(forecast[3].bye_odds).to.equal(0)
  })

  it('returns null division odds for a league with no divisions', async () => {
    const forecast = await run()

    for (const team_id of TEN_TEAMS) {
      expect(forecast[team_id].division_odds).to.equal(null)
    }
  })

  it('returns real division odds, distinct from bye odds, when divided', async () => {
    const divisions = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2]
    const forecast = await run({
      load_context: build_context({ divisions })
    })

    const division_odds = TEN_TEAMS.map((tid) => forecast[tid].division_odds)
    for (const odds of division_odds) {
      expect(odds).to.be.a('number')
    }

    // Exactly two division titles are awarded per iteration, so the odds sum to
    // two. Nothing about bye_odds implies that, which is what makes this a real
    // check that the alias is gone.
    const total = division_odds.reduce((sum, odds) => sum + odds, 0)
    expect(total).to.be.closeTo(2, 1e-9)

    const differs = TEN_TEAMS.some(
      (tid) =>
        Math.abs(forecast[tid].division_odds - forecast[tid].bye_odds) > 1e-9
    )
    expect(differs, 'division_odds is still an alias of bye_odds').to.equal(
      true
    )
  })

  it('refuses a league where only some teams carry a division', async () => {
    const divisions = [1, 1, 1, 1, 1, 2, 2, 2, 2, null]

    let error = null
    try {
      await run({ load_context: build_context({ divisions }) })
    } catch (err) {
      error = err
    }

    expect(error, 'a partially divided league was accepted').to.not.equal(null)
    expect(error.message).to.match(
      /carry no division; a league either has Divisions or it does not/
    )
  })

  it('names the team when a week produces no scores for it', async () => {
    let error = null
    try {
      await run({
        load_week_scores: async ({ week, n_simulations: n }) => {
          const scores = build_week_scores({
            team_ids: TEN_TEAMS,
            n_simulations: n,
            mean_by_team_id,
            offset: week * 7
          })
          scores.delete(7)
          return scores
        }
      })
    } catch (err) {
      error = err
    }

    expect(error, 'a week missing a team was accepted').to.not.equal(null)
    expect(error.message).to.match(
      /produced no simulated scores for team\(s\) 7/
    )
  })

  it('gives the same answer twice at one seed and a different one at another', async () => {
    const first = await run()
    const second = await run()
    const other = await run({ seed: 12 })

    expect(JSON.stringify(first)).to.equal(JSON.stringify(second))
    expect(JSON.stringify(first)).to.not.equal(JSON.stringify(other))
  })

  it('champions are drawn from the playoff field and are not uniform over it', async () => {
    const forecast = await run()

    const total = TEN_TEAMS.reduce(
      (sum, tid) => sum + forecast[tid].championship_odds,
      0
    )
    expect(total).to.be.closeTo(1, 1e-9)

    // The strongest team must not be the least likely champion, which is what a
    // uniform draw over the field would allow.
    const weakest_champion_odds = Math.min(
      ...TEN_TEAMS.map((tid) => forecast[tid].championship_odds)
    )
    expect(forecast[1].championship_odds).to.be.above(weakest_champion_odds)
  })

  describe('forced outcomes', function () {
    // A whole week held constant: every draw has the same scores, so the
    // matchup is decided and one conditional subset is empty by construction.
    // That is the state of every week between its last kickoff and the
    // rollover, so it has to return rather than throw.
    const constant_week_scores = async ({ n_simulations: n }) => {
      const raw_team_scores = new Map()
      for (const team_id of TEN_TEAMS) {
        raw_team_scores.set(
          team_id,
          new Array(n).fill(mean_by_team_id[team_id])
        )
      }
      return raw_team_scores
    }

    it('orders a forced win above the unconditional result above a forced loss', async () => {
      const base = await run()
      const with_win = await run({ force_win_tid: 5 })
      const with_loss = await run({ force_loss_tid: 5 })

      expect(with_win[5].playoff_odds).to.be.at.least(base[5].playoff_odds)
      expect(base[5].playoff_odds).to.be.at.least(with_loss[5].playoff_odds)
    })

    it('returns rather than throwing when the week is already decided', async () => {
      const forced_win = await run({
        load_week_scores: constant_week_scores,
        force_win_tid: 10
      })
      const forced_loss = await run({
        load_week_scores: constant_week_scores,
        force_loss_tid: 10
      })

      // Team 10 is the lowest mean and its opponent (team 9) is higher, so a
      // forced WIN is the impossible direction here and must still answer.
      expect(forced_win[10].playoff_odds).to.be.a('number')
      expect(forced_loss[10].playoff_odds).to.be.a('number')
    })

    it('refuses a conditioning subset too small to estimate from', async () => {
      // Team 1 beats team 2 in all but a handful of draws, so conditioning on a
      // team 1 LOSS leaves far fewer than the hundred-draw floor.
      const lopsided = async ({ n_simulations: n }) => {
        const raw_team_scores = new Map()
        for (const team_id of TEN_TEAMS) {
          raw_team_scores.set(
            team_id,
            new Array(n).fill(mean_by_team_id[team_id])
          )
        }
        // Give team 1 exactly three losing draws out of n.
        const team_one = raw_team_scores.get(1).slice()
        team_one[0] = 0
        team_one[1] = 0
        team_one[2] = 0
        raw_team_scores.set(1, team_one)
        return raw_team_scores
      }

      let error = null
      try {
        await run({ load_week_scores: lopsided, force_loss_tid: 1 })
      } catch (err) {
        error = err
      }

      expect(
        error,
        'a three-draw conditioning subset was accepted'
      ).to.not.equal(null)
      expect(error.message).to.match(
        /below the 100 needed for a usable estimate/
      )
    })
  })

  // The control that stops someone "simplifying" the shared-index draw back
  // into independent per-team draws. Two teams whose vectors are exact
  // complements across indexes must produce exactly complementary All Play
  // records -- a property that holds only if every team is read at the SAME
  // index. The two are built as a MATCHUP, which is where correlation lives in
  // this engine: it exists within an NFL game and is exactly zero across games,
  // so a control resting on two teams in different games would assert joint
  // structure the engine never provides and would pass against independent
  // draws.
  describe('shared-index negative control', function () {
    const PAIR = [1, 2]

    const anti_correlated_scores = async ({ n_simulations: n }) => {
      const raw_team_scores = new Map()
      const high = new Array(n)
      const low = new Array(n)
      for (let index = 0; index < n; index++) {
        const is_even = index % 2 === 0
        high[index] = is_even ? 140 : 80
        low[index] = is_even ? 80 : 140
      }
      raw_team_scores.set(1, high)
      raw_team_scores.set(2, low)
      return raw_team_scores
    }

    it('gives an exactly complementary All Play record to an anti-correlated pair', async () => {
      const forecast = await simulate_season_forecast({
        league_id: 1,
        year: 2026,
        week: 1,
        n_simulations: 200,
        seed: 3,
        load_context: build_context({
          team_ids: PAIR,
          weeks: [1],
          playoff_format: {
            playoff_team_count: 2,
            bye_count: 1,
            bye_candidate_pool: 'league',
            bye_selection_method: 'all_play',
            at_large_selection_method: 'points_for',
            has_division_winner_berths: false,
            head_to_head_berth_count: 0
          }
        }),
        load_week_scores: anti_correlated_scores,
        load_playoff_scores: flat_playoff_scores({
          team_ids: PAIR,
          n_simulations: 200,
          mean_by_team_id: { 1: 110, 2: 110 }
        })
      })

      // Read at ONE index the two teams never tie -- one is at 140 exactly
      // when the other is at 80 -- so each takes the bye in about half the
      // draws and team 1 lands near 0.500.
      //
      // Drawing an index per TEAM breaks that and the failure is one-sided,
      // which is why the assertion is two-sided around 0.5 rather than a sum.
      // Independent draws put both teams at 140 a quarter of the time and both
      // at 80 another quarter, and a tie falls through every comparator to the
      // stable order, handing team 1 the bye: 0.25 + 0.5 = 0.750.
      expect(
        forecast[1].bye_odds,
        'team 1 is not near an even split, so the two teams were not read at one index'
      ).to.be.closeTo(0.5, 0.12)
    })
  })
})
