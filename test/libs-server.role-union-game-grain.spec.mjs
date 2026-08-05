/* global describe before after it */

import * as chai from 'chai'

import db from '#db'
import { build_period_cte } from '#libs-server/data-views/output-aggregator/build-period-cte.mjs'

const expect = chai.expect

// The per-game stage in build_role_union_period_cte.
//
// The role-union path emits one row per PLAY and, before this stage existed,
// grouped straight to period grain -- so the only measure it could express was a
// plain SUM of per-play values. Every non-linear scoring rule is a condition on
// a player-GAME aggregate (a 300-yard passing milestone, a DST points-against
// threshold), and there was no grain at which the outer aggregate could evaluate
// one.
//
// These assertions are the gate for that stage, and they are deliberately at the
// BUILDER level rather than through a column definition. No production scoring
// format declares an aggregate-conditional term today, so a test routed through
// a real column could only exercise the linear path -- it would pass identically
// against a builder that ignored `game_aggregates` entirely. Executing a
// synthetic role set is the only thing that distinguishes a working stage from
// an absent one.
//
// The `no declarations` case is the other half: the stage must NOT be emitted
// when nothing needs it, which is what keeps the 248 data-view goldens
// byte-identical and keeps an extra HashAggregate off every existing format's
// scan of nfl_plays.

const PASSER = 'TEST-RUGG-000001'
const RUSHER = 'TEST-RUGG-000002'

// Two games in one season so a season-grain query has something to sum ACROSS.
const GAME_ONE = 995101
const GAME_TWO = 995102

const query_context = { row_axes: [], nfl_week_ids: [] }

// A milestone: +20 when the player-game passing total reaches 300. Referenced
// off the per-game stage's alias, which is what the stage exists to expose.
const passing_milestone =
  'CASE WHEN role_union.pass_yds >= 300 THEN 20 ELSE 0 END'

const passing_role = {
  pid_column: 'passer_pid',
  measure_expr: 'COALESCE(pass_yds, 0) * 0.04',
  game_aggregates: { pass_yds: 'COALESCE(pass_yds, 0)' }
}

const rushing_role = {
  pid_column: 'ball_carrier_pid',
  measure_expr: 'COALESCE(rush_yds, 0) * 0.1',
  game_aggregates: { rush_yds: 'COALESCE(rush_yds, 0)' }
}

// Returns the knex builder rather than its rows: a spec that awaits it gets an
// array and `.toString()` on that is '[object Object]', which asserts nothing.
const build_cte = ({ role_attributions, game_conditional_expr, period }) =>
  build_period_cte({
    measure_source: 'plays_role_union',
    measure_expr: null,
    role_attributions,
    game_conditional_expr,
    period,
    query_context,
    identity_id: 'player',
    params: {}
  })

