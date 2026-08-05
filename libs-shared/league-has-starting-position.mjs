export default function league_has_starting_position({ pos, league }) {
  switch (pos) {
    case 'QB':
      return Boolean(league.starter_slots_qb || league.sqbrbwrte)
    case 'RB':
      return Boolean(
        league.starter_slots_rb ||
          league.starter_slots_rb_wr_flex ||
          league.srbwrte ||
          league.sqbrbwrte
      )
    case 'WR':
      return Boolean(
        league.starter_slots_wr ||
          league.starter_slots_rb_wr_flex ||
          league.srbwrte ||
          league.starter_slots_wr_te_flex ||
          league.sqbrbwrte
      )
    case 'TE':
      return Boolean(
        league.starter_slots_te ||
          league.srbwrte ||
          league.starter_slots_wr_te_flex ||
          league.sqbrbwrte
      )
    case 'K':
      return Boolean(league.starter_slots_k)
    case 'DST':
      return Boolean(league.starter_slots_dst)
  }
}
