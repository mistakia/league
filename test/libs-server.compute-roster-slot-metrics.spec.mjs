/* global describe before after it */

import * as chai from 'chai'

import knex from '#db'
import league from '#db/fixtures/league.mjs'
import {
  active_roster_slots,
  starting_lineup_slots,
  roster_slot_types
} from '#constants'
import compute_roster_slot_metrics from '#libs-server/league-team-player-seasonlogs/compute-roster-slot-metrics.mjs'

// The 2026-08-18 pts conform renamed the four rostered/started points columns
// on league_team_player_seasonlogs and swept the insert payload, empty_metrics()
// and the sibling optimal-lens helper -- but not this one, which built its
// result keys as `pts_added_earned_${suffix}` / `pts_added_net_${suffix}`. The
// consumer went on reading `realized_points_added_*`, got undefined, and wrote
// the empty_metrics() null instead. Nothing threw: the payload still named real
// columns, so the insert succeeded with four columns silently NULL, and the
// generator's own shortfall oracle is a ROW COUNT, which does not move. The
// 04:30 cron landed it across all seven seasons -- 2941 rows, zero non-null.
//
// So this spec EXECUTES the helper against a seeded database and asserts on the
// keys it actually returns. A spec that inspected the payload object instead
// would have passed at the broken revision: that payload was well-formed
// JavaScript naming real columns, and only the round trip tells the two apart.
//
// The two lenses are seeded to DIFFERENT values on purpose. `started` reads the
// starting-lineup slots and `rostered` reads those plus BENCH, so a player who
// starts in week 1 and sits on the bench in week 2 gives each lens its own
// weeks count and its own sums -- and a transposition of the two suffixes,
// which is the natural failure of a word-boundary replace, fails here. A
// fixture holding both lenses at one value has no power to distinguish them no
// matter how many assertions it carries.

const { expect } = chai

const LID = 1
const YEAR = 2023
const TID = 1
const PID = 'ROST-SLOT-000001'

// Week 1 is started, week 2 is benched, so the lenses cannot agree on anything.
const WEEK_ONE_ESBID = 990000001
const WEEK_TWO_ESBID = 990000002
const WEEK_ONE_EARNED = 10.5
const WEEK_ONE_NET = 6.5
const WEEK_TWO_EARNED = 3.0
const WEEK_TWO_NET = -2.5

// rostered sees both weeks; started sees week one alone.
const ROSTERED_EARNED = WEEK_ONE_EARNED + WEEK_TWO_EARNED
const ROSTERED_NET = WEEK_ONE_NET + WEEK_TWO_NET

const ROW_KEY = `${TID}__${PID}`

