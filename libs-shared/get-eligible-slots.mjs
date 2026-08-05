const get_eligible_slots = ({ pos, ps, bench, reserve_short_term, league }) => {
  let eligible = []

  if (pos) {
    for (let i = 0; i < league.starter_slots_qb; i++) {
      eligible.push('QB')
    }

    for (let i = 0; i < league.starter_slots_rb; i++) {
      eligible.push('RB')
    }

    for (let i = 0; i < league.starter_slots_wr; i++) {
      eligible.push('WR')
    }

    for (let i = 0; i < league.starter_slots_te; i++) {
      eligible.push('TE')
    }

    for (let i = 0; i < league.starter_slots_wr_te_flex; i++) {
      eligible.push('WRTE')
    }

    for (let i = 0; i < league.starter_slots_rb_wr_flex; i++) {
      eligible.push('RBWR')
    }

    for (let i = 0; i < league.srbwrte; i++) {
      eligible.push('RBWRTE')
    }

    for (let i = 0; i < league.sqbrbwrte; i++) {
      eligible.push('QBRBWRTE')
    }

    for (let i = 0; i < league.starter_slots_k; i++) {
      eligible.push('K')
    }

    for (let i = 0; i < league.starter_slots_dst; i++) {
      eligible.push('DST')
    }

    if (pos !== 'ALL') {
      eligible = eligible.filter((k) => k.includes(pos))
    }
  }

  if (ps) {
    for (let i = 0; i < league.practice_squad_slot_count; i++) {
      eligible.push('PS')
    }
  }

  if (reserve_short_term) {
    for (let i = 0; i < league.reserve_short_term_limit; i++) {
      eligible.push('IR')
    }
  }

  if (bench) {
    for (let i = 0; i < league.bench_slot_count; i++) {
      eligible.push('BENCH')
    }
  }

  return eligible
}

export default get_eligible_slots
