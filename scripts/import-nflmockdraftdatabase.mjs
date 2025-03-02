import debug from 'debug'
import fetch from 'node-fetch'
import * as cheerio from 'cheerio'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#libs-shared'
import { is_main, find_player_row, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const argv = yargs(hideBin(process.argv))
  .option('year', {
    type: 'number',
    description: 'Draft year to import',
    default: constants.season.year
  })
  .option('dry', {
    type: 'boolean',
    description: 'Dry run',
    default: false
  }).argv

const log = debug('import:nflmockdraftdatabase')
debug.enable('import:nflmockdraftdatabase,get-player')

const timestamp = Math.round(Date.now() / 1000)

// Mock draft types
const MOCK_TYPES = {
  BIG_BOARD: 'BIG_BOARD',
  MOCK_DRAFT: 'MOCK_DRAFT'
}

// Source IDs
const SOURCE_IDS = {
  CONSENSUS: 'NFLMOCKDRAFTDATABASE_CONSENSUS'
}

/**
 * Fetches HTML content from a URL
 * @param {Object} params
 * @param {string} params.url - The URL to fetch
 * @returns {Promise<string>} - The HTML content
 */
const fetch_html = async ({ url }) => {
  log(`Fetching ${url}`)
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${response.status} ${response.statusText}`
    )
  }

  return await response.text()
}

/**
 * Parses player data from a big board list item
 * @param {Object} params
 * @param {Object} params.$ - Cheerio instance
 * @param {Object} params.row - Cheerio row element
 * @returns {Object} - Parsed player data
 */
const parse_big_board_player = ({ $, row }) => {
  const $row = $(row)

  // Extract overall rank from the pick number
  const overall_rank = parseInt(
    $row.find('.pick-number').first().text().trim(),
    10
  )

  // Extract player name
  const name = $row.find('.player-name').text().trim()

  // Extract position and school
  const player_details = $row.find('.player-details').text().trim()
  const position_school_match = player_details.match(
    /^([A-Z]+)\s*\|\s*(.+?)(?:\s*$|<)/
  )

  const position = position_school_match ? position_school_match[1].trim() : ''
  const school = position_school_match ? position_school_match[2].trim() : ''

  // Position rank is not directly available in this HTML structure
  // We could potentially extract it from other elements if needed
  const position_rank = null

  // Extract peak rank if available
  const peak_text = $row.find('.peak span').text().trim()
  const peak_rank = peak_text ? parseInt(peak_text, 10) : null

  // Extract projected team and pick if available
  const projected_team =
    $row.find('.projection-container img').attr('alt')?.replace(' Logo', '') ||
    null
  const projected_pick =
    $row.find('.projection-text span:last-child').text().trim() || null

  return {
    name,
    position,
    overall_rank,
    position_rank,
    school,
    peak_rank,
    projected_team,
    projected_pick
  }
}

/**
 * Parses player data from a mock draft row
 * @param {Object} params
 * @param {Object} params.$ - Cheerio instance
 * @param {Object} params.row - Cheerio row element
 * @returns {Object} - Parsed player data
 */
const parse_mock_draft_player = ({ $, row }) => {
  const $row = $(row)
  const $cells = $row.find('td')

  const overall_rank = parseInt($cells.eq(0).text().trim(), 10)
  const team = $cells.eq(1).text().trim()
  const name = $cells.eq(2).text().trim()
  const position = $cells.eq(3).text().trim()
  const school = $cells.eq(4).text().trim()

  return {
    name,
    position,
    overall_rank,
    team,
    school
  }
}

/**
 * Fetches and parses the consensus big board
 * @returns {Promise<Array>} - Array of player data
 */
const fetch_consensus_big_board = async ({ year = constants.season.year }) => {
  const url = `https://www.nflmockdraftdatabase.com/big-boards/${year}/consensus-big-board-${year}`
  const html = await fetch_html({ url })
  const $ = cheerio.load(html)

  const players = []

  // Find the big board table and parse each row
  $('ul.mock-list li.mock-list-item').each((i, row) => {
    try {
      const player = parse_big_board_player({ $, row })
      players.push(player)
    } catch (error) {
      log(`Error parsing row: ${error.message}`)
    }
  })

  log(`Parsed ${players.length} players from consensus big board`)
  return players
}

/**
 * Fetches and parses a specific big board by source
 * @param {Object} params
 * @param {string} params.source_url - The URL of the source big board
 * @param {string} params.source_id - The source ID
 * @returns {Promise<Array>} - Array of player data
 */
const fetch_source_big_board = async ({ source_url, source_id }) => {
  const html = await fetch_html({ url: source_url })
  const $ = cheerio.load(html)

  const players = []

  // Find the big board table and parse each row
  $('ul.mock-list li.mock-list-item').each((i, row) => {
    try {
      const player = parse_big_board_player({ $, row })
      players.push(player)
    } catch (error) {
      log(`Error parsing row: ${error.message}`)
    }
  })

  log(`Parsed ${players.length} players from ${source_id} big board`)
  return players
}

/**
 * Fetches and parses the consensus mock draft
 * @returns {Promise<Array>} - Array of player data
 */
const fetch_consensus_mock_draft = async ({ year = constants.season.year }) => {
  const url = `https://www.nflmockdraftdatabase.com/mock-drafts/${year}/consensus-mock-draft-${year}`
  const html = await fetch_html({ url })
  const $ = cheerio.load(html)

  const players = []

  // Find the mock draft table and parse each row
  $('ul.mock-list li.mock-list-item').each((i, row) => {
    try {
      const player = parse_mock_draft_player({ $, row })
      players.push(player)
    } catch (error) {
      log(`Error parsing row: ${error.message}`)
    }
  })

  log(`Parsed ${players.length} players from consensus mock draft`)
  return players
}

/**
 * Fetches all available big board sources
 * @returns {Promise<Array>} - Array of source objects with id and url
 */
const fetch_big_board_sources = async ({ year = constants.season.year }) => {
  const url = `https://www.nflmockdraftdatabase.com/big-boards/${year}`
  const html = await fetch_html({ url })
  const $ = cheerio.load(html)

  const sources = []

  // Find all big board links
  $('div.row div.col-md-6 a').each((i, link) => {
    const $link = $(link)
    const href = $link.attr('href')
    const text = $link.text().trim()

    // Skip consensus big board as we handle it separately
    if (href.includes('consensus-big-board')) {
      return
    }

    // Extract source name from text or URL
    let source_id = text.toUpperCase().replace(/[^A-Z0-9]/g, '_')

    // Add to sources list
    sources.push({
      id: source_id,
      url: href.startsWith('http')
        ? href
        : `https://www.nflmockdraftdatabase.com${href}`
    })
  })

  log(`Found ${sources.length} big board sources`)
  return sources
}

/**
 * Saves player data to the database
 * @param {Object} params
 * @param {Array} params.players - Array of player data
 * @param {string} params.source_id - The source ID
 * @param {string} params.mock_type - The mock type (BIG_BOARD or MOCK_DRAFT)
 */
const save_to_database = async ({ year, players, source_id, mock_type }) => {
  const missing = []
  const inserts = []

  for (const player of players) {
    let player_row

    // Try finding player by name only first
    try {
      player_row = await find_player_row({
        name: player.name,
        start: year
      })
    } catch (err) {
      console.log(err)
    }

    // If not found, try with position
    if (!player_row) {
      try {
        player_row = await find_player_row({
          name: player.name,
          pos: player.position,
          start: year
        })
      } catch (err) {
        console.log(err)
      }
    }

    // If still not found, add to missing
    if (!player_row) {
      missing.push({
        name: player.name,
        pos: player.position,
        start: year
      })
      continue
    }

    inserts.push({
      pid: player_row.pid,
      source_id,
      year,
      overall_rank: player.overall_rank,
      position_rank: player.position_rank,
      position: player.position,
      timestamp,
      mock_type
    })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach((m) => log(`could not find player: ${m.name} / ${m.pos}`))

  if (argv.dry) {
    log(`Would insert ${inserts.length} players`)
    log(inserts[0])
    return
  }

  if (inserts.length) {
    // Remove any existing entries for this source and year
    // await db('nfl_draft_rankings_index')
    //   .where({ source_id, year })
    //   .del()
    // log(`Inserting ${inserts.length} players into database for ${source_id}`)
    // await db('nfl_draft_rankings_index').insert(inserts)
    // await db('nfl_draft_rankings_history').insert(inserts)
  }
}

/**
 * Main function to run the import
 * @param {Object} params
 * @param {boolean} params.dry_run - Whether to do a dry run
 */
const run = async ({ dry_run = false, year = constants.season.year } = {}) => {
  log({ dry_run, year })
  // Import consensus big board
  const consensus_big_board = await fetch_consensus_big_board({ year })
  await save_to_database({
    year,
    players: consensus_big_board,
    source_id: SOURCE_IDS.CONSENSUS,
    mock_type: MOCK_TYPES.BIG_BOARD
  })

  // Import individual big boards
  const sources = await fetch_big_board_sources({ year })
  log(sources[0])
  process.exit()
  for (const source of sources) {
    const players = await fetch_source_big_board({
      source_url: source.url,
      source_id: source.id,
      year
    })
    await save_to_database({
      year,
      players,
      source_id: source.id,
      mock_type: MOCK_TYPES.BIG_BOARD
    })
  }

  // Import consensus mock draft
  const consensus_mock_draft = await fetch_consensus_mock_draft({ year })
  await save_to_database({
    year,
    players: consensus_mock_draft,
    source_id: SOURCE_IDS.CONSENSUS,
    mock_type: MOCK_TYPES.MOCK_DRAFT
  })
}

const main = async () => {
  let error
  try {
    await run({
      dry_run: argv.dry,
      year: argv.year
    })
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.IMPORT_NFLMOCKDRAFTDATABASE,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
