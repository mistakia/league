const getRosterSize = ({
  starter_slots_quarterback = 0,
  starter_slots_running_back = 0,
  starter_slots_wide_receiver = 0,
  starter_slots_tight_end = 0,
  starter_slots_running_back_wide_receiver_flex = 0,
  srbwrte = 0,
  sqbrbwrte = 0,
  starter_slots_wide_receiver_tight_end_flex = 0,
  starter_slots_defense_special_teams = 0,
  starter_slots_kicker = 0,
  bench_slot_count = 0
}) => {
  return (
    starter_slots_quarterback +
    starter_slots_running_back +
    starter_slots_wide_receiver +
    starter_slots_tight_end +
    starter_slots_running_back_wide_receiver_flex +
    srbwrte +
    sqbrbwrte +
    starter_slots_wide_receiver_tight_end_flex +
    starter_slots_defense_special_teams +
    starter_slots_kicker +
    bench_slot_count
  )
}

export default getRosterSize
