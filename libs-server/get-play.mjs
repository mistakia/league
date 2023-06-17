import db from '#db'

import { fixTeam } from '#libs-shared'

export default async function ({
  esbid,
  playId,

  week,
  year,
  off,
  def,

  qtr,
  game_clock_start,
  dwn,
  type,
  ydl_num,
  ydl_side
}) {
  const query = db('nfl_plays')

  if (esbid) {
    query.where({ esbid })
  }

  if (playId) {
    query.where({ playId })
  }

  if (week) {
    query.where({ week })
  }

  if (year) {
    query.where({ year })
  }

  if (off) {
    query.where({ off: fixTeam(off) })
  }

  if (def) {
    query.where({ def: fixTeam(def) })
  }

  if (qtr) {
    query.where({ qtr: parseInt(qtr, 10) })
  }

  if (game_clock_start) {
    query.where({ game_clock_start })
  }

  if (dwn) {
    query.where({ dwn: parseInt(dwn, 10) })
  }

  if (type) {
    query.where({ type })
  }

  if (ydl_num) {
    query.where({ ydl_num })
  }

  if (ydl_side) {
    query.where({ ydl_side: fixTeam(ydl_side) })
  }

  const plays = await query
  if (plays.length === 1) {
    return plays[0]
  } else {
    return null
  }
}
