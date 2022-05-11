import { constants } from '#common'
import path, { dirname } from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sqlFile = path.resolve(__dirname, './player.sql')

export async function seed (knex, Promise) {
  await knex('player').del()

  const sql = await fs.readFile(sqlFile, 'utf8')
  await knex.raw(sql)

  // insert test rookies
  const rookies = []
  for (let i = 0; i < 200; i++) {
    const pos = constants.positions[i % constants.positions.length]
    rookies.push({
      player: `TT-${i * 5}`,
      pname: `Test${i}`,
      lname: `Test${i}`,
      pos,
      pos1: pos,
      cteam: constants.nflTeams[i % constants.nflTeams.length],
      start: constants.season.year
    })
  }
  await knex('player').insert(rookies)
}
