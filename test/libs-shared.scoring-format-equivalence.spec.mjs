/* global describe it before */

// Format-equivalence gate for the kicking and DST configurability change.
//
// The claim the change rests on is "the backfill changes nothing": moving
// kicking and DST scoring out of hardcoded literals in calculate-points.mjs and
// into league_scoring_formats, at defaults equal to those literals, must leave
// every existing score exactly where it was. That claim was asserted in a plan
// and is checked here.
//
// test/fixtures/scoring-format-equivalence.json is a GOLDEN, not a second
// implementation. Its totals were produced by running the PRE-registry
// calculate-points.mjs (at 2238eee22, the commit production was serving) over
// all 65 production scoring format configs against the fixed stat-line corpus
// in test/fixtures/scoring-stat-line-corpus.mjs. Committing the numbers rather
// than a vendored copy of the old function keeps one implementation in the
// tree; the tradeoff is that the fixture can only be regenerated from history,
// which is stated in its `generated_from` field.
//
// The configs in the fixture are the real post-migration rows, so the backfill
// itself is part of what is under test: perturb a backfilled default in the
// database and regenerate, and these totals move.

import fs from 'fs/promises'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import * as chai from 'chai'

import { calculatePoints } from '#libs-shared'

const expect = chai.expect
const __dirname = dirname(fileURLToPath(import.meta.url))

// Tolerance absorbs IEEE-754 accumulation only (0.04 * 300 is
// 12.000000000000002). A real scoring change is at least a hundredth of a
// point, so this is orders of magnitude short of hiding one.
const EPSILON = 1e-6

describe('LIBS-SHARED scoring format equivalence', function () {
  let fixture
  let formats_by_id

  before(async function () {
    fixture = JSON.parse(
      await fs.readFile(
        path.resolve(__dirname, 'fixtures/scoring-format-equivalence.json'),
        'utf8'
      )
    )
    formats_by_id = new Map(
      fixture.scoring_formats.map((format) => [format.id, format])
    )
  })

  it('covers every production scoring format', () => {
    expect(fixture.scoring_formats).to.have.length(fixture.scoring_format_count)
    expect(fixture.cases).to.have.length(
      fixture.scoring_format_count * fixture.stat_line_count
    )
  })

  it('reproduces every pre-change total across all 65 formats', async () => {
    const { stat_lines } = await import(
      './fixtures/scoring-stat-line-corpus.mjs'
    )
    const stat_lines_by_name = new Map(
      stat_lines.map((line) => [line.name, line])
    )

    const divergences = []

    for (const expected of fixture.cases) {
      const league = formats_by_id.get(expected.scoring_format_id)
      const stat_line = stat_lines_by_name.get(expected.stat_line)

      const result = calculatePoints({
        league,
        position: expected.position,
        stats: stat_line.stats
      })

      if (Math.abs(result.total - expected.total) > EPSILON) {
        divergences.push(
          `${expected.scoring_format_id} / ${expected.stat_line}: expected ${expected.total}, got ${result.total}`
        )
      }
    }

    expect(
      divergences,
      `scores moved on ${divergences.length} of ${fixture.cases.length} cases:\n${divergences.slice(0, 20).join('\n')}`
    ).to.be.empty
  })

  // The one shape where the old and new implementations genuinely disagree,
  // asserted rather than omitted. The old band arm scored a bands-only line at
  // 3/3/3/4/5; the backfilled bands score it at zero, because production scores
  // per yard and the bands have never applied. Production holds no such row --
  // 2025 REG kickers: 453 gamelogs with band counts, all 453 with field goal
  // yards, zero with bands alone -- which is what makes the divergence safe.
  // If this test ever fails because the two now agree, the backfill has been
  // changed to the bands and every kicker's score has moved.
  it('scores a bands-only line at zero, the known intentional divergence', () => {
    const format = fixture.scoring_formats.find(
      (format) => format.id === fixture.cases[0].scoring_format_id
    )

    const result = calculatePoints({
      league: format,
      position: 'K',
      stats: {
        field_goals_made: 4,
        field_goals_made_0_19_yards: 1,
        field_goals_made_20_29_yards: 1,
        field_goals_made_30_39_yards: 1,
        field_goals_made_50_plus_yards: 1
      }
    })

    expect(result.total).to.equal(0)
  })
})
