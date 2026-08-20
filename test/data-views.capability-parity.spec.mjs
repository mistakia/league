/* global describe it */

import * as chai from 'chai'

import { output_column_param } from '#libs-shared'
import player_stats from '#libs-server/data-views-column-definitions/player-stats-from-plays-column-definitions.mjs'
import team_stats from '#libs-server/data-views-column-definitions/team-stats-from-plays-column-definitions.mjs'
import defensive_stats from '#libs-server/data-views-column-definitions/defensive-player-stats-from-plays-column-definitions.mjs'

const expect = chai.expect

// Nothing checked the client's advertised aggregations against the server's,
// and they are two independent enumerations of the same thing: the server
// derives capability from the subject grain (`measure/capability.mjs`) while
// the client hand-picks period lists per field factory
// (`libs-shared/output-column-param.mjs`). A divergence is silent in the
// direction that matters most -- the client offers a control, the user sets it,
// and the server either ignores the param or answers a question it does not
// admit to serving.
//
// That had already happened. `player_deep_target`, `player_touch` and
// `player_opportunity` were on the client's list and off the server's for as
// long as both existed, while the registry registered all three for `rate`.
//
// The comparison is CLIENT ⊆ SERVER rather than equality, deliberately. The
// server may legitimately advertise a period no field factory exposes yet; the
// unsafe direction is a control the client offers and the server does not
// advertise.

const period_values = (param) => param.values.map(({ value }) => value)

const server_rate_periods = (def) =>
  def.supports_output?.periods_by_aggregation?.rate ??
  // `derive_measure` narrows the shape to { periods, aggregations }; the rate
  // periods are the advertised periods minus the partition-only ones, which is
  // every period the pooled family can be asked for.
  def.supports_output?.periods ??
  []

describe('data-views client/server capability parity', () => {
  // The defensive factory declares `supports_output` by hand rather than
  // deriving it -- it never calls `derive_measure` -- which makes it the most
  // likely of the three to drift from the client.
  const all = { ...player_stats, ...team_stats, ...defensive_stats }

  const cases = [
    {
      label: 'offensive player',
      param: output_column_param.offensive_player_output_param,
      column_id: 'player_receiving_yards_from_plays'
    },
    {
      label: 'defensive player',
      param: output_column_param.defensive_player_output_param,
      column_id: 'player_solo_tackles_from_plays'
    },
    {
      label: 'team',
      param: output_column_param.offensive_output_param,
      column_id: 'team_pass_yards_from_plays'
    }
  ]

  for (const { label, param, column_id } of cases) {
    it(`${label}: every period the client offers is one the server advertises`, () => {
      const def = all[column_id]
      expect(def, `${column_id} missing from the registry`).to.exist
      const server = server_rate_periods(def)
      expect(
        server.length,
        `${column_id} advertises no period`
      ).to.be.greaterThan(0)
      const unadvertised = period_values(param).filter(
        (period) => !server.includes(period)
      )
      expect(
        unadvertised,
        `${label} offers ${unadvertised.join(', ')} which ${column_id} does not advertise`
      ).to.have.length(0)
    })
  }

  // The per-period family is one list on the client for every field factory, so
  // it is checked once rather than per case.
  it('the client per-period lists match the partition vocabulary', () => {
    const def = all.player_receiving_yards_from_plays
    for (const options of [
      output_column_param.COUNT_PERIOD_OPTIONS,
      output_column_param.MEAN_PERIOD_OPTIONS
    ]) {
      for (const { value } of options) {
        expect(def.supports_output.periods, value).to.include(value)
      }
    }
    expect(def.supports_output.aggregations).to.include('count')
    expect(def.supports_output.aggregations).to.include('mean')
  })

  // Asserts the comparison has material to work with. Without it a client param
  // that stopped declaring `values` would make every case above pass over an
  // empty list -- the shape this whole file exists to prevent.
  it('the client actually offers periods to compare', () => {
    for (const { label, param } of cases) {
      expect(period_values(param).length, label).to.be.greaterThan(5)
    }
  })
})
