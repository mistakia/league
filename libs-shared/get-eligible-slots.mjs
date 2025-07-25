const get_eligible_slots = ({ pos, ps, bench, ir, league }) => {
  let eligible = []

  if (pos) {
    for (let i = 0; i < league.sqb; i++) {
      eligible.push('QB')
    }

    for (let i = 0; i < league.srb; i++) {
      eligible.push('RB')
    }

    for (let i = 0; i < league.swr; i++) {
      eligible.push('WR')
    }

    for (let i = 0; i < league.ste; i++) {
      eligible.push('TE')
    }

    for (let i = 0; i < league.swrte; i++) {
      eligible.push('WRTE')
    }

    for (let i = 0; i < league.srbwr; i++) {
      eligible.push('RBWR')
    }

    for (let i = 0; i < league.srbwrte; i++) {
      eligible.push('RBWRTE')
    }

    for (let i = 0; i < league.sqbrbwrte; i++) {
      eligible.push('QBRBWRTE')
    }

    for (let i = 0; i < league.sk; i++) {
      eligible.push('K')
    }

    for (let i = 0; i < league.sdst; i++) {
      eligible.push('DST')
    }

    if (pos !== 'ALL') {
      eligible = eligible.filter((k) => k.includes(pos))
    }
  }

  if (ps) {
    for (let i = 0; i < league.ps; i++) {
      eligible.push('PS')
    }
  }

  if (ir) {
    for (let i = 0; i < league.ir; i++) {
      eligible.push('IR')
    }
  }

  if (bench) {
    for (let i = 0; i < league.bench; i++) {
      eligible.push('BENCH')
    }
  }

  return eligible
}

export default get_eligible_slots
