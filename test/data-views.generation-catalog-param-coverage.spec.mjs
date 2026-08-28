/* global describe it */
import * as chai from 'chai'

import { build_data_view_generation_catalog } from '#libs-server/data-views/generation/build-data-view-generation-catalog.mjs'

const { expect } = chai

// The failure this guards was invisible for eight days because nobody counted.
//
// The generation catalog advertised param vocabulary on 56 of 597 columns and
// looked healthy: it had columns, it had descriptions, it had a shared param
// registry with 260 keys. What it did not have was any way to know that
// `time_type`, `nfl_week_id`, `output`, `market_type` and `source_id` -- five of
// the nine most-used params in real saved views -- appeared on no column at all.
// Measured param agreement was 0.009 against 0.303 for columns, and the cause
// was read as a modelling problem rather than as a catalog that could not see
// half its own vocabulary.
//
// So these are counts, not shapes. A structural assertion ("columns have
// param_keys") passes just as happily at 56 as at 413.

// Measured at 440 of 597: 56 from the server column definitions alone, 413 once
// the client field registry loads, 440 once `consumes_params_extra` is folded
// in. Set below the measurement so benign registry churn is not a red suite,
// and raised when the number rises -- never lowered to make a change pass.
const MINIMUM_COLUMNS_WITH_PARAM_KEYS = 430

// The keys real saved views reach for most, every one of which was invisible to
// the server before the client field registry became importable. Named
// individually because a single total can stay flat while the head of the
// distribution silently drops out.
const REQUIRED_PARAM_KEYS = [
  'time_type',
  'nfl_week_id',
  'single_nfl_week_id',
  'market_type',
  'source_id',
  'team_unit',
  'quarter',
  'output',
  'historical_range'
]

describe('data view generation catalog / param coverage', () => {
  const catalog = build_data_view_generation_catalog()

  const columns_carrying = (param_key) =>
    catalog.columns.filter((column) => column.param_keys?.includes(param_key))
      .length

  it('advertises param vocabulary on most of the registry', () => {
    // Ratchet. Raise the floor when the number rises; never lower it to make a
    // change pass, because the whole defect was the number quietly being small.
    expect(catalog.coverage.columns_with_param_keys).to.be.at.least(
      MINIMUM_COLUMNS_WITH_PARAM_KEYS,
      `columns advertising param keys regressed to ${catalog.coverage.columns_with_param_keys}; it was 56 before the client field registry became server-importable and 440 after`
    )
  })

  it('reaches the head of real param usage', () => {
    const unreachable = REQUIRED_PARAM_KEYS.filter(
      (param_key) => columns_carrying(param_key) === 0
    )

    expect(unreachable).to.deep.equal(
      [],
      `no column advertises these params, so nothing built on the catalog can produce them: ${unreachable.join(', ')}`
    )
  })

  it('reads the client field registry rather than the server half alone', () => {
    // The negative control for the test above. `time_type` is declared ONLY in
    // the client field registry, so if that registry ever stops loading, this
    // is the assertion that goes red -- and it fails for the right reason
    // rather than as a vague count drop.
    expect(columns_carrying('time_type')).to.be.at.least(
      100,
      'time_type is declared only client-side, so this dropping to zero means the client field registry stopped being importable'
    )
  })

  it('drops back to the server half alone without the client registry', () => {
    // The negative control, and the reason the assertions above are evidence
    // rather than decoration. Building the catalog with an empty client
    // contribution reproduces the exact pre-fix state, so the counts above are
    // shown to be measuring the client registry and not some property the
    // server registry had all along.
    const server_only = build_data_view_generation_catalog({
      column_params_from_client: {}
    })

    expect(server_only.coverage.columns_with_param_keys).to.be.below(
      MINIMUM_COLUMNS_WITH_PARAM_KEYS
    )
    expect(
      server_only.columns.filter((column) =>
        column.param_keys?.includes('time_type')
      )
    ).to.deep.equal([], 'time_type must be unreachable from the server half')
  })

  it('has every expected client module loading', () => {
    // The reader contains an import failure rather than throwing, because it
    // runs at API start behind a top-level await and an uncaught throw there
    // trades a partial catalog for no API at all. Containment without this
    // assertion would be a silent degrade, so the failure is surfaced here.
    expect(catalog.coverage.client_failed_modules).to.deep.equal(
      [],
      `client field modules failed to import: ${catalog.coverage.client_failed_modules
        .map(({ module, message }) => `${module} (${message})`)
        .join('; ')}`
    )
  })

  it('reports which client modules are still carved out', () => {
    // Not an equality assertion on the list: a module dropping its React import
    // and starting to contribute is a good change and must not fail the suite.
    // What must not happen is the carve-out silently swallowing the whole
    // registry.
    expect(catalog.coverage.client_carve_out_modules).to.be.an('array')
    expect(catalog.coverage.client_carve_out_modules.length).to.be.below(
      10,
      'too many client modules are being carved out -- the React detection is over-matching, as an earlier count of "31 of 33" did by matching react-table'
    )
  })
})
