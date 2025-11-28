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
      pid: `XR-${i * 5}`,
      pname: `TestRookie${i}`,
      fname: `TestRookie${i}`,
      lname: `TestRookie${i}`,
      formatted: `testrookie${i}`,
      dob: '0000-00-00',
      pos,
      pos1: pos,
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
      pid: `XS-${i * 5}`,
      pname: `TestSophmore${i}`,
      fname: `TestSophmore${i}`,
      lname: `TestSophmore${i}`,
      formatted: `testsophmore${i}`,
      dob: '0000-00-00',
      pos,
      pos1: pos,
      current_nfl_team:
        nfl_team_abbreviations[i % nfl_team_abbreviations.length],
      nfl_draft_year: current_season.year - 1
    })
  }
  await knex('player').insert(sophmores)
}
