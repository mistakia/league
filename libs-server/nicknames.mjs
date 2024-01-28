import path from 'path'
import { fileURLToPath } from 'url'

import readCSV from './read-csv.mjs'

let nickname_sets = []

const get_nickname_set_indexes_for_name = (name) => {
  const nickname_set_indexes = []
  for (let i = 0; i < nickname_sets.length; i++) {
    const nickname_set = nickname_sets[i]
    if (nickname_set.includes(name)) {
      nickname_set_indexes.push(i)
    }
  }

  return nickname_set_indexes
}

export const load = async () => {
  nickname_sets = []

  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const nicknames_csv_path = path.join(__dirname, '..', 'data', 'nicknames.csv')
  const csv = await readCSV(nicknames_csv_path)
  for (const row of csv) {
    const nickname_set = Object.values(row)
    nickname_sets.push(nickname_set)
  }
}

export const check = (name1, name2) => {
  const name1_lower = name1.toLowerCase()
  const name2_lower = name2.toLowerCase()
  const nickname_set_indexes1 = get_nickname_set_indexes_for_name(name1_lower)
  const nickname_set_indexes2 = get_nickname_set_indexes_for_name(name2_lower)

  // find first intersection
  for (const i of nickname_set_indexes1) {
    if (nickname_set_indexes2.includes(i)) {
      return true
    }
  }

  return false
}
