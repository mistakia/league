export default function getActiveRosterLimit(league) {
  return (
    league.starter_slots_qb +
    league.starter_slots_rb +
    league.starter_slots_wr +
    league.starter_slots_te +
    league.starter_slots_rb_wr_flex +
    league.srbwrte +
    league.sqbrbwrte +
    league.starter_slots_wr_te_flex +
    league.starter_slots_dst +
    league.starter_slots_k +
    league.bench_slot_count
  )
}
