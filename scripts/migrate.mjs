import debug from 'debug'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
// import config from '#config'
import {
  generate_league_format_hash,
  generate_scoring_format_hash
} from '#libs-shared'
import { isMain } from '#libs-server'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('migrate')
debug.enable('migrate,generate-league-format-hash,generate-scoring-format-hash')

const migrate = async () => {
  // get all tables with pid columns
  const seasons = await db('seasons')
    .join('leagues', 'leagues.uid', 'seasons.lid')
    .where('lid', 1)

  for (const season of seasons) {
    const { league_format_hash } = generate_league_format_hash(season)
    const { scoring_format_hash } = generate_scoring_format_hash(season)

    await db('seasons')
      .update({
        league_format_hash,
        scoring_format_hash
      })
      .where({
        lid: season.lid,
        year: season.year
      })
  }
}

async function main() {
  let error
  try {
    await migrate()
  } catch (err) {
    error = err
    log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.EXAMPLE,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default migrate
