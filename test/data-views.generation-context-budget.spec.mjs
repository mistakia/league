/* global describe it */
import * as chai from 'chai'

import { describe_column } from '#libs-server/data-views/generation/describe-column.mjs'
import { search_columns } from '#libs-server/data-views/generation/search-columns.mjs'
import {
  get_data_view_generation_catalog,
  SCOPE_PARAMS
} from '#libs-server/data-views/generation/build-data-view-generation-catalog.mjs'
import {
  AGENT_INSTRUCTIONS,
  SHAPE_PROMPT
} from '#libs-server/data-views/generation/generate-data-view.mjs'

const { expect } = chai

// What a tool RETURNS is context the agent pays for on every subsequent turn,
// and a generation run is priced in turns rather than in tool calls. Two measured
// runs established the shape of the bill: tool execution was 22.5s and 11.8s out
// of 914s and 796s of wall clock -- under 3% -- while the model re-read a context
// that had grown to 42k and 109k tokens, at a 0% cache hit rate, on every turn.
//
// So these are not micro-optimisations. A tool that answers in 16k tokens instead
// of 1k does not cost 15k tokens once; it costs 15k tokens times every turn that
// follows it. This file is the ratchet on that, and the ceilings are set above
// the measured values with enough headroom to absorb a new param but not a new
// category of payload.

const bytes = (value) => JSON.stringify(value).length

describe('data view generation / context budget', () => {
  const catalog = get_data_view_generation_catalog()

  it('keeps describe_column bounded on the most parameterised columns', () => {
    // These are the columns an ordinary leaderboard reaches for, and they were
    // the worst offenders precisely because a plays-backed measure carries the
    // entire play-by-play filter registry. player_receiving_yards_from_plays
    // measured 63,791 bytes -- roughly 16k tokens -- before the configuration /
    // play-filter split and the enumeration summary.
    const worst = [...catalog.columns]
      .sort(
        (left, right) =>
          (right.play_filter_param_keys || []).length -
          (left.play_filter_param_keys || []).length
      )
      .slice(0, 20)

    for (const column of worst) {
      const size = bytes(describe_column({ column_id: column.column_id }))
      expect(size, `${column.column_id} describe_column bytes`).to.be.below(
        16000
      )
    }
  })

  it('summarizes an enumeration rather than listing all of it', () => {
    // nfl_week_id enumerates every week of every season -- 681 values, 13,566
    // bytes on a single param. The head fixes the spelling and the tail fixes
    // the range; value_count says how much was withheld.
    const described = describe_column({
      column_id: 'player_receiving_yards_from_plays'
    })
    const nfl_week_id = described.params.nfl_week_id

    expect(nfl_week_id.values_truncated).to.equal(true)
    expect(nfl_week_id.value_count).to.be.above(100)
    expect(nfl_week_id.values.length).to.be.at.most(12)
  })

  it('returns the play-by-play filter tail as names, not definitions', () => {
    const described = describe_column({
      column_id: 'player_receiving_yards_from_plays'
    })

    expect(described.play_filter_param_keys).to.be.an('array')
    expect(described.play_filter_param_keys.length).to.be.above(100)
    // Names only until asked for. The expanded block is absent entirely rather
    // than present and empty.
    expect(described.play_filters).to.equal(undefined)
  })

  it('expands a play filter only when it is asked for by name', () => {
    const described = describe_column({
      column_id: 'player_receiving_yards_from_plays',
      param_keys: ['down_number']
    })

    expect(described.play_filters).to.have.property('down_number')
    expect(described.play_filters.down_number.param_key).to.equal('down_number')
  })

  it('keeps a search result page bounded', () => {
    const size = bytes(
      search_columns({ query: 'receiving yards', grain: 'player', limit: 10 })
    )
    expect(size).to.be.below(8000)
  })
})

// The contract has to be self-sufficient, because the measured failure mode is
// an agent that disbelieves a tool and goes reading league source to settle the
// disagreement. Every assertion here is a claim the agent should never have to
// leave the tools to verify.
describe('data view generation / contract self-sufficiency', () => {
  const catalog = get_data_view_generation_catalog()

  it('advertises the scope params on every describe_column response', () => {
    // `year` is read by resolve_nfl_week_id_from_year_param before any column is
    // consulted, so it appears in no column's param_keys. SHAPE_PROMPT's example
    // uses it and the correct emission for the first real run used it, while
    // describe_column listed 246 params without it -- and both measured runs went
    // source-diving over exactly that contradiction.
    for (const column_id of [
      'player_receiving_yards_from_plays',
      'player_pass_yards_from_plays',
      'player_position'
    ]) {
      const described = describe_column({ column_id })
      expect(described.scope_params, column_id).to.have.property('year')
      expect(described.scope_params, column_id).to.have.property('seas_type')
    }
  })

  it('states the seas_type default that a run burned its budget confirming', () => {
    expect(SCOPE_PARAMS.seas_type.default_value).to.eql(['REG'])
    expect(catalog.scope_params.seas_type.default_value).to.eql(['REG'])
    // And says so in prose where the agent will actually read it.
    expect(AGENT_INSTRUCTIONS).to.include('seas_type')
    expect(AGENT_INSTRUCTIONS).to.match(/already means the regular season/i)
  })

  it('names every param its own worked example spells', () => {
    // The example is the most-copied thing in the prompt. A param it uses that
    // the tools do not acknowledge teaches the agent that the tools are
    // unreliable, which is the expensive lesson.
    // Parsed rather than pattern-matched: `output` is an object param, so a
    // regex over the params block reads its INNER keys (`period`, `aggregation`)
    // as though they were params in their own right.
    // Anchored on the example heading, not on the first brace: the prose above
    // it spells inline fragments like {"year": [2024]} that are not the example.
    const marker = 'A complete example:'
    const example_text = SHAPE_PROMPT.slice(SHAPE_PROMPT.indexOf(marker))
    const example = JSON.parse(
      example_text.slice(
        example_text.indexOf('{'),
        example_text.lastIndexOf('}') + 1
      )
    )

    const example_params = new Set()
    for (const clause of [
      ...(example.columns || []),
      ...(example.where || []),
      ...(example.sort || [])
    ]) {
      for (const param_key of Object.keys(clause.params || {})) {
        example_params.add(param_key)
      }
    }

    expect(example_params).to.not.be.empty
    for (const param_key of example_params) {
      const reachable =
        param_key in catalog.scope_params ||
        param_key in catalog.params ||
        // `output` is carried per column as supports_output rather than as a
        // shared param definition.
        param_key === 'output'
      expect(reachable, `SHAPE_PROMPT uses "${param_key}"`).to.equal(true)
    }
  })

  it('declares a grain for every column', () => {
    // Retrieval filters on it, so a column without one is invisible to a
    // grain-scoped search rather than merely unlabelled.
    const ungrained = catalog.columns.filter((column) => !column.grain)
    expect(
      ungrained.map((column) => column.column_id),
      'columns missing source.grain'
    ).to.eql([])
  })

  it('tells the agent it is on a clock', () => {
    expect(AGENT_INSTRUCTIONS).to.match(/deadline|fifteen minutes/i)
  })
})
