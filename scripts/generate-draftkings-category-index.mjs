import debug from 'debug'
import fs from 'fs-extra'
import { fileURLToPath } from 'url'
import path, { dirname } from 'path'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
// import { constants } from '#libs-shared'
import { isMain } from '#libs-server'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('generate-draftkings-category-index')
debug.enable('generate-draftkings-category-index')

const generate_draftkings_category_index = async () => {
  // build index of draft king categories
  const draftkings_index = {}

  const limit = 10000
  let offset = 0
  let draftkings_markets = []

  while (offset === 0 || draftkings_markets.length === limit) {
    draftkings_markets = await db('prop_markets_index')
      .select('source_market_name')
      .where('source_id', 'DRAFTKINGS')
      .where('source_market_name', 'like', '%(categoryId:%')
      .limit(limit)
      .offset(offset)

    log(`fetched ${draftkings_markets.length} draftkings markets`)

    for (const draftkings_market of draftkings_markets) {
      const { source_market_name } = draftkings_market
      const category_id = Number(
        source_market_name.match(/categoryId: (\d+)/)[1]
      )
      const subcategory_id = Number(
        source_market_name.match(/subcategoryId: (\d+)/)[1]
      )

      if (!draftkings_index[category_id]) {
        draftkings_index[category_id] = {}
      }

      if (!draftkings_index[category_id][subcategory_id]) {
        draftkings_index[category_id][subcategory_id] =
          draftkings_market.source_market_name
      }
    }

    offset += limit

    log(`offset: ${offset}`)
  }

  // sort by category id
  for (const category_id in draftkings_index) {
    draftkings_index[category_id] = Object.fromEntries(
      Object.entries(draftkings_index[category_id]).sort()
    )
  }

  const __dirname = dirname(fileURLToPath(import.meta.url))
  const filepath = path.join(__dirname, '../tmp/draftkings-index.json')
  log(`writing ${filepath}`)

  await fs.writeJson(filepath, draftkings_index, { spaces: 2 })
}

const main = async () => {
  let error
  try {
    await generate_draftkings_category_index()
  } catch (err) {
    error = err
    log(error)
  }

  // await db('jobs').insert({
  //   type: constants.jobs.EXAMPLE,
  //   succ: error ? 0 : 1,
  //   reason: error ? error.message : null,
  //   timestamp: Math.round(Date.now() / 1000)
  // })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default generate_draftkings_category_index
