/* global describe it */

import * as chai from 'chai'

import {
  classify_tool_call,
  derive_transcript_metrics,
  parse_transcript
} from '#libs-server/data-views/generation/benchmark-metrics.mjs'

const { expect } = chai

// A transcript fixture in the shape the harness actually writes.
//
// The load-bearing property is the FANOUT: one API call lands as several
// `type: "assistant"` records sharing one `message.id`, each carrying the same
// `usage` object. Every assertion about turns and tokens below exists to pin
// that counting records instead of ids inflates both, which is the measurement
// error that cost this lane a whole afternoon of wrong numbers.
const assistant_record = ({
  id,
  blocks,
  usage,
  model = 'deepseek-v4-flash'
}) => ({
  type: 'assistant',
  message: { id, model, content: blocks, usage }
})

const two_turn_transcript = [
  {
    type: 'user',
    message: { content: 'top 10 quarterbacks by passing yards' }
  },
  // Turn one arrives as THREE records for ONE call.
  assistant_record({
    id: 'chatcmpl-aaa',
    blocks: [{ type: 'thinking', thinking: 'which column' }],
    usage: { output_tokens: 100, input_tokens: 1000 }
  }),
  assistant_record({
    id: 'chatcmpl-aaa',
    blocks: [{ type: 'text', text: 'searching the catalog' }],
    usage: { output_tokens: 100, input_tokens: 1000 }
  }),
  assistant_record({
    id: 'chatcmpl-aaa',
    blocks: [
      {
        type: 'tool_use',
        name: 'Bash',
        input: {
          command: 'NODE_ENV=sandbox node scripts/data-view-search-columns.mjs'
        }
      }
    ],
    usage: { output_tokens: 100, input_tokens: 1000 }
  }),
  // Turn two: two records, one call, and a build call this time.
  assistant_record({
    id: 'chatcmpl-bbb',
    blocks: [{ type: 'thinking', thinking: 'emit it' }],
    usage: { output_tokens: 50, input_tokens: 2000 }
  }),
  assistant_record({
    id: 'chatcmpl-bbb',
    blocks: [
      {
        type: 'tool_use',
        name: 'Bash',
        input: { command: 'NODE_ENV=sandbox node scripts/data-view-emit.mjs' }
      }
    ],
    usage: { output_tokens: 50, input_tokens: 2000 }
  }),
  {
    type: 'cost-state',
    totalAPIDuration: 65972,
    totalToolDuration: 15075,
    totalDuration: 341483,
    modelUsage: {
      'deepseek-v4-flash': { outputTokens: 170, inputTokens: 3000 }
    }
  }
]

