#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import is_main from '#libs-server/is-main.mjs'
import sweep_unreferenced_data_view_queries from '#libs-server/data-views/sweep-unreferenced-data-view-queries.mjs'

// Collect data_view_queries rows no saved view references.
//
// The table carries no owner column deliberately, so that nothing structural
// keys on user_id and opening generation to anonymous callers is a deleted
// admission check rather than a re-keyed table. The price is that an abandoned
// row has nobody to attribute it to and nothing that would ever remove it, so
// the sweep ships with the table rather than being retrofitted onto a live
// unbounded one.
//
// console rather than debug for every outcome line: this runs from cron, its log
// IS its audit trail, and debug namespace resolution is a negotiation with the
// whole import graph that an oracle's verdict must not depend on winning.

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .option('min-age-hours', { type: 'number', default: 24 })
    .option('dry-run', { type: 'boolean', default: false })
    .strict().argv

  const { collected, dry_run } = await sweep_unreferenced_data_view_queries({
    min_age_hours: argv['min-age-hours'],
    dry_run: argv['dry-run']
  })

  console.log(
    JSON.stringify({
      script: 'sweep-data-view-queries',
      dry_run,
      min_age_hours: argv['min-age-hours'],
      collected_count: collected.length,
      status: 'ok'
    })
  )
}

if (is_main(import.meta.url)) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(
        JSON.stringify({
          script: 'sweep-data-view-queries',
          error: error.message,
          status: 'failed'
        })
      )
      process.exit(1)
    })
}
