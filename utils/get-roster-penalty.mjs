import { constants } from '#common'
import db from '#db'

export default async function ({ tid, year = constants.season.year }) {
  const result = await db('league_salary_penalty')
    .where({
      tid,
      year
    })
    .sum('amount as penalty')

  return result[0].penalty || 0
}
