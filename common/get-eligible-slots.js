import { slots } from './constants'

const getEligibleSlots = ({ pos, ps, bench, ir, league }) => {
  const slotKeys = Object.keys(slots)
  let eligible = []

  if (league.sqb === 1) {
    eligible.push('QB_ONE')
  } else if (league.sqb === 2) {
    eligible.push('QB_ONE')
    eligible.push('QB_TWO')
  }

  if (league.srb === 1) {
    eligible.push('RB_ONE')
  } else if (league.srb === 2) {
    eligible.push('RB_ONE')
    eligible.push('RB_TWO')
  } else if (league.srb === 3) {
    eligible.push('RB_ONE')
    eligible.push('RB_TWO')
    eligible.push('RB_THREE')
  }

  if (league.swr === 1) {
    eligible.push('WR_ONE')
  } else if (league.swr === 2) {
    eligible.push('WR_ONE')
    eligible.push('WR_TWO')
  } else if (league.swr === 3) {
    eligible.push('WR_ONE')
    eligible.push('WR_TWO')
    eligible.push('WR_THREE')
  }

  if (league.ste === 1) {
    eligible.push('TE_ONE')
  } else if (league.ste === 2) {
    eligible.push('TE_ONE')
    eligible.push('TE_TWO')
  }

  if (league.swrte === 1) {
    eligible.push('WRTE_ONE')
  }

  if (league.srbwr === 1) {
    eligible.push('RBWR_ONE')
  } else if (league.srbwr === 2) {
    eligible.push('RBWR_ONE')
    eligible.push('RBWR_TWO')
  }

  if (league.srbwrte === 1) {
    eligible.push('RBWRTE_ONE')
  } else if (league.srbwrte === 2) {
    eligible.push('RBWRTE_ONE')
    eligible.push('RBWRTE_TWO')
  }

  if (league.sqbrbwrte === 1) {
    eligible.push('QBRBWRTE_ONE')
  }

  if (league.sk === 1) {
    eligible.push('K_ONE')
  }

  if (league.sdst === 1) {
    eligible.push('DST_ONE')
  }

  if (pos) {
    eligible = eligible.filter(k => k.includes(pos))
  }

  if (bench) {
    const benchSlots = slotKeys.filter(k => k.includes('BENCH'))
    eligible.push(...benchSlots.slice(0, league.bench))
  }

  if (ps) {
    const psSlots = slotKeys.filter(k => k.includes('PS'))
    eligible.push(...psSlots.slice(0, league.ps))
  }

  if (ir) {
    const irSlots = slotKeys.filter(k => k.includes('IR'))
    eligible.push(...irSlots.slice(0, league.ir))
  }

  return eligible
}

export default getEligibleSlots
