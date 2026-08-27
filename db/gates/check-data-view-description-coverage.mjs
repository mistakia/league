// Gate: the queryable data-view column registry and the prose description
// index agree about which columns exist.
//
// THE DEFECT CLASS. Two registries are maintained by hand, in different
// directories, by different edits:
//
//   libs-server/data-views-column-definitions/index.mjs  what the server will answer
//   libs-shared/data-view-fields-index.mjs               what each column MEANS, in prose
//
// Nothing has ever held them to each other. A column added to the first and
// not the second is queryable and undocumented; an entry left in the second
// after the first drops the column is prose describing something that cannot
// be selected. Both directions are silent today, and both are load-bearing for
// LLM-assisted view generation, whose entire prompt vocabulary is the pairing
// of the two.
//
// WHY THIS EXISTS ALONGSIDE THE DERIVED CATALOG.
// libs-server/data-views/generation/build-data-view-generation-catalog.mjs
// builds the model-facing catalog in process precisely so no committed artifact
// can rot against these registries. That makes catalog-vs-registry drift
// impossible -- and does nothing at all about the two registries disagreeing
// with EACH OTHER, which is what this gate is for. The catalog builder is the
// one that computes the disagreement (its `coverage` block); this gate is the
// verdict over it.
//
// THE VERDICT. Every disagreement must be one of:
//   - repaired, by adding the description or removing the stale entry,
//   - in the BASELINE, which records the debt this gate arrived to and holds
//     it from growing, or
//   - ADJUDICATED with a required prose reason, for a site that is deliberately
//     to stay as it is.
//
// The two records are not interchangeable and the file beside this one keeps
// them apart on purpose. A baseline entry is an admission with an expiry: it
// says "this was already broken when the gate landed", and clearing it is
// progress the gate then holds. An adjudication is a decision: this column is
// deliberately undescribed and always will be. Collapsing them into one list
// turns 140 pieces of tracked debt into 140 permanent exemptions, which is the
// allowlist this gate must not become.
//
// Both are self-cleaning in the same direction the jsdoc ratchet is: an entry
// that suppresses nothing is itself a finding. Repairing a column's
// description and leaving its baseline row behind would re-open exactly that
// much slack for a future regression to be reabsorbed into silently.
//
// CI: eligible. It reads two committed modules and one committed JSON file,
// needs no database, no base ref and no network, and answers in about a
// second. It CAN go red on a column a sibling adds -- that is the gate working.
//
// NODE_ENV: set by this file before the registries are imported, which is why
// the imports below are dynamic. `run_gate` in scripts/check-cluster-gates.mjs
// passes bare `process.env` for a `requires: 'none'` gate, and
// config/index.mjs throws `ENOENT config-undefined.json` without it. A static
// import would hoist above the assignment and take the throw.

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  NEGATIVE_CONTROL_MARKER,
  CONTROL_STAYED_GREEN_MARKER
} from './negative-control.mjs'

const gate_dir = path.dirname(fileURLToPath(import.meta.url))
const records_path = path.join(
  gate_dir,
  'data-view-description-coverage-adjudications.json'
)

const FINDING_CLASSES = ['undescribed', 'orphaned']

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * The records file, read through an injected reader.
 *
 * The reader is a parameter rather than a module-level import because that is
 * the only shape a control can drive: an ESM namespace object is frozen, so a
 * control that "replaces" `fs.readFile` on the imported namespace silently
 * changes nothing and then passes over the unmodified real file.
 *
 * @param {object} params
 * @param {(path: string, encoding: string) => Promise<string>} [params.read_file]
 * @param {string} [params.file_path]
 * @returns {Promise<{ baseline: object, adjudications: Array<object> }>}
 */
export const load_records = async ({
  read_file = fs.readFile,
  file_path = records_path
} = {}) => {
  const parsed = JSON.parse(await read_file(file_path, 'utf8'))
  return {
    baseline: parsed.baseline || {},
    adjudications: parsed.adjudications || []
  }
}

/**
 * The disagreement between the two registries, as the catalog builder computes
 * it. Imported dynamically so NODE_ENV is set first.
 *
 * @param {object} params
 * @param {string} [params.node_env]
 * @returns {Promise<object>}
 */
