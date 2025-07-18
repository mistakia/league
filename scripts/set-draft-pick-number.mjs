import debug from 'debug'

import db from '#db'
import { constants } from '#libs-shared'
import { getLeague, is_main, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('set-draft-pick-number')

const calculatePick = ({ round, order, league }) =>
  (round - 1) * league.num_teams + order

const set_draft_pick_number = async ({ lid }) => {
  log(`setting draft picks for ${constants.season.year}`)

  const league = await getLeague({ lid })
  const teams = await db('teams').where({ lid, year: constants.season.year })
  const draftOrder = teams
    .sort((a, b) => a.draft_order - b.draft_order)
    .map((t) => t.uid)

  const picks = await db('draft').where({
    lid,
    year: constants.season.year,
    comp: 0
  })

  const team_ids = teams.map((t) => t.uid)
  const filtered_picks = picks.filter((p) => team_ids.includes(p.tid))

  for (const pick of filtered_picks) {
    const num = calculatePick({
      round: pick.round,
      order: draftOrder.indexOf(pick.otid) + 1,
      league
    })
    const pick_number_in_round = num - (pick.round - 1) * league.num_teams
    await db('draft')
      .update({ pick: num, pick_str: `${pick.round}.${pick_number_in_round}` })
      .where('uid', pick.uid)
  }

  // reset pick numbers as there could be gaps due to decommissioned teams
  const sorted_draft_picks = await db('draft')
    .where({
      comp: 0,
      lid,
      year: constants.season.year
    })
    .orderBy('pick', 'asc')

  for (let i = 0; i < sorted_draft_picks.length; i++) {
    const pick = sorted_draft_picks[i]
    const num = i + 1
    if (pick.pick !== num) {
      await db('draft').update({ pick: num }).where('uid', pick.uid)
    }
  }

  const query_params = {
    comp: 1,
    lid,
    year: constants.season.year
  }
  await db('draft').update({ pick: null }).where(query_params)
  const compensatory_picks = await db('draft').where(query_params)

  const inserts = []
  let count = 0
  while (compensatory_picks.length) {
    // find comp picks following the draft order
    // TODO do not use num_teams as it could change
    const tid = draftOrder[count % league.num_teams]
    const index = compensatory_picks.findIndex((p) => p.tid === tid)
    if (index >= 0) {
      const pick = compensatory_picks.splice(index, 1)[0]
      inserts.push(pick)
      const num = sorted_draft_picks.length + inserts.length
      await db('draft')
        .update({
          pick: num,
          round: Math.ceil(num / league.num_teams),
          pick_str: `${Math.ceil(num / league.num_teams)}.${num % league.num_teams || league.num_teams}`
        })
        .where('uid', pick.uid)
    }

    count++
  }

  log(
    `set ${inserts.length + sorted_draft_picks.length} draft picks for ${
      constants.season.year
    }`
  )
}

const main = async () => {
  debug.enable('set-draft-pick-number')
  let error
  try {
    await set_draft_pick_number()
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.SET_DRAFT_PICK_NUMBER,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default set_draft_pick_number