describe('role-union per-game grain stage', () => {
  before(async () => {
    await db('nfl_plays').whereIn('esbid', [GAME_ONE, GAME_TWO]).del()
    await db('nfl_games').whereIn('esbid', [GAME_ONE, GAME_TWO]).del()

    await db('nfl_games').insert([
      {
        esbid: GAME_ONE,
        season_year: 2024,
        week: 1,
        season_type: 'REG',
        away_nfl_team: 'NE',
        home_nfl_team: 'BUF'
      },
      {
        esbid: GAME_TWO,
        season_year: 2024,
        week: 2,
        season_type: 'REG',
        away_nfl_team: 'NE',
        home_nfl_team: 'MIA'
      }
    ])

    const play = (esbid, play_id, fields) => ({
      esbid,
      play_id,
      season_year: 2024,
      week: esbid === GAME_ONE ? 1 : 2,
      season_type: 'REG',
      updated: 0,
      play_type: 'PASS',
      ...fields
    })

    await db('nfl_plays').insert([
      // Game one: 350 passing yards over two plays -- clears 300 as a GAME
      // total, which no single play does.
      play(GAME_ONE, 1, { passer_pid: PASSER, pass_yds: 200 }),
      play(GAME_ONE, 2, { passer_pid: PASSER, pass_yds: 150 }),
      // Game two: 100 passing yards. Season total is 450, so a milestone
      // evaluated at season grain would fire here and must not.
      play(GAME_TWO, 1, { passer_pid: PASSER, pass_yds: 100 }),
      // A rusher in game one only, for the cross-role case.
      play(GAME_ONE, 3, {
        play_type: 'RUSH',
        ball_carrier_pid: RUSHER,
        rush_yds: 40
      })
    ])
  })

  after(async () => {
    await db('nfl_plays').whereIn('esbid', [GAME_ONE, GAME_TWO]).del()
    await db('nfl_games').whereIn('esbid', [GAME_ONE, GAME_TWO]).del()
  })

  it('emits no per-game stage when no role declares one', async () => {
    const sub = build_cte({
      role_attributions: [
        {
          pid_column: 'passer_pid',
          measure_expr: 'COALESCE(pass_yds, 0) * 0.04'
        }
      ],
      period: 'season'
    })
    const sql = sub.toString()

    // The stage carries the `role_plays` alias. Its absence is the assertion:
    // an unconditional stage would change SQL for every existing format.
    expect(sql).to.not.include('role_plays')
    expect(sql).to.include('SUM(role_union.pts) AS measure_total')
  })

  it('emits the stage and the conditional when a role declares an aggregate', async () => {
    const sub = build_cte({
      role_attributions: [passing_role],
      game_conditional_expr: passing_milestone,
      period: 'season'
    })
    const sql = sub.toString()

    expect(sql).to.include('role_plays')
    expect(sql).to.include('SUM(role_plays.pass_yds) AS pass_yds')
    // The conditional sits INSIDE the outer SUM, so it is summed once per
    // qualifying game rather than tested once against the period total.
    expect(sql).to.include(
      `SUM(role_union.pts + (${passing_milestone})) AS measure_total`
    )
  })

  it('fires a milestone per GAME and sums across games at season grain', async () => {
    const rows = await build_cte({
      role_attributions: [passing_role],
      game_conditional_expr: passing_milestone,
      period: 'season'
    })

    const row = rows.find((r) => r.pid === PASSER)
    expect(row, 'passer row present').to.exist

    // 450 passing yards at 0.04 = 18, plus ONE milestone for the 350-yard game.
    // The 450-yard SEASON total also clears 300; a milestone evaluated at the
    // outer grain would score 20 here too and the total would be identical, so
    // the discriminating half is the game-two assertion below.
    expect(Number(row.measure_total)).to.equal(38)
  })

  it('does not fire a milestone the season total clears but no game does', async () => {
    const rows = await build_cte({
      role_attributions: [passing_role],
      game_conditional_expr:
        'CASE WHEN role_union.pass_yds >= 400 THEN 20 ELSE 0 END',
      period: 'season'
    })

    const row = rows.find((r) => r.pid === PASSER)
    // 450 season yards clears 400; the best single game is 350 and does not.
    // A season-grain evaluation scores 18 + 20 = 38. The per-game stage scores
    // 18. This is the assertion the stage exists to make possible.
    expect(Number(row.measure_total)).to.equal(18)
  })

  it('carries a per-game aggregate across union arms', async () => {
    // rush_rec_yd is cross-role: rushing scores in the ball_carrier_pid arm and
    // receiving in the target_pid arm, so a combined threshold can only be
    // evaluated after the union. Each arm projects both aliases (0 for the one
    // it does not source), which is what makes the game-level sum whole.
    const sub = build_cte({
      role_attributions: [passing_role, rushing_role],
      game_conditional_expr:
        'CASE WHEN role_union.pass_yds + role_union.rush_yds >= 380 THEN 10 ELSE 0 END',
      period: 'season'
    })
    const sql = sub.toString()

    // Both arms project both aliases -- two occurrences of each literal 0 cast
    // would be brittle to assert, so pin the shape that matters: every alias is
    // summed once at the game stage.
    expect(sql).to.include('SUM(role_plays.pass_yds) AS pass_yds')
    expect(sql).to.include('SUM(role_plays.rush_yds) AS rush_yds')

    const rows = await sub
    const passer = rows.find((r) => r.pid === PASSER)
    const rusher = rows.find((r) => r.pid === RUSHER)

    // The passer's game one is 350 pass + 0 rush = 350, under 380. Game two is
    // 100. No bonus: 450 * 0.04 = 18.
    expect(Number(passer.measure_total)).to.equal(18)
    // The rusher has 40 rush yards and no passing: 4, no bonus.
    expect(Number(rusher.measure_total)).to.equal(4)
  })

  it('keeps the per-game stage transparent to a game-grain query', async () => {
    // At game grain the stage and the outer aggregate share a grain, so the
    // outer is a pure regroup and the linear total must be unchanged.
    const rows = await build_cte({
      role_attributions: [passing_role],
      game_conditional_expr: passing_milestone,
      period: 'game'
    })

    const by_period = Object.fromEntries(
      rows
        .filter((r) => r.pid === PASSER)
        .map((r) => [r.period_key, Number(r.measure_total)])
    )

    // Game one: 350 * 0.04 = 14, plus the 20 milestone.
    expect(by_period[`2024_1_${GAME_ONE}`]).to.equal(34)
    // Game two: 100 * 0.04 = 4, no milestone.
    expect(by_period[`2024_2_${GAME_TWO}`]).to.equal(4)
  })
})