describe('LIBS SERVER compute_roster_slot_metrics', function () {
  this.timeout(60 * 1000)

  let league_format_id

  before(async function () {
    await knex.seed.run()
    // The league fixture is what populates league_formats, which
    // league_format_player_gamelogs carries an FK to. It also resets the
    // league-scoped tables, rosters_players among them.
    await league(knex)
    const format_row = await knex('league_formats').select('id').first()
    league_format_id = format_row.id

    await knex('nfl_games')
      .whereIn('esbid', [WEEK_ONE_ESBID, WEEK_TWO_ESBID])
      .del()
    await knex('league_format_player_gamelogs').where({ pid: PID }).del()
    await knex('rosters_players').where({ lid: LID, season_year: YEAR }).del()

    await knex('nfl_games').insert([
      {
        esbid: WEEK_ONE_ESBID,
        season_year: YEAR,
        week: 1,
        season_type: 'REG',
        away_nfl_team: 'NE',
        home_nfl_team: 'KC'
      },
      {
        esbid: WEEK_TWO_ESBID,
        season_year: YEAR,
        week: 2,
        season_type: 'REG',
        away_nfl_team: 'KC',
        home_nfl_team: 'NE'
      }
    ])

    await knex('rosters_players').insert([
      {
        roster_id: 990000001,
        slot: roster_slot_types.QB,
        pid: PID,
        player_position: 'QB',
        tid: TID,
        lid: LID,
        week: 1,
        season_year: YEAR
      },
      {
        roster_id: 990000002,
        slot: roster_slot_types.BENCH,
        pid: PID,
        player_position: 'QB',
        tid: TID,
        lid: LID,
        week: 2,
        season_year: YEAR
      }
    ])

    await knex('league_format_player_gamelogs').insert([
      {
        pid: PID,
        esbid: WEEK_ONE_ESBID,
        league_format_id,
        points_added_earned: WEEK_ONE_EARNED,
        points_added_net: WEEK_ONE_NET
      },
      {
        pid: PID,
        esbid: WEEK_TWO_ESBID,
        league_format_id,
        points_added_earned: WEEK_TWO_EARNED,
        points_added_net: WEEK_TWO_NET
      }
    ])
  })

  after(async function () {
    await knex('league_format_player_gamelogs').where({ pid: PID }).del()
    await knex('rosters_players').where({ lid: LID, season_year: YEAR }).del()
    await knex('nfl_games')
      .whereIn('esbid', [WEEK_ONE_ESBID, WEEK_TWO_ESBID])
      .del()
  })

  it('returns the canonical rostered keys, and only those', async function () {
    const metrics = await compute_roster_slot_metrics({
      lid: LID,
      year: YEAR,
      league_format_id,
      slots: active_roster_slots,
      suffix: 'rostered'
    })

    const row = metrics.get(ROW_KEY)
    expect(row, `no metrics row for ${ROW_KEY}`).to.not.equal(undefined)
    // Sorted and exact: an extra key is as much a defect as a missing one,
    // because the consumer spreads this object into the insert payload.
    expect(Object.keys(row).sort()).to.deep.equal([
      'realized_points_added_net_rostered',
      'realized_points_added_positive_rostered',
      'weeks_rostered'
    ])
  })

  it('carries the rostered lens values, non-null and summed over both weeks', async function () {
    const metrics = await compute_roster_slot_metrics({
      lid: LID,
      year: YEAR,
      league_format_id,
      slots: active_roster_slots,
      suffix: 'rostered'
    })

    const row = metrics.get(ROW_KEY)
    // Key presence alone would pass over a map that returns nulls, which is
    // exactly the state the broken revision wrote to production.
    expect(row.realized_points_added_positive_rostered).to.not.equal(null)
    expect(row.realized_points_added_net_rostered).to.not.equal(null)

    expect(row.weeks_rostered).to.equal(2)
    expect(row.realized_points_added_positive_rostered).to.be.closeTo(
      ROSTERED_EARNED,
      0.001
    )
    expect(row.realized_points_added_net_rostered).to.be.closeTo(
      ROSTERED_NET,
      0.001
    )
  })

  it('returns the canonical started keys, and only those', async function () {
    const metrics = await compute_roster_slot_metrics({
      lid: LID,
      year: YEAR,
      league_format_id,
      slots: starting_lineup_slots,
      suffix: 'started'
    })

    const row = metrics.get(ROW_KEY)
    expect(row, `no metrics row for ${ROW_KEY}`).to.not.equal(undefined)
    expect(Object.keys(row).sort()).to.deep.equal([
      'realized_points_added_net_started',
      'realized_points_added_positive_started',
      'weeks_started'
    ])
  })

  it('carries the started lens values, distinct from the rostered lens', async function () {
    const metrics = await compute_roster_slot_metrics({
      lid: LID,
      year: YEAR,
      league_format_id,
      slots: starting_lineup_slots,
      suffix: 'started'
    })

    const row = metrics.get(ROW_KEY)
    expect(row.realized_points_added_positive_started).to.not.equal(null)
    expect(row.realized_points_added_net_started).to.not.equal(null)

    expect(row.weeks_started).to.equal(1)
    expect(row.realized_points_added_positive_started).to.be.closeTo(
      WEEK_ONE_EARNED,
      0.001
    )
    expect(row.realized_points_added_net_started).to.be.closeTo(
      WEEK_ONE_NET,
      0.001
    )

    // The discriminator: a suffix transposition would hand the started lens the
    // rostered sums. Asserting they DIFFER is what gives the fixture its power.
    expect(row.realized_points_added_positive_started).to.not.be.closeTo(
      ROSTERED_EARNED,
      0.001
    )
    expect(row.realized_points_added_net_started).to.not.be.closeTo(
      ROSTERED_NET,
      0.001
    )
  })

  it('throws on a suffix it has no key map for', async function () {
    let raised = null
    try {
      await compute_roster_slot_metrics({
        lid: LID,
        year: YEAR,
        league_format_id,
        slots: active_roster_slots,
        suffix: 'optimal'
      })
    } catch (err) {
      raised = err
    }

    // A silent fallthrough here is the whole defect class: an unmapped suffix
    // that returns a well-formed object under keys nobody reads writes nulls
    // rather than failing.
    expect(raised, 'an unknown suffix must not resolve silently').to.not.equal(
      null
    )
    expect(raised.message).to.include('unknown suffix')
  })
})
