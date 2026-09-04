/* global describe it */
import * as chai from 'chai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const expect = chai.expect
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schema_path = path.join(__dirname, '..', 'db', 'schema.postgres.sql')

// Every betting-market data-view column joins `prop_markets_index` on
// (esbid, time_type) and then restricts `market_type`. Without market_type in
// the index that restriction is applied on the HEAP, once per column;
// db/adhoc/2026-09-04-prop-markets-index-esbid-time-type-market-type.sql carries
// the measurement and is canonical for it.
//
// Nothing else would report the loss of that index column. The query stays
// correct, every test stays green, and the only symptom is a slow_query signal
// weeks later. So this asserts the schema-level property rather than a
// wall-clock time, which would be flaky against a shared host and could not run
// in CI at all.
const REQUIRED_PREFIX = ['esbid', 'time_type', 'market_type']

const parse_indexes_on = (schema_text, table_name) => {
  const pattern = new RegExp(
    `CREATE (?:UNIQUE )?INDEX (\\w+) ON public\\.${table_name} USING btree \\(([^)]*)\\)`,
    'g'
  )
  const indexes = []
  let match
  while ((match = pattern.exec(schema_text)) !== null) {
    indexes.push({
      name: match[1],
      columns: match[2].split(',').map((column) => column.trim())
    })
  }
  return indexes
}

describe('betting-market join index', function () {
  const schema_text = fs.readFileSync(schema_path, 'utf8')
  const indexes = parse_indexes_on(schema_text, 'prop_markets_index')

  it('parses the indexes it is about to judge', function () {
    // The assertion below is a search for one index among many, so a parser that
    // silently matches nothing would report "index missing" and a parser that
    // matched everything would pass vacuously. Anchor on indexes that exist for
    // reasons unrelated to this fix before trusting either verdict.
    const names = indexes.map((index) => index.name)

    expect(names).to.include('idx_prop_markets_index_market_time_season_year')
    expect(names).to.include('idx_prop_markets_index_source_event_id')

    const source_event = indexes.find(
      (index) => index.name === 'idx_prop_markets_index_source_event_id'
    )
    expect(source_event.columns).to.eql(['source_event_id'])
  })

  it('indexes market_type alongside the esbid and time_type join keys', function () {
    const covering = indexes.filter((index) =>
      REQUIRED_PREFIX.every(
        (column, position) => index.columns[position] === column
      )
    )

    expect(
      covering.map((index) => index.name),
      `no index on prop_markets_index leads with (${REQUIRED_PREFIX.join(', ')}); ` +
        `every betting-market data-view column would filter market_type on the heap. ` +
        `Indexes present: ${indexes.map((index) => index.name).join(', ')}`
    ).to.have.length.greaterThan(0)
  })
})