export const load_coverage = async ({ node_env = 'test' } = {}) => {
  process.env.NODE_ENV = process.env.NODE_ENV || node_env
  const { build_data_view_generation_catalog } =
    await import('#libs-server/data-views/generation/build-data-view-generation-catalog.mjs')
  return build_data_view_generation_catalog().coverage
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

const baseline_set = ({ baseline, finding_class }) =>
  new Set(
    finding_class === 'undescribed'
      ? baseline.undescribed_column_ids || []
      : baseline.orphaned_description_ids || []
  )

/**
 * Pure over its inputs, so every control below drives it with synthetic ones
 * rather than editing anything on disk.
 *
 * @param {object} params
 * @param {object} params.coverage - the catalog builder's coverage block
 * @param {object} params.records - baseline and adjudications
 * @returns {{ findings: string[], sites: object, counts: object }}
 */
export const evaluate = ({ coverage, records }) => {
  const findings = []

  const sites = {
    undescribed: new Set(coverage.undescribed_column_ids || []),
    orphaned: new Set(coverage.orphaned_description_ids || [])
  }

  const adjudicated = new Map()
  for (const entry of records.adjudications || []) {
    const site = entry && entry.site
    const finding_class = entry && entry.class

    if (!site || !FINDING_CLASSES.includes(finding_class)) {
      findings.push(
        `an adjudication is missing a site or carries an unknown class ` +
          `(${JSON.stringify(entry)}) -- class must be one of ${FINDING_CLASSES.join(', ')}`
      )
      continue
    }

    // The reason is the whole difference between an adjudication and a name
    // filter, so an entry without one is a finding rather than a silent
    // exemption.
    if (!entry.reason || !String(entry.reason).trim()) {
      findings.push(
        `the adjudication for ${finding_class} site '${site}' carries no reason -- ` +
          'a reason is required; a name filter is not an option'
      )
      continue
    }

    adjudicated.set(`${finding_class}:${site}`, entry)
  }

  const counts = {}

  for (const finding_class of FINDING_CLASSES) {
    const live = sites[finding_class]
    const baselined = baseline_set({
      baseline: records.baseline,
      finding_class
    })
    let new_debt = 0

    for (const site of live) {
      const key = `${finding_class}:${site}`
      const is_adjudicated = adjudicated.has(key)
      const is_baselined = baselined.has(site)

      // Recorded twice, the two records disagree about what the site IS --
      // tracked debt to clear, or a standing decision. Nothing downstream can
      // tell which, so neither may stand.
      if (is_adjudicated && is_baselined) {
        findings.push(
          `${finding_class} site '${site}' is BOTH baselined and adjudicated -- ` +
            'it is either debt to clear or a decision to keep, not both'
        )
        continue
      }

      if (is_adjudicated || is_baselined) continue

      new_debt += 1
      findings.push(
        finding_class === 'undescribed'
          ? `column '${site}' is queryable but has no entry in ` +
              'libs-shared/data-view-fields-index.mjs'
          : `libs-shared/data-view-fields-index.mjs describes '${site}', which is ` +
              'not a column any definition in the registry provides'
      )
    }

    // The downward half. Slack left in the record is slack a later regression
    // is reabsorbed into without a word.
    for (const site of baselined) {
      if (live.has(site)) continue
      findings.push(
        `the ${finding_class} baseline still lists '${site}', which is no longer a ` +
          'finding -- remove the entry so the gate holds the repair'
      )
    }

    for (const [key, entry] of adjudicated) {
      const [entry_class, site] = [
        key.slice(0, key.indexOf(':')),
        key.slice(key.indexOf(':') + 1)
      ]
      if (entry_class !== finding_class) continue
      if (live.has(site)) continue
      findings.push(
        `the adjudication for ${finding_class} site '${site}' suppresses nothing -- ` +
          `remove it. Recorded reason: ${entry.reason}`
      )
    }

    counts[finding_class] = {
      live: live.size,
      baselined: [...live].filter((site) => baselined.has(site)).length,
      adjudicated: [...live].filter((site) =>
        adjudicated.has(`${finding_class}:${site}`)
      ).length,
      new_debt
    }
  }

  return { findings, sites, counts }
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

const empty_records = { baseline: {}, adjudications: [] }

/**
 * The block, with each line's word derived from what the control DID rather
 * than from what it expected.
 *
 * `format_negative_controls` is not reached for because its vocabulary is
 * binary -- RED or STAYED GREEN -- and two of the controls here pass by
 * staying SILENT. Printing "RED as expected" over a control that correctly
 * reported nothing is the exact inversion the gates guide records
 * (check-stranded-vocabulary-literals printed `[FAIL] WENT RED` on a healthy
 * control). The header marker and the cannot-report marker are still the
 * declared ones, which is what the runner reads.
 *
 * @param {object} params
 * @param {Array<{ name: string, kind: string, passed: boolean }>} params.controls
 * @returns {string}
 */
const format_controls = ({ controls }) =>
  [
    NEGATIVE_CONTROL_MARKER,
    ...controls.map(({ name, kind, passed }) => {
      const verdict = !passed
        ? `${CONTROL_STAYED_GREEN_MARKER} (bad)`
        : kind === 'reports'
          ? 'RED as expected'
          : 'HELD SILENT as expected'
      return `  ${verdict}  ${name}`
    })
  ].join('\n')

/**
 * Always on. Three assert the gate REPORTS a disagreement, two assert it stays
 * SILENT on a registry pair that agrees -- a gate that fires on an agreeing
 * pair would be read as broken and then weakened, which costs the same as a
 * gate that cannot fire at all.
 *
 * Every control drives `evaluate` with a SYNTHETIC coverage block rather than
 * by editing the real registries, so none of them goes vacuous the day the
 * real debt is finally cleared -- which is exactly when this gate matters most.
 *
 * @returns {Array<{ name: string, kind: string, passed: boolean }>}
 */
export const run_controls = () => {
  const controls = []

  const clean = { undescribed_column_ids: [], orphaned_description_ids: [] }

  // 1. A column the registry answers and the index does not describe.
  const undescribed = evaluate({
    coverage: { ...clean, undescribed_column_ids: ['synthetic_column_id'] },
    records: empty_records
  })
  controls.push({
    name: "an undescribed column ('synthetic_column_id') is reported",
    kind: 'reports',
    passed: undescribed.findings.some(
      (finding) =>
        finding.includes('synthetic_column_id') &&
        finding.includes('no entry in')
    )
  })

  // 2. The other direction, which no reader thinks about and which is how a
  //    dropped column leaves prose behind.
  const orphaned = evaluate({
    coverage: { ...clean, orphaned_description_ids: ['synthetic_orphan_id'] },
    records: empty_records
  })
  controls.push({
    name: "an orphaned description ('synthetic_orphan_id') is reported",
    kind: 'reports',
    passed: orphaned.findings.some(
      (finding) =>
        finding.includes('synthetic_orphan_id') &&
        finding.includes('not a column')
    )
  })

  // 3. The record machinery in both directions: a baseline entry suppresses
  //    its site, and the same entry is reported the moment the site is
  //    repaired. Without the second half the baseline is an allowlist.
  const suppressed = evaluate({
    coverage: { ...clean, undescribed_column_ids: ['synthetic_column_id'] },
    records: {
      baseline: { undescribed_column_ids: ['synthetic_column_id'] },
      adjudications: []
    }
  })
  const stale = evaluate({
    coverage: clean,
    records: {
      baseline: { undescribed_column_ids: ['synthetic_column_id'] },
      adjudications: []
    }
  })
  controls.push({
    name: 'a baseline entry suppresses its site, and is reported once the site is repaired',
    kind: 'reports',
    passed:
      suppressed.findings.length === 0 &&
      stale.findings.some(
        (finding) =>
          finding.includes('synthetic_column_id') &&
          finding.includes('no longer a finding')
      )
  })

  // 4. An adjudication without a reason is the shape this file decays into,
  //    so it is checked rather than trusted to the author.
  const reasonless = evaluate({
    coverage: { ...clean, undescribed_column_ids: ['synthetic_column_id'] },
    records: {
      baseline: {},
      adjudications: [{ site: 'synthetic_column_id', class: 'undescribed' }]
    }
  })
  controls.push({
    name: 'an adjudication carrying no reason is reported rather than honoured',
    kind: 'reports',
    passed: reasonless.findings.some((finding) =>
      finding.includes('carries no reason')
    )
  })

  // 5. SILENCE. A registry pair that agrees produces nothing, even with an
  //    empty record file -- the decoy for a gate that "works" by counting
  //    entries and would fire on any pair whose totals differ.
  const agreeing = evaluate({ coverage: clean, records: empty_records })
  controls.push({
    name: 'an agreeing registry pair produces no finding',
    kind: 'silent',
    passed: agreeing.findings.length === 0
  })

  return controls
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const run = async () => {
  const coverage = await load_coverage({})
  const records = await load_records({})

  if (!coverage.column_count) {
    console.error(
      'TOOLING ERROR: the column registry produced no columns -- the gate read ' +
        'nothing and its verdict would mean nothing'
    )
    process.exit(2)
  }

  const result = evaluate({ coverage, records })

  console.log('data view description coverage')
  console.log(`  columns in the queryable registry    ${coverage.column_count}`)
  console.log(
    `  of those, carrying a description     ${coverage.described_column_count}`
  )
  for (const finding_class of FINDING_CLASSES) {
    const counts = result.counts[finding_class]
    console.log(
      `  ${finding_class.padEnd(35)}${counts.live}  (${counts.baselined} baselined, ${counts.adjudicated} adjudicated, ${counts.new_debt} unaccounted for)`
    )
  }
  console.log(
    '  NOT checked: whether a description is ACCURATE, only whether one exists'
  )

  // Routed to stderr so a future --json flag's payload can own stdout alone,
  // and so the block still reaches a terminal on every run. The cluster runner
  // reads stdout and stderr concatenated.
  const controls = run_controls()
  console.error(`\n${format_controls({ controls })}`)

  if (controls.some((control) => !control.passed)) {
    console.error(
      `\nA negative control reported ${CONTROL_STAYED_GREEN_MARKER}. Everything above ` +
        'proves nothing -- a green here would be indistinguishable from a gate ' +
        'that cannot read either registry.'
    )
    process.exit(2)
  }

  if (result.findings.length) {
    console.error(`\n${result.findings.length} finding(s):`)
    for (const finding of result.findings) console.error(`  ${finding}`)
    console.error(
      '\nRepair by writing the description in libs-shared/data-view-fields-index.mjs ' +
        'or removing the stale entry. Record a site that must stay as it is in ' +
        'db/gates/data-view-description-coverage-adjudications.json, under ' +
        '`adjudications` with a reason -- `baseline` is for the debt this gate ' +
        'arrived to and is not where new entries go.'
    )
    process.exit(1)
  }

  console.log(
    '\nGATE OK -- every registry disagreement is baselined, adjudicated, or gone'
  )
}

run().catch((error) => {
  console.error(error)
  process.exit(2)
})
