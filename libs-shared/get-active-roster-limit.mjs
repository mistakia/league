export default function getActiveRosterLimit(league) {
  return (
    league.starter_slots_quarterback +
    league.starter_slots_running_back +
    league.starter_slots_wide_receiver +
    league.starter_slots_tight_end +
    league.starter_slots_running_back_wide_receiver_flex +
    league.starter_slots_running_back_wide_receiver_tight_end_flex +
    league.starter_slots_superflex +
    league.starter_slots_wide_receiver_tight_end_flex +
    league.starter_slots_defense_special_teams +
    league.starter_slots_kicker +
    league.bench_slot_count
  )
}
