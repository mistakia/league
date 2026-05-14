#!/usr/bin/env node

import fs from 'fs/promises'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, get_data_view_results_query } from '#libs-server'

const parse_url_to_table_state = (full_url) => {
  const url_obj = new URL(full_url)
  const params = new URLSearchParams(url_obj.search)
  const table_state = {
    columns: [],
    prefix_columns: [],
    where: [],
    sort: [],
    splits: [],
    offset: 0,
    limit: 500
  }
  for (const param of [
    'columns',
    'prefix_columns',
    'where',
    'sort',
    'splits'
  ]) {
    if (params.has(param)) {
      try {
        table_state[param] = JSON.parse(params.get(param))
      } catch (e) {
        return null
      }
    }
  }
  if (params.has('offset'))
    table_state.offset = parseInt(params.get('offset'), 10) || 0
  if (params.has('limit'))
    table_state.limit = parseInt(params.get('limit'), 10) || 500
  return table_state
}

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .option('out', { type: 'string', demandOption: true })
    .option('limit', { type: 'number', default: 100 }).argv

  const rows = await db('urls')
    .select(db.raw("encode(url_hash, 'hex') as hash_hex"), 'url')
    .where('url', 'like', '%/data-views?%')
    .orderBy('created_at', 'desc')
    .limit(argv.limit)

  const results = []
  for (const row of rows) {
    const entry = { hash: row.hash_hex, url: row.url }
    try {
      const table_state = parse_url_to_table_state(row.url)
      if (!table_state || !table_state.columns?.length) {
        entry.error = 'no_columns_or_parse_failure'
      } else {
        const { query } = await get_data_view_results_query(table_state)
        entry.sql = query.toString()
      }
    } catch (e) {
      entry.error = e.message
    }
    results.push(entry)
    process.stderr.write(`.`)
  }
  process.stderr.write(`\n`)

  await fs.writeFile(argv.out, JSON.stringify(results, null, 2))
  console.log(`Wrote ${results.length} entries to ${argv.out}`)
  console.log(
    `  success: ${results.filter((r) => r.sql).length}, errors: ${results.filter((r) => r.error).length}`
  )
  await db.destroy()
}

if (is_main(import.meta.url)) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
