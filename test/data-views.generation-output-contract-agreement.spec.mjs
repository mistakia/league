/* global describe it */
import * as chai from 'chai'

import { resolve_generated_table_state } from '#libs-server/data-views/generation/resolve-generated-table-state.mjs'
import { SHAPE_PROMPT } from '#libs-server/data-views/generation/generate-data-view.mjs'
import { table_state_validator } from '#libs-server/validators.mjs'

const expect = chai.expect

// The `output` contract, as the two tools the generation agent uses report on
// it. `validate_table_state` resolves the state; `preview_view` resolves it and
// THEN runs it through the executor's schema. So the agent trusts two verdicts,
// and this file exists because they used to differ.
//
// THE DEFECT THIS PINS, IN THE SHAPE THE AGENT SAW IT. Sending
// `output: { aggregation: 'count', threshold: null }` produced:
//
//   - validate_table_state: ok, 0 errors
//   - preview_view:         "The 'columns[0]' field must be a string."
//
// Both halves are wrong and each one alone is survivable. Together they are not.
// The resolver skipped `output` outright, so it green-lit a state the executor
// would refuse. The executor's complaint then named the LAST branch of the
// `columns` union rather than the real failure (`outputCountRequiresThreshold`),
// because a fastest-validator union runs every branch and reports the last one's
// error -- so the message described the object/string SHAPE, which the request
// had right, and never mentioned `output` at all.
//
// An agent reading that is being told its request is the wrong type by a tool
// that just called the same request valid. The only coherent conclusion is that
// the contract it was handed is wrong, and that is what it acts on: one observed
// run spent 45 tool calls and 1.79M input tokens reading league source, 367
// seconds against a 30-second target.
//
// So the assertions below are about the MESSAGE and about AGREEMENT, not just
// about rejection. A run that rejects with an unactionable message reproduces
// the whole cost of the defect.

const generated_view = (output) => ({
  row_grain: ['player'],
  prefix_columns: ['player_name'],
  columns: [
    { column_id: 'player_games_played' },
    { column_id: 'player_pass_touchdowns_from_plays', params: { output } }
  ]
})

const resolver_admits = (table_state) =>
  resolve_generated_table_state({ table_state }).ok

const executor_schema_admits = (table_state) =>
  table_state_validator(table_state) === true

// Every combination of the three `output` fields the agent can emit, including
// the malformed spellings. Enumerated from the schema's own vocabulary rather
// than from the cases that were reported, because the defect was in the
// DISAGREEMENT between two checks and any member of the grid can carry it.
const output_grid = () => {
  const periods = [undefined, 'season', 'week', 'game']
  const aggregations = [undefined, 'count', 'rate', 'mean', 'median', null, 5]
  const thresholds = [
    undefined,
    null,
    { op: '>=', value: 5 },
    { op: '~', value: 5 },
    { op: '>=' },
    'x'
  ]

  const grid = []
  for (const period of periods) {
    for (const aggregation of aggregations) {
      for (const threshold of thresholds) {
        const output = {}
        if (period !== undefined) output.period = period
        if (aggregation !== undefined) output.aggregation = aggregation
        if (threshold !== undefined) output.threshold = threshold
        grid.push(output)
      }
    }
  }
  return grid
}

