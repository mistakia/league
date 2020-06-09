import { Record } from 'immutable'

export const Roster = new Record({
  isPending: false,
  tid: null,
  lid: null,
  week: null,
  year: null,
  last_updated: null,
  s0: null,
  s1: null,
  s2: null,
  s3: null,
  s4: null,
  s5: null,
  s6: null,
  s7: null,
  s8: null,
  s9: null,
  s10: null,
  s11: null,
  s12: null,
  s13: null,
  s14: null,
  s15: null,
  s16: null,
  s17: null,
  s18: null,
  s19: null,
  s20: null,
  s21: null,
  s22: null,
  s23: null,
  s24: null,
  s25: null,
  s26: null,
  s27: null,
  s28: null,
  s29: null,
  s30: null,
  s31: null,
  s32: null,
  s33: null,
  s34: null,
  s35: null,
  s36: null
})

export function createRoster (rosters) {
  if (!rosters || !rosters.length) {
    return
  }

  const roster = rosters[0]

  return new Roster({
    isPending: false,
    ...roster
  })
}