describe('data-view generation benchmark metrics', function () {
  describe('turn counting', function () {
    it('counts distinct message.id, not assistant records', function () {
      const metrics = derive_transcript_metrics(two_turn_transcript)
      // Five assistant records, two API calls. Reporting five here is the
      // documented failure this whole module exists to prevent.
      expect(metrics.assistant_records).to.equal(5)
      expect(metrics.turns).to.equal(2)
    })

    it('counts each turn usage once rather than once per record', function () {
      const metrics = derive_transcript_metrics(two_turn_transcript)
      // 100 + 50, NOT 100*3 + 50*2.
      expect(metrics.output_tokens).to.equal(150)
      expect(metrics.input_tokens).to.equal(3000)
    })

    it('agrees with the authoritative cost-state line within title overhead', function () {
      const metrics = derive_transcript_metrics(two_turn_transcript)
      expect(metrics.cost_state_output_tokens).to.equal(170)
      // Title generation is a real API call that never lands as an assistant
      // record, so a small positive gap is expected and is surfaced rather than
      // reconciled away.
      expect(metrics.output_token_gap).to.equal(20)
    })

    it('does not count an assistant message carrying no content block', function () {
      // Some providers emit empty assistant messages mid-turn. Counting them
      // inflates runs on that provider only, which reads as a real difference
      // between models.
      const with_empty = [
        ...two_turn_transcript,
        assistant_record({
          id: 'chatcmpl-empty',
          blocks: [],
          usage: { output_tokens: 999 }
        })
      ]
      const metrics = derive_transcript_metrics(with_empty)
      expect(metrics.turns).to.equal(2)
      expect(metrics.output_tokens).to.equal(150)
    })

    it('reports a missing cost-state as null rather than zero', function () {
      // The line is written at session END. A live session has none, and
      // reading that absence as zero records the run as free.
      const live = two_turn_transcript.filter(
        (record) => record.type !== 'cost-state'
      )
      const metrics = derive_transcript_metrics(live)
      expect(metrics.cost_state_present).to.equal(false)
      expect(metrics.cost_state_output_tokens).to.equal(null)
      expect(metrics.output_token_gap).to.equal(null)
    })
  })

  describe('tool call classification', function () {
    it('buckets the calls a healthy run is made of', function () {
      const metrics = derive_transcript_metrics(two_turn_transcript)
      expect(metrics.tool_call_count).to.equal(2)
      expect(metrics.buckets).to.deep.equal({
        'provided-tool': 1,
        build: 1
      })
    })

    it('separates build calls from other provided tools', function () {
      const build = (script) =>
        classify_tool_call({
          name: 'Bash',
          input: { command: `NODE_ENV=sandbox node scripts/${script}` }
        })
      expect(build('data-view-emit.mjs')).to.equal('build')
      expect(build('data-view-validate-table-state.mjs')).to.equal('build')
      expect(build('data-view-preview-view.mjs')).to.equal('build')
      expect(build('data-view-search-columns.mjs')).to.equal('provided-tool')
      expect(build('data-view-describe-column.mjs')).to.equal('provided-tool')
    })

    it('calls a read of the contract a contract read, and any other league read a source dive', function () {
      expect(
        classify_tool_call({
          name: 'Read',
          input: {
            file_path:
              'libs-server/data-views/generation/generate-data-view.mjs'
          }
        })
      ).to.equal('contract-read')
      expect(
        classify_tool_call({
          name: 'Read',
          input: { file_path: 'libs-shared/data-view-fields-index.mjs' }
        })
      ).to.equal('source-dive')
      expect(
        classify_tool_call({
          name: 'Grep',
          input: { pattern: 'year', path: 'libs-server' }
        })
      ).to.equal('source-dive')
      expect(
        classify_tool_call({
          name: 'Bash',
          input: { command: 'ls libs-shared' }
        })
      ).to.equal('source-dive')
    })

    it('flags a reach into the session transcript, which should never happen', function () {
      expect(
        classify_tool_call({
          name: 'Bash',
          input: { command: 'cat /home/node/.claude-local/projects/x.jsonl' }
        })
      ).to.equal('self-transcript')
    })
  })

  describe('the oracle that is distinct from status', function () {
    it('detects a provider that answered with an error instead of an answer', function () {
      // A disabled provider produces a run that looks fine: status completed, a
      // plausible turn count, no timeout. Without this the outage lands in the
      // results as a model result.
      const disabled = [
        assistant_record({
          id: 'chatcmpl-dead',
          blocks: [
            {
              type: 'text',
              text: 'Please run /login · API Error: 401 Model is disabled'
            }
          ],
          usage: { output_tokens: 12 }
        })
      ]
      const metrics = derive_transcript_metrics(disabled)
      expect(metrics.turns).to.equal(1)
      expect(metrics.provider_error).to.not.equal(null)
    })

    it('does not flag a healthy run', function () {
      // The negative control for the check above: a pattern that fires on
      // everything would report every run as a provider outage and look just as
      // confident.
      const metrics = derive_transcript_metrics(two_turn_transcript)
      expect(metrics.provider_error).to.equal(null)
    })
  })

  describe('transcript parsing', function () {
    it('keeps the good lines when the last one is truncated', function () {
      // Normal for a session still being written. Dropping the bad line is
      // right; dropping the transcript is not.
      const body = '{"type":"user"}\n{"type":"assistant"}\n{"type":"cost-st'
      expect(parse_transcript(body)).to.have.length(2)
    })
  })
})
