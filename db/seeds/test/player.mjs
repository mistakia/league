import { constants } from '#libs-shared'
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
    const pos = constants.positions[i % constants.positions.length]
    rookies.push({
      pid: `XR-${i * 5}`,
      pname: `TestRookie${i}`,
      lname: `TestRookie${i}`,
      pos,
      pos1: pos,
      cteam: constants.nflTeams[i % constants.nflTeams.length],
      start: constants.season.year
    })
  }
  await knex('player').insert(rookies)

  // insert test sophmores
  const sophmores = []
  for (let i = 0; i < 10; i++) {
    const pos = constants.positions[i % constants.positions.length]
    sophmores.push({
      pid: `XS-${i * 5}`,
      pname: `TestSophmore${i}`,
      lname: `TestSophmore${i}`,
      pos,
      pos1: pos,
      cteam: constants.nflTeams[i % constants.nflTeams.length],
      start: constants.season.year - 1
    })
  }
  await knex('player').insert(sophmores)
}
