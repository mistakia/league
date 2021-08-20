// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const debug = require('debug')

const db = require('../db')
const { constants } = require('../common')
const { getLeague } = require('../utils')

const log = debug('set-draft-pick-number')

const calculatePick = ({ round, order, league }) =>
  (round - 1) * league.nteams + order

const run = async () => {
  const leagueId = 1

  const league = await getLeague(leagueId)
  const teams = await db('teams').where({ lid: leagueId })
  const draftOrder = teams.sort((a, b) => a.do - b.do).map((t) => t.uid)

  const picks = await db('draft').where({
    lid: leagueId,
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

  const compPicks = await db('draft').where({
    comp: 1,
    lid: leagueId,
    year: constants.season.year
  })

  const inserts = []
  let count = 0
  while (compPicks.length) {
    // find comp picks following the draft order
    const tid = draftOrder[count % league.nteams]
    const index = compPicks.findIndex((p) => p.tid === tid)
    if (index >= 0) {
      const pick = compPicks.splice(index, 1)[0]
      inserts.push(pick)
      const num = picks.length + inserts.length
      await db('draft')
        .update({ pick: num, round: Math.ceil((num + 1) / league.nteams) })
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

module.exports = run

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

if (!module.parent) {
  main()
}
