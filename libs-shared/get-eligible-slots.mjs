const get_eligible_slots = ({ pos, ps, bench, reserve_short_term, league }) => {
  let eligible = []

  if (pos) {
    for (let i = 0; i < league.starter_slots_quarterback; i++) {
      eligible.push('QB')
    }

    for (let i = 0; i < league.starter_slots_running_back; i++) {
      eligible.push('RB')
    }

    for (let i = 0; i < league.starter_slots_wide_receiver; i++) {
      eligible.push('WR')
    }

    for (let i = 0; i < league.starter_slots_tight_end; i++) {
      eligible.push('TE')
    }

    for (
      let i = 0;
      i < league.starter_slots_wide_receiver_tight_end_flex;
      i++
    ) {
      eligible.push('WRTE')
    }

    for (
      let i = 0;
      i < league.starter_slots_running_back_wide_receiver_flex;
      i++
    ) {
      eligible.push('RBWR')
    }

    for (let i = 0; i < league.srbwrte; i++) {
      eligible.push('RBWRTE')
    }

    for (let i = 0; i < league.sqbrbwrte; i++) {
      eligible.push('QBRBWRTE')
    }

    for (let i = 0; i < league.starter_slots_kicker; i++) {
      eligible.push('K')
    }

    for (let i = 0; i < league.starter_slots_defense_special_teams; i++) {
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
