export const stats = (d) => ({
  // passing
  ints: d['20'],
  tdp: d['4'],
  py: d['3'],
  pa: d['0'],
  pc: d['1'],

  // rushing
  ra: d['23'],
  ry: d['24'],
  tdr: d['25'],
  fuml: d['72'],

  // receiving
  trg: d['58'],
  rec: d['53'],
  recy: d['42'],
  tdrec: d['43'],

  // kicker
  fg39: d['80'],
  fg49: d['77'],
  fg50: d['74'],
  xpm: d['86'],

  // return
  // prtd: d['102'],
  // krtd: d['101'],

  // defense
  dint: d['95'],
  drf: d['96'],
  dblk: d['97'],
  dsf: d['98'],
  dsk: d['99'],
  dtd: (d['103'] || 0) + (d['104'] || 0) + (d['93'] || 0)
})

export const positionId = {
  1: 'QB',
  2: 'RB',
  3: 'WR',
  4: 'TE',
  5: 'K',
  16: 'DST'
}

export const teamId = {
  [-1]: 'Bye',
  1: 'ATL',
  2: 'BUF',
  3: 'CHI',
  4: 'CIN',
  5: 'CLE',
  6: 'DAL',
  7: 'DEN',
  8: 'DET',
  9: 'GB',
  10: 'TEN',
  11: 'IND',
  12: 'KC',
  13: 'OAK',
  14: 'LA',
  15: 'MIA',
  16: 'MIN',
  17: 'NE',
  18: 'NO',
  19: 'NYG',
  20: 'NYJ',
  21: 'PHI',
  22: 'ARI',
  23: 'PIT',
  24: 'LAC',
  25: 'SF',
  26: 'SEA',
  27: 'TB',
  28: 'WSH',
  29: 'CAR',
  30: 'JAX',
  33: 'BAL',
  34: 'HOU'
}
