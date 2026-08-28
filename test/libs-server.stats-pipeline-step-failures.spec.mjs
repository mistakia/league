/* global describe it */

import * as chai from 'chai'

import { format_step_failures } from '#libs-server/stats-pipeline.mjs'

const expect = chai.expect

// The reason this function exists: `run_step` captured { step, error } for every
// failed step and finalize_game reported only a COUNT of them --
// `Finalized game <esbid> with 1 failures`. Everything needed to name the
// failing step was in memory at report time and was discarded, so identifying it
// required an SSH to the worker host and a grep of its log.
describe('LIBS-SERVER stats-pipeline format_step_failures', function () {
  it('returns an empty string when nothing failed', () => {
    expect(format_step_failures({ steps_failed: [], total_steps: 8 })).to.equal(
      ''
    )
  })

  it('tolerates an absent steps_failed rather than throwing at report time', () => {
    expect(
      format_step_failures({ steps_failed: undefined, total_steps: 8 })
    ).to.equal('')
  })

  it('names the failed step and carries its error message', () => {
    // The live shape: process_formats failing on every finalized game since the
    // format-id migration, reported for three months as a success.
    const reason = format_step_failures({
      steps_failed: [
        {
          step: 'process_formats',
          error: 'no scoring format found for id genesis'
        }
      ],
      total_steps: 8
    })

    expect(reason).to.equal(
      '1 of 8 steps failed [process_formats] -- ' +
        'process_formats: no scoring format found for id genesis'
    )
  })

  it('names every failed step when several fail', () => {
    const reason = format_step_failures({
      steps_failed: [
        { step: 'process_formats', error: 'format boom' },
        { step: 'generate_snaps', error: 'snaps boom' }
      ],
      total_steps: 8
    })

    expect(reason).to.equal(
      '2 of 8 steps failed [process_formats, generate_snaps] -- ' +
        'process_formats: format boom | generate_snaps: snaps boom'
    )
  })

  // THE FRONT-LOADING CONTRACT, and the reason the roster precedes the details.
  // The reason reaches a signal TITLE that is sliced to 200 characters
  // (extension/runs/lib/oracle.mjs title_for_failure). Ordered the other way, a
  // single verbose stack pushes every step name past the cut and the signal is
  // back to naming no step at all -- the exact defect this replaced.
  it('keeps every step name inside the 200 characters a signal title survives', () => {
    const noisy = 'x'.repeat(4000)
    const reason = format_step_failures({
      steps_failed: [
        { step: 'import_games', error: noisy },
        { step: 'process_plays', error: noisy },
        { step: 'generate_gamelogs', error: noisy },
        { step: 'process_formats', error: noisy },
        { step: 'generate_snaps', error: noisy },
        { step: 'process_markets', error: noisy },
        { step: 'update_settlement_status', error: noisy },
        { step: 'update_format_aggregates', error: noisy },
        { step: 'update_global_aggregates', error: noisy }
      ],
      total_steps: 9
    })

    const title_slice = reason.slice(0, 200)
    for (const step of [
      'import_games',
      'process_plays',
      'generate_gamelogs',
      'process_formats',
      'generate_snaps',
      'process_markets',
      'update_settlement_status',
      'update_format_aggregates',
      'update_global_aggregates'
    ]) {
      expect(
        title_slice,
        `step ${step} must survive the title slice`
      ).to.include(step)
    }
  })

  it('bounds the whole reason so a many-step failure cannot blow up the column', () => {
    const reason = format_step_failures({
      steps_failed: Array.from({ length: 9 }, (unused, index) => ({
        step: `step_${index}`,
        error: 'y'.repeat(10000)
      })),
      total_steps: 9
    })

    expect(reason.length).to.be.at.most(1200)
    expect(reason).to.match(/\.\.\.$/)
  })

  it('bounds each step message so one verbose error cannot crowd out the rest', () => {
    const reason = format_step_failures({
      steps_failed: [
        { step: 'process_formats', error: 'z'.repeat(10000) },
        { step: 'generate_snaps', error: 'the second message must survive' }
      ],
      total_steps: 8
    })

    expect(reason).to.include('the second message must survive')
  })

  it('renders a step that failed without a message rather than printing undefined', () => {
    const reason = format_step_failures({
      steps_failed: [{ step: 'process_formats', error: undefined }],
      total_steps: 8
    })

    expect(reason).to.include('process_formats: unknown error')
    expect(reason).to.not.include('undefined')
  })
})
