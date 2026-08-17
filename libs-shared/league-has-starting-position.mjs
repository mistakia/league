export default function league_has_starting_position({ pos, league }) {
  switch (pos) {
    case 'QB':
      return Boolean(
        league.starter_slots_quarterback || league.starter_slots_superflex
      )
    case 'RB':
      return Boolean(
        league.starter_slots_running_back ||
          league.starter_slots_running_back_wide_receiver_flex ||
          league.starter_slots_running_back_wide_receiver_tight_end_flex ||
          league.starter_slots_superflex
      )
    case 'WR':
      return Boolean(
        league.starter_slots_wide_receiver ||
          league.starter_slots_running_back_wide_receiver_flex ||
          league.starter_slots_running_back_wide_receiver_tight_end_flex ||
          league.starter_slots_wide_receiver_tight_end_flex ||
          league.starter_slots_superflex
      )
    case 'TE':
      return Boolean(
        league.starter_slots_tight_end ||
          league.starter_slots_running_back_wide_receiver_tight_end_flex ||
          league.starter_slots_wide_receiver_tight_end_flex ||
          league.starter_slots_superflex
      )
    case 'K':
      return Boolean(league.starter_slots_kicker)
    case 'DST':
      return Boolean(league.starter_slots_defense_special_teams)
  }
}
