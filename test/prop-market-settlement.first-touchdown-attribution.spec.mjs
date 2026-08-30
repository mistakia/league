/* global describe it */
import * as chai from 'chai'

import { NFLPlaysMarketHandler } from '#libs-server/prop-market-settlement/worker/market-data-handlers.mjs'
import {
  market_type_mappings,
  get_market_types_settled_without_selection_type
} from '#libs-server/prop-market-settlement/market-type-mappings.mjs'

const expect = chai.expect

// nfl_plays labels no player as the scorer, so the first-touchdown handler
// infers one from the shape of the play. The shape flags SURVIVE A TURNOVER --
// a rush fumbled and returned is still is_rushing_play, and ball_carrier_pid
// then holds the player who lost the ball rather than the defender who scored
// -- so the inference is guarded by touchdown_nfl_team, the only column that
// says which side scored.
//
// The two touchdown cases below are a discriminating PAIR: identical play
// shape, identical ball carrier, differing only in touchdown_nfl_team. Without
// the guard both credit the carrier and the pair cannot tell the fix from its
// absence.
const build_play = ({ touchdown_nfl_team }) => ({
  esbid: 'G1',
  quarter: 1,
  sequence: 1,
  offense_nfl_team: 'KC',
  touchdown_nfl_team,
  is_touchdown: true,
  is_rushing_play: true,
  is_passing_play: false,
  is_completion: false,
  ball_carrier_pid: 'CARRIER-KC'
})

const settle_first_touchdown = async (play, selection_pid = 'CARRIER-KC') => {
  const handler = new NFLPlaysMarketHandler([play])
  const [result] = await handler.batch_calculate([
    {
      esbid: 'G1',
      market_type: 'GAME_FIRST_TOUCHDOWN_SCORER',
      selection_pid,
      selection_type: 'YES',
      selection_metric_line: null,
      time_type: 'CLOSE',
      source_id: 'source-1',
      source_market_id: 'market-1',
      source_selection_id: 'selection-1'
    }
  ])
  return result
}

describe('prop market settlement first touchdown attribution', function () {
  it('credits the ball carrier on an offensive rushing touchdown', async function () {
    const result = await settle_first_touchdown(
      build_play({ touchdown_nfl_team: 'KC' })
    )

    expect(result.error).to.equal(null)
    expect(result.metric_value).to.equal(1)
    expect(result.selection_result).to.equal('WON')
  })

  it('fails the market when the defense returned the rush for the touchdown', async function () {
    // Same shape and same carrier as the case above -- only the scoring team
    // differs. Crediting CARRIER-KC here would settle the market against a
    // player who lost the ball rather than the defender who scored it.
    const result = await settle_first_touchdown(
      build_play({ touchdown_nfl_team: 'BUF' })
    )

    expect(result.metric_value).to.equal(null)
    expect(result.selection_result).to.equal(null)
    expect(result.error).to.match(/scored by the defense/)
  })

  it('fails the market when the play does not name the scoring team', async function () {
    // A null scoring team cannot be shown to be the offense, so crediting the
    // carrier would be a guess. Failing keeps it out of the graded set.
    const result = await settle_first_touchdown(
      build_play({ touchdown_nfl_team: null })
    )

    expect(result.selection_result).to.equal(null)
    expect(result.error).to.match(/does not name the scoring team/)
  })
})

// missing_only refetches every selection with a null selection_result, so a
// permanently ungradeable row is refetched and re-errored on every run and the
// error report grows without bound. The fetch drops those rows -- but the test
// is per MARKET TYPE, not per column: moneyline and the spreads grade from the
// selected team alone, so filtering on a null selection_type would strand
// settlements that are perfectly gradeable.
describe('prop market settlement selection type requirement', function () {
  it('exempts exactly the market types that grade without a selection type', function () {
    const exempt = get_market_types_settled_without_selection_type()

    expect(exempt).to.have.members([
      'GAME_MONEYLINE',
      'GAME_SPREAD',
      'GAME_ALT_SPREAD'
    ])
  })

  it('derives the exemption from the mapping rather than a hardcoded list', function () {
    // The list is only correct because these are the mappings whose grading
    // branch returns before reading selection_type. Anchor on that property so
    // a new pid-only market type is picked up, and an over/under one is not.
    for (const market_type of get_market_types_settled_without_selection_type()) {
      expect(market_type_mappings[market_type].calculation_type).to.be.oneOf([
        'winner_determination',
        'point_differential_vs_spread'
      ])
    }

    expect(market_type_mappings.GAME_TOTAL.calculation_type).to.equal(
      'total_points'
    )
    expect(get_market_types_settled_without_selection_type()).to.not.include(
      'GAME_TOTAL'
    )
  })
})

// An alt line market copies its base mapping's rules. It must be a COPY:
// mappings carry per-market-type flags, and an alias would make the two
// literally the same object.
describe('prop market settlement alt line mappings', function () {
  it('copies the base mapping instead of aliasing it', function () {
    expect(market_type_mappings.GAME_ALT_RUSHING_YARDS).to.not.equal(
      market_type_mappings.GAME_RUSHING_YARDS
    )
    expect(market_type_mappings.GAME_ALT_RUSHING_YARDS).to.deep.equal(
      market_type_mappings.GAME_RUSHING_YARDS
    )
  })

  it('does not carry a per-type flag across to the base mapping', function () {
    const alt = market_type_mappings.GAME_ALT_RECEIVING_YARDS
    const base = market_type_mappings.GAME_RECEIVING_YARDS

    alt.half_filter = 1
    expect(base.half_filter).to.equal(undefined)
    delete alt.half_filter
  })
})
