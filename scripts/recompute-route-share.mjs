/**
 * Recompute player_receiving_gamelogs.route_share
 *
 * Fills route_share for every row that carries routes but no share and whose
 * game has usable dropback data. Idempotent -- it only ever fills a null, so a
 * re-run after a clean run writes nothing.
 *
 * The derivation and the reason this pass has to exist at all live in
 * libs-server/route-share.mjs.
 *
 * Usage:
 *   node scripts/recompute-route-share.mjs --dry
 *   node scripts/recompute-route-share.mjs --year 2025
 *   node scripts/recompute-route-share.mjs --esbid 2025091400
 */

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { is_main, recompute_route_share } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv

const main = async () => {
  const esbids = argv.esbid ? [Number(argv.esbid)] : null
  const season_year = argv.year ? Number(argv.year) : null

  const result = await recompute_route_share({
    season_year,
    esbids,
    dry_run: Boolean(argv.dry)
  })

  // console rather than debug: this is the run's audit trail, and the ESM
  // import graph decides which debug namespaces survive.
  console.log(
    `candidates: ${result.candidates}, ${argv.dry ? 'would update' : 'updated'}: ${result.updated}, skipped (no dropback data): ${result.skipped_missing_dropbacks}, skipped (dropbacks below routes): ${result.skipped_invalid_dropbacks}`
  )
}

if (is_main(import.meta.url)) {
  main()
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
    .finally(async () => {
      await db.destroy()
    })
}

export default recompute_route_share
