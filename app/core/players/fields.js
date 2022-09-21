import PlayerRowOpponent from '@components/player-row-opponent'

export default function ({ week }) {
  const fields = {
    opponent: {
      label: 'Opponent',
      name: 'Opponent',
      value: 'opponent',
      component: PlayerRowOpponent,
      category: 'matchup',
      className: 'player__row-opponent'
    },
    value: {
      label: 'Salary',
      name: 'Projected Salary',
      value: 'value',
      category: 'management'
    },
    'vorp_adj.week': {
      label: 'Value',
      name: 'Projected Value',
      value: `vorp_adj.${week}`,
      category: 'management'
    },
    'market_salary.week': {
      label: 'Market',
      name: 'Projected Market Salary',
      value: `market_salary.${week}`,
      category: 'management'
    },
    market_salary_adj: {
      label: 'Adjusted',
      name: 'Projected Adjusted Market Salary',
      value: 'market_salary_adj',
      category: 'management'
    },

    'vorp.ros': {
      label: 'Pts+',
      name: 'Projected Points Added (Rest-Of-Season)',
      value: 'vorp.ros',
      category: 'fantasy'
    },
    'vorp.0': {
      label: 'Pts+',
      name: 'Projected Points Added (Season)',
      value: 'vorp.0',
      category: 'fantasy'
    },
    'vorp.week': {
      label: 'Pts+',
      name: 'Projected Points Added (Week)',
      value: `vorp.${week}`,
      category: `Week ${week}`
    },

    'points.week.total': {
      label: 'Proj',
      name: 'Projected Points (Week)',
      value: `points.${week}.total`,
      category: `Week ${week}`
    },
    'points.ros.total': {
      label: 'Proj',
      name: 'Projected Points (Rest-Of-Season)',
      value: 'points.ros.total',
      category: 'fantasy'
    },
    'points.0.total': {
      label: 'Proj',
      name: 'Projected Points (Season)',
      value: 'points.0.total',
      category: 'fantasy'
    },

    'projection.week.py': {
      label: 'YDS',
      name: 'Projected Passing Yards (Week)',
      value: `projection.${week}.py`,
      category: 'passing'
    },
    'projection.week.tdp': {
      label: 'TD',
      name: 'Projected Passing Touchdowns (Week)',
      value: `projection.${week}.tdp`,
      category: 'passing'
    },
    'projection.week.ints': {
      label: 'INT',
      name: 'Projected Interceptions (Week)',
      value: `projection.${week}.ints`,
      category: 'passing'
    },

    'projection.0.py': {
      label: 'YDS',
      name: 'Projected Passing Yards (Season)',
      value: 'projection.0.py',
      category: 'passing'
    },
    'projection.0.tdp': {
      label: 'TD',
      name: 'Projected Passing Touchdowns (Season)',
      value: 'projection.0.tdp',
      category: 'passing'
    },
    'projection.0.ints': {
      label: 'INT',
      name: 'Projected Interceptions (Season)',
      value: 'projection.0.ints',
      category: 'passing'
    },

    'projection.ros.py': {
      label: 'YDS',
      name: 'Projected Passing Yards (Rest-Of-Season)',
      value: 'projection.ros.py',
      category: 'passing'
    },
    'projection.ros.tdp': {
      label: 'TD',
      name: 'Projected Passing Touchdowns (Rest-Of-Season)',
      value: 'projection.ros.tdp',
      category: 'passing'
    },
    'projection.ros.ints': {
      label: 'INT',
      name: 'Projected Interceptions (Rest-Of-Season)',
      value: 'projection.ros.ints',
      category: 'passing'
    },

    'projection.week.ra': {
      label: 'ATT',
      name: 'Projected Rushing Attempts (Week)',
      value: `projection.${week}.ra`,
      category: 'rushing'
    },
    'projection.week.ry': {
      label: 'YDS',
      name: 'Projected Rushing Yards (Week)',
      value: `projection.${week}.ry`,
      category: 'rushing'
    },
    'projection.week.tdr': {
      label: 'TD',
      name: 'Projected Rushing Touchdowns (Week)',
      value: `projection.${week}.tdr`,
      category: 'rushing'
    },
    'projection.week.fuml': {
      label: 'FUM',
      name: 'Projected Fumbles (Week)',
      value: `projection.${week}.fuml`,
      category: 'rushing'
    },

    'projection.0.ra': {
      label: 'ATT',
      name: 'Projected Rushing Attempts (Season)',
      value: 'projection.0.ra',
      category: 'rushing'
    },
    'projection.0.ry': {
      label: 'YDS',
      name: 'Projected Rushing Yards (Season)',
      value: 'projection.0.ry',
      category: 'rushing'
    },
    'projection.0.tdr': {
      label: 'TD',
      name: 'Projected Rushing Touchdowns (Season)',
      value: 'projection.0.tdr',
      category: 'rushing'
    },
    'projection.0.fuml': {
      label: 'FUM',
      name: 'Projected Fumbles (Season)',
      value: 'projection.0.fuml',
      category: 'rushing'
    },

    'projection.ros.ra': {
      label: 'ATT',
      name: 'Projected Rushing Attempts (Rest-Of-Season)',
      value: 'projection.ros.ra',
      category: 'rushing'
    },
    'projection.ros.ry': {
      label: 'YDS',
      name: 'Projected Rushing Yards (Rest-Of-Season)',
      value: 'projection.ros.ry',
      category: 'rushing'
    },
    'projection.ros.tdr': {
      label: 'TD',
      name: 'Projected Rushing Touchdowns (Rest-Of-Season)',
      value: 'projection.ros.tdr',
      category: 'rushing'
    },
    'projection.ros.fuml': {
      label: 'FUM',
      name: 'Projected Fumbles (Rest-Of-Season)',
      value: 'projection.ros.fuml',
      category: 'rushing'
    },

    'projection.week.trg': {
      label: 'TAR',
      name: 'Projected Targets (Week)',
      value: `projection.${week}.trg`,
      category: 'receiving'
    },
    'projection.week.rec': {
      label: 'REC',
      name: 'Projected Receptions (Week)',
      value: `projection.${week}.rec`,
      category: 'receiving'
    },
    'projection.week.recy': {
      label: 'YDS',
      name: 'Projected Receiving Yards (Week)',
      value: `projection.${week}.recy`,
      category: 'receiving'
    },
    'projection.week.tdrec': {
      label: 'TD',
      name: 'Projected Receiving Touchdowns (Week)',
      value: `projection.${week}.tdrec`,
      category: 'receiving'
    },

    'projection.0.trg': {
      label: 'TAR',
      name: 'Projected Targets (Season)',
      value: 'projection.0.trg',
      category: 'receiving'
    },
    'projection.0.rec': {
      label: 'REC',
      name: 'Projected Receptions (Season)',
      value: 'projection.0.rec',
      category: 'receiving'
    },
    'projection.0.recy': {
      label: 'YDS',
      name: 'Projected Receiving Yards (Season)',
      value: 'projection.0.recy',
      category: 'receiving'
    },
    'projection.0.tdrec': {
      label: 'TD',
      name: 'Projected Receiving Touchdowns (Season)',
      value: 'projection.0.tdrec',
      category: 'receiving'
    },

    'projection.ros.trg': {
      label: 'TAR',
      name: 'Projected Targets (Rest-Of-Season)',
      value: 'projection.ros.trg',
      category: 'receiving'
    },
    'projection.ros.rec': {
      label: 'REC',
      name: 'Projected Receptions (Rest-Of-Season)',
      value: 'projection.ros.rec',
      category: 'receiving'
    },
    'projection.ros.recy': {
      label: 'YDS',
      name: 'Projected Receiving Yards (Rest-Of-Season)',
      value: 'projection.ros.recy',
      category: 'receiving'
    },
    'projection.ros.tdrec': {
      label: 'TD',
      name: 'Projected Receiving Touchdowns (Rest-Of-Season)',
      value: 'projection.ros.tdrec',
      category: 'receiving'
    },

    'stats.pts': {
      label: 'PTS',
      name: 'Fantasy Points',
      value: 'stats.pts',
      category: 'fantasy',
      fixed: 1
    },

    'stats.py': {
      label: 'YDS',
      name: 'Passing Yards',
      value: 'stats.py',
      category: 'passing'
    },
    'stats.tdp': {
      label: 'TD',
      name: 'Passing Touchdowns',
      value: 'stats.tdp',
      category: 'passing'
    },
    'stats.ints': {
      label: 'INT',
      name: 'Interceptions',
      value: 'stats.ints',
      category: 'passing'
    },
    'stats.drppy': {
      label: 'DRP YDS',
      name: 'Dropped Passing Yards',
      value: 'stats.drppy',
      category: 'passing'
    },
    'stats.pc_pct': {
      label: 'COMP%',
      name: 'Passing Completion Percentage',
      value: 'stats.pc_pct',
      category: 'efficiency'
    },
    'stats.tdp_pct': {
      label: 'TD%',
      name: 'Passing Touchdown Percentage',
      value: 'stats.tdp_pct',
      category: 'efficiency'
    },
    'stats.ints_pct': {
      label: 'INT%',
      name: 'Passing Interception Percentage',
      value: 'stats.ints_pct',
      category: 'efficiency'
    },
    'stats.intw_pct': {
      label: 'BAD%',
      name: 'Passing Interception Worthy Percentage',
      value: 'stats.intw_pct',
      category: 'efficiency'
    },
    'stats.pyac': {
      label: 'YAC',
      name: 'Passing Yards After Catch',
      value: 'stats.pyac',
      category: 'passing'
    },
    'stats.pyac_pc': {
      label: 'YAC/C',
      name: 'Passing Yards After Catch Per Completion',
      value: 'stats.pyac_pc',
      category: 'efficiency'
    },
    'stats._ypa': {
      label: 'Y/A',
      name: 'Passing Yards Per Pass Attempt',
      value: 'stats._ypa',
      category: 'efficiency'
    },
    'stats.pdot_pa': {
      label: 'DOT',
      name: 'Passing Depth of Target per Pass Attempt',
      value: 'stats.pdot_pa',
      category: 'efficiency'
    },
    'stats.pdot': {
      label: 'AY',
      name: 'Passing Air Yards',
      value: 'stats.pdot',
      category: 'air yards'
    },
    'stats.pcay_pc': {
      label: 'CAY/C',
      name: 'Completed Air Yards Per Completion',
      value: 'stats.pcay_pc',
      category: 'air yards'
    },
    'stats._pacr': {
      label: 'PACR',
      name: 'Passing Air Conversion Ratio (PACR)',
      value: 'stats._pacr',
      category: 'air yards'
    },
    'stats.sk': {
      label: 'SK',
      name: 'Sacks',
      value: 'stats.sk',
      category: 'pressure'
    },
    'stats.sky': {
      label: 'SKY',
      name: 'Sack Yards',
      value: 'stats.sky',
      category: 'pressure'
    },
    'stats.sk_pct': {
      label: 'SK%',
      name: 'Sack Percentage',
      value: 'stats.sk_pct',
      category: 'pressure'
    },
    'stats.qbhi_pct': {
      label: 'HIT%',
      name: 'QB Hit Percentage',
      value: 'stats.qbhi_pct',
      category: 'pressure'
    },
    'stats.qbp_pct': {
      label: 'PRSS%',
      name: 'QB Pressure Percentage',
      value: 'stats.qbp_pct',
      category: 'pressure'
    },
    'stats.qbhu_pct': {
      label: 'HRRY%',
      name: 'QB Hurry Percentage',
      value: 'stats.qbhu_pct',
      category: 'pressure'
    },
    'stats._nygpa': {
      label: 'NY/A',
      name: 'Net Yards Per Pass Attempt',
      value: 'stats._nygpa',
      category: 'pressure'
    },

    'stats.ry': {
      label: 'YDS',
      name: 'Rushing Yards',
      value: 'stats.ry',
      category: 'rushing'
    },
    'stats.tdr': {
      label: 'TD',
      name: 'Rushing Touchdowns',
      value: 'stats.tdr',
      category: 'rushing'
    },
    'stats.ry_pra': {
      label: 'YPC',
      name: 'Rushing Yards Per Rush Attempt',
      value: 'stats.ry_pra',
      category: 'efficiency'
    },
    'stats.ra': {
      label: 'ATT',
      name: 'Rushing Attempts',
      value: 'stats.ra',
      category: 'rushing'
    },
    'stats.rfd': {
      label: 'FD',
      name: 'Rushing First Downs',
      value: 'stats.rfd',
      category: 'rushing'
    },
    'stats.posra': {
      label: 'POS',
      name: 'Positive Yardage Rush Attempts',
      value: 'stats.posra',
      category: 'efficiency'
    },
    'stats.ryaco': {
      label: 'YDS',
      name: 'Rushing Yards After Contact',
      value: 'stats.ryaco',
      category: 'after contact'
    },
    'stats.ryaco_pra': {
      label: 'AVG',
      name: 'Rushing Yards After Contact Per Rush Attempt',
      value: 'stats.ryaco_pra',
      category: 'after contact'
    },
    'stats._stra': {
      label: 'ATT%',
      name: 'Share of Team Rushing Attempts',
      value: 'stats._stra',
      category: 'team share'
    },
    'stats._stry': {
      label: 'YDS%',
      name: 'Share of Team Rushing Yardage',
      value: 'stats._stry',
      category: 'team share'
    },
    'stats._fumlpra': {
      label: 'FUM%',
      name: 'Fumble Percentage',
      value: 'stats._fumlpra',
      category: 'efficiency'
    },
    'stats.posra_pra': {
      label: 'POS%',
      name: 'Positive Rushing Yardage Percentage',
      value: 'stats.posra_pra',
      category: 'efficiency'
    },
    'stats.rasucc_pra': {
      label: 'SUCC%',
      name: 'Successful Rush Percentage',
      value: 'stats.rasucc_pra',
      category: 'efficiency'
    },
    'stats.mbt': {
      label: 'BT',
      name: 'Broken Tackles',
      value: 'stats.mbt',
      category: 'broken tackles'
    },
    'stats.mbt_pt': {
      label: 'BT/T',
      name: 'Broken Tackles Per Rush Attempt',
      value: 'stats.mbt_pt',
      category: 'broken tackles'
    },

    'stats.rec': {
      label: 'REC',
      name: 'Receptions',
      value: 'stats.rec',
      category: 'receiving'
    },
    'stats.recy': {
      label: 'YDS',
      name: 'Receiving Yards',
      value: 'stats.recy',
      category: 'receiving'
    },
    'stats.tdrec': {
      label: 'TD',
      name: 'Receiving Touchdowns',
      value: 'stats.tdrec',
      category: 'receiving'
    },
    'stats.drp': {
      label: 'DRP',
      name: 'Drops',
      value: 'stats.drp',
      category: 'receiving'
    },
    'stats.dryprecy': {
      label: 'DRP YDS',
      name: 'Dropped Receiving Yards',
      value: 'stats.dryprecy',
      category: 'receiving'
    },
    'stats.trg': {
      label: 'TAR',
      name: 'Targets',
      value: 'stats.trg',
      category: 'oppurtunity'
    },
    'stats.dptrg_pct': {
      label: 'DEEP%',
      name: 'Percentage of Targets Traveling >= 20 Air Yards',
      value: 'stats.dptrg_pct',
      category: 'oppurtunity'
    },
    'stats._ayptrg': {
      label: 'DOT',
      name: 'Depth Of Target',
      value: 'stats._ayptrg',
      category: 'oppurtunity'
    },
    'stats.rdot': {
      label: 'AY',
      name: 'Air Yards',
      value: 'stats.rdot',
      category: 'oppurtunity'
    },
    'stats._stray': {
      label: 'AY%',
      name: "Share of Team's Air Yards",
      value: 'stats._stray',
      category: 'oppurtunity'
    },
    'stats._sttrg': {
      label: 'TAR%',
      name: "Share of Team's Targets",
      value: 'stats._sttrg',
      category: 'oppurtunity'
    },
    'stats._wopr': {
      label: 'WOPR',
      name: 'Weighted Opportunity Rating',
      value: 'stats._wopr',
      category: 'oppurtunity'
    },
    'stats._recypay': {
      label: 'RACR',
      name: 'Receiver Air Conversion Ratio (RACR)',
      value: 'stats._recypay',
      category: 'efficiency'
    },
    'stats._recyprec': {
      label: 'Y/R',
      name: 'Receiving Yards Per Reception',
      value: 'stats._recyprec',
      category: 'efficiency'
    },
    'stats._recyptrg': {
      label: 'Y/T',
      name: 'Receiving Yards Per Target',
      value: 'stats._recyptrg',
      category: 'efficiency'
    },
    'stats._ryacprec': {
      label: 'YAC/R',
      name: 'Yards After Catch Per Reception',
      value: 'stats._ryacprec',
      category: 'efficiency'
    }
  }

  for (const [key, value] of Object.entries(fields)) {
    fields[key].key = key
    fields[key].key_path = value.value.split('.')
  }

  return fields
}
