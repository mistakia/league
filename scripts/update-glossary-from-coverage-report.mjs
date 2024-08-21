import debug from 'debug'
import fs from 'fs-extra'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

// import db from '#db'
// import { constants } from '#libs-shared'
import { isMain } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('update-glossary-from-coverage-report')
debug.enable('update-glossary-from-coverage-report')

const update_glossary_from_coverage_report = async () => {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const data_path = path.join(__dirname, '../data')
  const plays_json_file_path = `${data_path}/nfl/plays/coverage-report.json`
  const players_json_file_path = `${data_path}/nfl/players-coverage-report.json`
  const markdown_path = path.join(__dirname, '../docs/glossary.md')

  const plays_coverage_data = await fs.readJSON(plays_json_file_path)
  const players_coverage_data = await fs.readJSON(players_json_file_path)

  log(`Loaded plays coverage data from ${plays_json_file_path}`)
  log(`Loaded players coverage data from ${players_json_file_path}`)

  // Read Markdown file
  let markdown_content = await fs.readFile(markdown_path, 'utf8')

  // Update Markdown tables
  const not_found_columns = {
    plays: [],
    players: []
  }

  Object.entries(plays_coverage_data).forEach(([key, value]) => {
    const regex = new RegExp(
      `(\\|\\s*${value.column}\\s*\\|[^\\|]*\\|[^\\|]*\\|)[^\\|]*\\|[^\\|]*\\|`,
      'g'
    )
    const original_markdown_content = markdown_content
    const coverage_since_display =
      value.coverage_since !== null
        ? `${value.coverage_since.toFixed(2)}%`
        : '-'
    const available_since_display =
      value.available_since !== null ? value.available_since : '-'
    markdown_content = markdown_content.replace(
      regex,
      `$1 ${coverage_since_display} | ${available_since_display} |`
    )

    if (markdown_content === original_markdown_content) {
      not_found_columns.plays.push(value.column)
    }
  })

  // Update Markdown tables for players
  Object.entries(players_coverage_data).forEach(([key, value]) => {
    const regex = new RegExp(
      `(\\|\\s*${value.column}\\s*\\|[^\\|]*\\|[^\\|]*\\|)[^\\|]*\\|`,
      'g'
    )
    const original_markdown_content = markdown_content
    const coverage_display =
      value.coverage !== null ? `${value.coverage.toFixed(2)}%` : '-'
    markdown_content = markdown_content.replace(
      regex,
      `$1 ${coverage_display} |`
    )

    if (markdown_content === original_markdown_content) {
      not_found_columns.players.push(value.column)
    }
  })

  if (not_found_columns.plays.length > 0) {
    console.log(
      'Plays columns not found in the glossary:',
      not_found_columns.plays.join(', ')
    )
  }

  if (not_found_columns.players.length > 0) {
    console.log(
      'Players columns not found in the glossary:',
      not_found_columns.players.join(', ')
    )
  }

  // Write updated Markdown back to file
  await fs.writeFile(markdown_path, markdown_content)
}

const main = async () => {
  let error
  try {
    await update_glossary_from_coverage_report()
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default update_glossary_from_coverage_report
