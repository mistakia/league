/* global describe it */

import * as chai from 'chai'

import {
  classify_tool_call,
  derive_transcript_metrics,
  parse_transcript,
  row_identity
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

    it('separates wrestling with its own scratch file from diving into league source', function () {
      // This distinction decides where the next iteration looks. Six of ten
      // calls on a real run were the agent re-reading and byte-slicing the
      // emission JSON it had just written, to get it past a shell quoting
      // problem. Bucketing those as source dives would point the next iteration
      // at the retrieval tools, which were not the problem.
      expect(
        classify_tool_call({
          name: 'Bash',
          input: { command: 'cat /tmp/emission.json | fold -w 120' }
        })
      ).to.equal('scratch-io')
      expect(
        classify_tool_call({
          name: 'Bash',
          input: { command: 'wc -c /tmp/emission.json' }
        })
      ).to.equal('scratch-io')
      // The control: a read of real league source must still be a source dive,
      // or the pattern above has simply swallowed the class it was meant to
      // split.
      expect(
        classify_tool_call({
          name: 'Bash',
          input: { command: 'ls scripts/' }
        })
      ).to.equal('source-dive')
    })

    it('names a file write as its own class rather than "other"', function () {
      // The generation profile is designed without a Write tool, so a write
      // appearing at all is a containment finding rather than a cost one. It
      // cannot be read as such while it is pooled with everything unclassified.
      expect(
        classify_tool_call({
          name: 'Write',
          input: { file_path: 'scripts/tmp-emission.json', content: '{}' }
        })
      ).to.equal('scratch-io')
      expect(
        classify_tool_call({
          name: 'Write',
          input: { file_path: 'libs-server/somewhere.mjs', content: '{}' }
        })
      ).to.equal('file-write')
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

    it('flags a run whose every turn is SYNTHETIC, carrying no error text', function () {
      // The real shape of the 2026-09-03 cold-start failure, and the reason the
      // text patterns are not sufficient. The provider had just come back from a
      // pause; the transcript held one turn, zero output tokens, and NO error
      // text to match, stamped `<synthetic>` because the harness rather than the
      // model produced it. The run reported `expired` after a full fifteen
      // minutes, so without this the row reads as an agent that failed to finish
      // rather than a backend that never answered.
      const cold = [
        { type: 'user', message: { content: 'top 10 quarterbacks' } },
        assistant_record({
          id: 'synthetic-1',
          model: '<synthetic>',
          blocks: [{ type: 'text', text: '' }],
          usage: { output_tokens: 0, input_tokens: 0 }
        })
      ]
      const metrics = derive_transcript_metrics(cold)
      expect(metrics.turns).to.equal(1)
      expect(metrics.output_tokens).to.equal(0)
      expect(metrics.provider_error).to.not.equal(null)
      expect(metrics.provider_error).to.include('synthetic')
      // The synthetic name must not be reported as a model the run used, or a
      // reader comparing models across rows sees a provider that does not exist.
      expect(metrics.models).to.eql([])
    })

    it('does NOT flag a run that merely contains a synthetic turn', function () {
      // The discriminating control. An interrupt or a deadline notice can land
      // as one synthetic record inside a run the model otherwise answered
      // normally, and calling that an outage would discard real measurements.
      const mixed = [
        ...two_turn_transcript,
        assistant_record({
          id: 'synthetic-tail',
          model: '<synthetic>',
          blocks: [{ type: 'text', text: 'Interrupted by user' }],
          usage: { output_tokens: 0 }
        })
      ]
      const metrics = derive_transcript_metrics(mixed)
      expect(metrics.provider_error).to.equal(null)
      expect(metrics.models).to.eql(['deepseek-v4-flash'])
    })

    it('reports an EMPTY transcript as empty rather than as an outage', function () {
      // Guards the gate itself. Keying only on "no real model" would call a
      // transcript with no turns at all a provider failure, which is a
      // confident answer to a question the file has no evidence about.
      const metrics = derive_transcript_metrics([
        { type: 'user', message: { content: 'top 10 quarterbacks' } }
      ])
      expect(metrics.turns).to.equal(0)
      expect(metrics.provider_error).to.equal(null)
    })
  })

  describe('row identity resolution', function () {
    // Every one of these keys was taken off a REAL result row. The first
    // version of this list was guessed and named five plausible things, none of
    // which was `team_code` -- so every team assertion failed with "no team in
    // row", which is the same shape as a genuinely wrong answer and would have
    // been read as one.
    it('finds a player identity', function () {
      expect(row_identity({ pid: 'TUAX-TAGO-005436' }, 'pid')).to.equal(
        'TUAX-TAGO-005436'
      )
    })

    it('finds a team identity under the name results actually use', function () {
      expect(row_identity({ team_code: 'CIN' }, 'team')).to.equal('CIN')
    })

    it('tolerates the positional suffix the serializer appends', function () {
      expect(
        row_identity(
          { team_code_0: 'DET', team_name_0: 'Detroit Lions' },
          'team'
        )
      ).to.equal('DET')
    })

    it('returns null when the row has no identity of that grain', function () {
      // The control. A player-grain row answering a team question must NOT
      // resolve to something -- that is how the benchmark catches a view built
      // at the wrong grain, which production returns without any error.
      expect(
        row_identity({ pid: 'X', team_pass_yds_from_plays_0: 4918 }, 'team')
      ).to.equal(null)
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
