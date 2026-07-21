import {
  current_season,
  fantasy_positions,
  nfl_team_abbreviations
} from '#constants'
import path, { dirname } from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sqlFile = path.resolve(__dirname, './player.sql')

export async function seed(knex, Promise) {
  await knex('player').del()

  const sql = await fs.readFile(sqlFile, 'utf8')
  await knex.raw(sql)

  // insert test rookies
  const rookies = []
  for (let i = 0; i < 200; i++) {
    const pos = fantasy_positions[i % fantasy_positions.length]
    rookies.push({
      pid: `XR-ROOK-${String(i * 5).padStart(6, '0')}`,
      short_name: `TestRookie${i}`,
      first_name: `TestRookie${i}`,
      last_name: `TestRookie${i}`,
      formatted_name: `testrookie${i}`,
      date_of_birth: '0000-00-00',
      primary_position: pos,
      secondary_position: pos,
      current_nfl_team:
        nfl_team_abbreviations[i % nfl_team_abbreviations.length],
      nfl_draft_year: current_season.year
    })
  }
  await knex('player').insert(rookies)

  // insert test sophmores
  const sophmores = []
  for (let i = 0; i < 50; i++) {
    const pos = fantasy_positions[i % fantasy_positions.length]
    sophmores.push({
      pid: `XS-SOPH-${String(i * 5).padStart(6, '0')}`,
      short_name: `TestSophmore${i}`,
      first_name: `TestSophmore${i}`,
      last_name: `TestSophmore${i}`,
      formatted_name: `testsophmore${i}`,
      date_of_birth: '0000-00-00',
      primary_position: pos,
      secondary_position: pos,
      current_nfl_team:
        nfl_team_abbreviations[i % nfl_team_abbreviations.length],
      nfl_draft_year: current_season.year - 1
    })
  }
  await knex('player').insert(sophmores)
}
