/* global describe it */
import * as chai from 'chai'

import { NFLPlaysMarketHandler } from '#libs-server/prop-market-settlement/worker/market-data-handlers.mjs'

const expect = chai.expect

// Team total-yards markets settle against the NFL's NET figure: rushing yards
// plus passing yards after sack losses. A sack carries its loss in
// yards_gained and nothing in rush_yards, receiving_yards or pass_yards, so a
// total summed from those three columns alone is gross and settles high by the
// game's sack yardage -- a mean 15.6 yards per team-game on a mean 337.9 gross.
//
// That the mappings carry net_of_sack_yards is not what these cases pin. Every
// assertion below is anchored on a GRADE that differs between gross and net, so
// a regression that drops the sack term fails them rather than passing on a
// metric nobody checks. The single-column and out-of-period cases are the other
// half of the pair: they hold plays with a sack in them and must stay gross, so
// a fix applied too broadly fails just as loudly as one not applied at all.
const KC_PLAYS = [
  {
    esbid: 'G1',
    quarter: 1,
    sequence: 1,
    offense_nfl_team: 'KC',
    ball_carrier_pid: 'A',
    rush_yards: 10,
    receiving_yards: null,
    pass_yards: null,
    is_sack: false,
    yards_gained: 10
  },
  {
    esbid: 'G1',
    quarter: 1,
    sequence: 2,
    offense_nfl_team: 'KC',
    target_pid: 'B',
    rush_yards: null,
    receiving_yards: 25,
    pass_yards: 25,
    is_sack: false,
    yards_gained: 25
  },
  // The sack sits in the third quarter so the first-quarter case can show the
  // period filter reaching the sack term and not just the yardage columns.
  {
    esbid: 'G1',
    quarter: 3,
    sequence: 3,
    offense_nfl_team: 'KC',
    passer_pid: 'C',
    rush_yards: null,
    receiving_yards: null,
    pass_yards: null,
    is_sack: true,
    yards_gained: -8
  },
  {
    esbid: 'G1',
    quarter: 3,
    sequence: 4,
    offense_nfl_team: 'BUF',
    ball_carrier_pid: 'D',
    rush_yards: 40,
    receiving_yards: null,
    pass_yards: null,
    is_sack: false,
    yards_gained: 40
  }
]

const settle = async ({
  market_type,
  selection_metric_line,
  plays = KC_PLAYS
}) => {
  const handler = new NFLPlaysMarketHandler(plays)
  const [result] = await handler.batch_calculate([
    {
      esbid: 'G1',
      market_type,
      selection_pid: 'KC',
      selection_type: 'OVER',
      selection_metric_line,
      time_type: 'CLOSE',
      source_id: 'source-1',
      source_market_id: 'market-1',
      source_selection_id: 'selection-1'
    }
  ])
  return result
}

describe('prop market settlement team net yards', function () {
  it('subtracts sack yardage from a team total-yards market', async function () {
    // Gross is 35 and net is 27, so a line of 30 falls BETWEEN them. Under the
    // gross sum this is WON; only the net sum grades it LOST.
    const result = await settle({
      market_type: 'GAME_TEAM_TOTAL_YARDS',
      selection_metric_line: 30
    })

    expect(result.error).to.equal(null)
    expect(result.metric_value).to.equal(27)
    expect(result.selection_result).to.equal('LOST')
  })

  it('subtracts sack yardage from the alternate total-yards market', async function () {
    const result = await settle({
      market_type: 'GAME_TEAM_ALT_TOTAL_YARDS',
      selection_metric_line: 30
    })

    expect(result.metric_value).to.equal(27)
    expect(result.selection_result).to.equal('LOST')
  })

  it('leaves a single-column team rushing market gross', async function () {
    // A sack is neither a rush nor a reception. Subtracting it from a rushing
    // total invents a loss the market never counted, so this must stay at 10
    // and grade WON against a line of 9.
    const result = await settle({
      market_type: 'GAME_TEAM_ALT_RUSHING_YARDS',
      selection_metric_line: 9
    })

    expect(result.metric_value).to.equal(10)
    expect(result.selection_result).to.equal('WON')
  })

  it('counts only sacks inside the market period', async function () {
    // The lone sack is in the third quarter, so a first-quarter total keeps the
    // full 35 and grades WON against a line of 30 -- the opposite grade to the
    // full-game case above on the same line and the same plays.
    const result = await settle({
      market_type: 'GAME_TEAM_FIRST_QUARTER_ALT_TOTAL_YARDS',
      selection_metric_line: 30
    })

    expect(result.metric_value).to.equal(35)
    expect(result.selection_result).to.equal('WON')
  })

  it('fails the market when a sack carries no yardage', async function () {
    // A missing yards_gained is a hole in the metric, not a zero-yard sack.
    // Settling past it understates the loss and grades high, which is the
    // defect the net path exists to remove, so it must error instead.
    const plays_with_hole = KC_PLAYS.map((play) =>
      play.is_sack ? { ...play, yards_gained: null } : play
    )

    const result = await settle({
      market_type: 'GAME_TEAM_TOTAL_YARDS',
      selection_metric_line: 30,
      plays: plays_with_hole
    })

    expect(result.selection_result).to.equal(null)
    expect(result.metric_value).to.equal(null)
    expect(result.error).to.match(/no yards_gained/)
  })
})
