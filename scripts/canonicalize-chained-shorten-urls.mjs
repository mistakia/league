import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main } from '#libs-server'
import { get_blake2b_hash } from '#libs-shared'
import resolve_short_url_chain from '#libs-shared/resolve-short-url-chain.mjs'

const log = debug('canonicalize-chained-shorten-urls')
debug.enable('canonicalize-chained-shorten-urls')

const argv = yargs(hideBin(process.argv))
  .option('dry-run', {
    description: 'Preview changes without writing to the DB',
    type: 'boolean',
    default: false
  })
  .option('limit', {
    description: 'Maximum rows to process (0 = no limit)',
    type: 'number',
    default: 0
  })
  .help().argv

const get_url_hash = (url) => get_blake2b_hash(url, 16)

const main = async () => {
  const dry_run = argv['dry-run']
  const limit = argv.limit

  let query = db('urls')
    .select('url', 'url_hash')
    .where('url', '~*', '^https?://[^/]+/u/[^?#/]+')
    .orderBy('created_at', 'asc')
  if (limit > 0) {
    query = query.limit(limit)
  }

  const rows = await query
  log(
    `found ${rows.length} chained shorten-url rows${dry_run ? ' (dry-run)' : ''}`
  )

  let updated = 0
  let skipped_unchanged = 0
  let skipped_conflict = 0
  let skipped_unresolvable = 0

  for (const row of rows) {
    const original_url = row.url
    const original_hash = row.url_hash.toString('utf8')

    let canonical_url
    try {
      const canonical_url_object = await resolve_short_url_chain({
        initial_url: original_url,
        fetch_url_by_hash: async (inner_hash) => {
          const inner_row = await db('urls')
            .where('url_hash', inner_hash)
            .first()
          if (!inner_row) {
            throw new Error('inner_hash_not_found')
          }
          return inner_row.url
        }
      })
      canonical_url = canonical_url_object.toString()
    } catch (error) {
      log(`skip ${original_hash}: ${error.message}`)
      skipped_unresolvable++
      continue
    }

    if (canonical_url === original_url) {
      skipped_unchanged++
      continue
    }

    // Verify the canonical URL hashes to a value that wouldn't replace another
    // existing row's identity. We keep original_hash so existing /u/<hash>
    // links continue to resolve; the canonical URL just gets stored against it.
    const canonical_url_hash = get_url_hash(canonical_url)
    log(
      `${original_hash} (${original_url.length}b) -> canonical (${canonical_url.length}b, would-hash ${canonical_url_hash})`
    )

    if (dry_run) {
      updated++
      continue
    }

    try {
      const affected = await db('urls')
        .where('url_hash', original_hash)
        .update({ url: canonical_url })
      if (affected === 1) {
        updated++
      } else {
        log(`unexpected affected count for ${original_hash}: ${affected}`)
        skipped_unchanged++
      }
    } catch (error) {
      // urls.url has a UNIQUE constraint; if the canonical URL is already
      // stored for some other hash, leave the chained row alone (the recursive
      // resolver still handles it correctly).
      if (error.code === '23505') {
        log(
          `skip ${original_hash}: canonical URL already exists for another row`
        )
        skipped_conflict++
        continue
      }
      throw error
    }
  }

  log(
    `done: updated=${updated} skipped_unchanged=${skipped_unchanged} skipped_conflict=${skipped_conflict} skipped_unresolvable=${skipped_unresolvable}`
  )
}

if (is_main(import.meta.url)) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('canonicalize-chained-shorten-urls failed:', error)
      process.exit(1)
    })
}

export default main
