import debug from 'debug'

import db from '#db'
import { constants } from '#common'
import { getLeague, isMain } from '#utils'

const log = debug('set-draft-pick-number')

const calculatePick = ({ round, order, league }) =>
  (round - 1) * league.num_teams + order

const run = async () => {
  const lid = 1

  const league = await getLeague({ lid })
  const teams = await db('teams').where({ lid, year: constants.season.year })
  const draftOrder = teams.sort((a, b) => a.do - b.do).map((t) => t.uid)

  const picks = await db('draft').where({
    lid,
    year: constants.season.year,
    comp: 0
  })

  for (const pick of picks) {
    const num = calculatePick({
      round: pick.round,
      order: draftOrder.indexOf(pick.otid) + 1,
      league
    })
    await db('draft').update({ pick: num }).where('uid', pick.uid)
  }

  const query_params = {
    comp: 1,
    lid,
    year: constants.season.year
  }
  await db('draft').update({ pick: null }).where(query_params)
  const compPicks = await db('draft').where(query_params)

  const inserts = []
  let count = 0
  while (compPicks.length) {
    // find comp picks following the draft order
    const tid = draftOrder[count % league.num_teams]
    const index = compPicks.findIndex((p) => p.tid === tid)
    if (index >= 0) {
      const pick = compPicks.splice(index, 1)[0]
      inserts.push(pick)
      const num = picks.length + inserts.length
      await db('draft')
        .update({ pick: num, round: Math.ceil(num / league.num_teams) })
        .where('uid', pick.uid)
    }

    count++
  }

  log(
    `set ${inserts.length + picks.length} draft picks for ${
      constants.season.year
    }`
  )
}

const main = async () => {
  debug.enable('set-draft-pick-number')
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.SET_DRAFT_PICK_NUMBER,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default run
