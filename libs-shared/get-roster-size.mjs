const getRosterSize = ({
  starter_slots_qb = 0,
  starter_slots_rb = 0,
  starter_slots_wr = 0,
  starter_slots_te = 0,
  starter_slots_rb_wr_flex = 0,
  srbwrte = 0,
  sqbrbwrte = 0,
  starter_slots_wr_te_flex = 0,
  starter_slots_dst = 0,
  starter_slots_k = 0,
  bench_slot_count = 0
}) => {
  return (
    starter_slots_qb +
    starter_slots_rb +
    starter_slots_wr +
    starter_slots_te +
    starter_slots_rb_wr_flex +
    srbwrte +
    sqbrbwrte +
    starter_slots_wr_te_flex +
    starter_slots_dst +
    starter_slots_k +
    bench_slot_count
  )
}

export default getRosterSize