describe('data-views generation / output contract agreement', function () {
  describe('the reported error names the real problem', function () {
    const table_state = generated_view({
      period: 'season',
      aggregation: 'count',
      threshold: null
    })

    it('does not report the union branch the request was right not to use', function () {
      const errors = table_state_validator(table_state)
      expect(errors, 'the malformed output was admitted').to.not.equal(true)

      const messages = errors.map((error) => error.message).join('\n')
      expect(messages).to.not.match(/must be a string/)
      expect(errors.map((error) => error.type)).to.deep.equal([
        'outputCountRequiresThreshold'
      ])
    })

    it('resolves prose for the custom rule rather than the string "undefined"', function () {
      const [error] = table_state_validator(table_state)
      // The custom checker pushes only a `type`; without a registered message
      // this came back undefined, and get-data-view-results maps errors to
      // `error.message` -- so the caller received the word "undefined".
      expect(error.message).to.be.a('string')
      expect(error.message).to.match(/threshold/)
    })

    it('says WHICH column, by index', function () {
      const [error] = table_state_validator(table_state)
      // The union spelling provided the index and the replacement must not
      // silently drop it: a nine-column view reporting `columns[]` tells the
      // agent to inspect all nine.
      expect(error.field).to.equal('columns[1].params.output')
    })
  })

  describe('validate_table_state and the executor agree on output', function () {
    it('take the same verdict on every spelling in the grid', function () {
      const disagreements = output_grid()
        .map((output) => {
          const table_state = generated_view(output)
          const resolver = resolver_admits(structuredClone(table_state))
          const executor = executor_schema_admits(structuredClone(table_state))
          return resolver === executor
            ? null
            : { output, validate_table_state: resolver, preview_view: executor }
        })
        .filter(Boolean)

      expect(
        disagreements,
        `validate_table_state green-lit a state the executor refuses: ${JSON.stringify(disagreements)}`
      ).to.deep.equal([])
    })

    it('would report a disagreement if one existed', function () {
      // The negative control for the assertion above, which is a comparison of
      // two booleans and passes vacuously if both checks stop running. A
      // fabricated column id is the state the two are DESIGNED to disagree on --
      // the resolver rejects it by name and the executor's schema, which knows
      // no registry, does not.
      //
      // The `output` here has to be a VALID one, or the executor rejects the
      // state for that instead and the control reports a disagreement it did
      // not cause. `aggregation` is required whenever `output` is present.
      const table_state = generated_view({
        period: 'game',
        aggregation: 'rate'
      })
      table_state.columns[0].column_id = 'player_vibes_rating'

      expect(resolver_admits(structuredClone(table_state))).to.equal(false)
      expect(executor_schema_admits(structuredClone(table_state))).to.equal(
        true
      )
    })
  })

  describe('a well-formed output is still admitted by both', function () {
    const admitted = [
      {
        period: 'season',
        aggregation: 'count',
        threshold: { op: '>=', value: 5 }
      },
      { period: 'game', aggregation: 'rate' },
      { period: 'season', aggregation: 'mean' }
    ]

    for (const output of admitted) {
      it(`admits ${JSON.stringify(output)}`, function () {
        const table_state = generated_view(output)
        expect(resolver_admits(structuredClone(table_state))).to.equal(true)
        expect(executor_schema_admits(structuredClone(table_state))).to.equal(
          true
        )
      })
    }
  })

  describe("the contract's own worked example", function () {
    // The example is the shape the agent copies, so anything it models is
    // effectively a rule. It used to carry `"threshold": null` under
    // `aggregation: "rate"` -- legal there, because the count rule reads a falsy
    // threshold as absent, and so never flagged. But it taught "threshold is
    // always present, null when unused", and an agent generalising that onto
    // `count` -- what any counting stat asks for -- lands exactly on the state
    // that produced the misleading error.
    //
    // Parsed back out of the prompt text rather than imported as an object,
    // because what the agent reads is the rendered JSON, and an assertion
    // against the source object would pass while the prompt disagreed with it.
    const example = JSON.parse(
      SHAPE_PROMPT.slice(SHAPE_PROMPT.indexOf('{\n  "row_grain"'))
    )

    it('is admitted by both tools', function () {
      const resolver = resolve_generated_table_state({
        table_state: structuredClone(example)
      })
      expect(
        resolver.ok,
        `the worked example does not resolve: ${JSON.stringify(resolver.errors)}`
      ).to.equal(true)

      const executor = table_state_validator(structuredClone(example))
      expect(
        executor,
        `the worked example does not validate: ${JSON.stringify(executor)}`
      ).to.equal(true)
    })

    it('does not model a null threshold anywhere in the prompt', function () {
      expect(SHAPE_PROMPT).to.not.match(/"threshold":\s*null/)
    })
  })

  describe('the resolver names the failing field', function () {
    it('points at output itself for the count/threshold rule', function () {
      const { ok, errors } = resolve_generated_table_state({
        table_state: generated_view({
          period: 'season',
          aggregation: 'count',
          threshold: null
        })
      })
      expect(ok).to.equal(false)
      expect(errors.map((error) => error.path)).to.deep.equal([
        'columns[1].params.output'
      ])
    })

    it('points at the nested key for a bad enum value', function () {
      const { ok, errors } = resolve_generated_table_state({
        table_state: generated_view({
          period: 'season',
          aggregation: 'median'
        })
      })
      expect(ok).to.equal(false)
      expect(errors.map((error) => error.path)).to.deep.equal([
        'columns[1].params.output.aggregation'
      ])
    })
  })
})
