// League format definitions
// This file defines the source data for generating named format constants
// Supports both direct hash mappings and configuration objects

export const scoring_formats = {
  standard: {
    label: 'Standard (No PPR)',
    config: {
      pa: 0, // passing attempts
      pc: 0, // passing completions
      py: 0.04, // passing yards (points per yard)
      ints: -2, // interceptions
      tdp: 4, // passing touchdowns
      ra: 0, // rushing attempts
      ry: 0.1, // rushing yards
      tdr: 6, // rushing touchdowns
      rec: 0, // receptions (no PPR)
      rbrec: 0, // RB receptions
      wrrec: 0, // WR receptions
      terec: 0, // TE receptions
      recy: 0.1, // receiving yards
      tdrec: 6, // receiving touchdowns
      twoptc: 2, // two-point conversions
      fuml: -2, // fumbles lost
      prtd: 6, // punt return touchdowns
      krtd: 6, // kick return touchdowns
      trg: 0, // targets (no points in standard)
      rush_first_down: 0, // rushing first downs
      rec_first_down: 0 // receiving first downs
    },
    description: 'Standard scoring with no PPR and 4-point passing touchdowns'
  },

  half_ppr: {
    label: 'Half PPR',
    config: {
      pa: 0, // passing attempts
      pc: 0, // passing completions
      py: 0.04, // passing yards (points per yard)
      ints: -2, // interceptions
      tdp: 4, // passing touchdowns
      ra: 0, // rushing attempts
      ry: 0.1, // rushing yards
      tdr: 6, // rushing touchdowns
      rec: 0.5, // receptions (half PPR)
      rbrec: 0.5, // RB receptions
      wrrec: 0.5, // WR receptions
      terec: 0.5, // TE receptions
      recy: 0.1, // receiving yards
      tdrec: 6, // receiving touchdowns
      twoptc: 2, // two-point conversions
      fuml: -2, // fumbles lost
      prtd: 6, // punt return touchdowns
      krtd: 6, // kick return touchdowns
      trg: 0, // targets (no points in standard)
      rush_first_down: 0, // rushing first downs
      rec_first_down: 0 // receiving first downs
    },
    description:
      'Half point per reception scoring with 4-point passing touchdowns'
  },

  ppr: {
    label: 'PPR (Full)',
    config: {
      pa: 0, // passing attempts
      pc: 0, // passing completions
      py: 0.04, // passing yards (points per yard)
      ints: -2, // interceptions
      tdp: 4, // passing touchdowns
      ra: 0, // rushing attempts
      ry: 0.1, // rushing yards
      tdr: 6, // rushing touchdowns
      rec: 1, // receptions (full PPR)
      rbrec: 1, // RB receptions
      wrrec: 1, // WR receptions
      terec: 1, // TE receptions
      recy: 0.1, // receiving yards
      tdrec: 6, // receiving touchdowns
      twoptc: 2, // two-point conversions
      fuml: -2, // fumbles lost
      prtd: 6, // punt return touchdowns
      krtd: 6, // kick return touchdowns
      trg: 0, // targets (no points in standard)
      rush_first_down: 0, // rushing first downs
      rec_first_down: 0 // receiving first downs
    },
    description:
      'Full point per reception scoring with 4-point passing touchdowns'
  },

  sfb15_mfl: {
    label: 'Scott Fish Bowl 15 (MFL)',
    config: {
      pa: 0, // passing attempts
      pc: 0, // passing completions
      py: 0.04, // passing yards (points per yard)
      ints: 0, // interceptions (0 points in SFB)
      tdp: 6, // passing touchdowns
      ra: 0.5, // rushing attempts (0.5 points per carry)
      ry: 0.1, // rushing yards
      tdr: 6, // rushing touchdowns
      rec: 1, // receptions (full PPR)
      rbrec: 1, // RB receptions
      wrrec: 1, // WR receptions
      terec: 2, // TE receptions (rec + 1 for SFB)
      recy: 0.1, // receiving yards
      tdrec: 6, // receiving touchdowns
      twoptc: 2, // two-point conversions
      fuml: 0, // fumbles lost (0 points in SFB)
      prtd: 6, // punt return touchdowns
      krtd: 6, // kick return touchdowns
      trg: 1, // targets (1 point per target in SFB)
      rush_first_down: 1, // rushing first downs (1 point in SFB)
      rec_first_down: 1 // receiving first downs (1 point in SFB)
    },
    description:
      'Scott Fish Bowl 15 MFL scoring (PPR + 0.5 per carry + 1 per target) - no turnover penalties'
  },

  sfb15_sleeper: {
    label: 'Scott Fish Bowl 15 (Sleeper)',
    config: {
      pa: 0, // passing attempts
      pc: 0, // passing completions
      py: 0.04, // passing yards (points per yard)
      ints: 0, // interceptions (0 points in SFB)
      tdp: 6, // passing touchdowns
      ra: 0.5, // rushing attempts (0.5 points per carry)
      ry: 0.1, // rushing yards
      tdr: 6, // rushing touchdowns
      rec: 2.5, // receptions (2.5 PPR)
      rbrec: 2.5, // RB receptions
      wrrec: 2.5, // WR receptions
      terec: 3.5, // TE receptions (rec + 1 for SFB)
      recy: 0.1, // receiving yards
      tdrec: 6, // receiving touchdowns
      twoptc: 2, // two-point conversions
      fuml: 0, // fumbles lost (0 points in SFB)
      prtd: 6, // punt return touchdowns
      krtd: 6, // kick return touchdowns
      trg: 0, // targets (no points in SFB Sleeper)
      rush_first_down: 1, // rushing first downs (1 point in SFB)
      rec_first_down: 1 // receiving first downs (1 point in SFB)
    },
    description:
      'Scott Fish Bowl 15 Sleeper scoring (2.5 PPR + 0.5 per carry) - no turnover penalties'
  },

  fanduel: {
    label: 'FanDuel DFS',
    config: {
      pa: 0, // passing attempts
      pc: 0, // passing completions
      py: 0.04, // passing yards (0.04 points per yard)
      ints: -1, // interceptions (-1 points)
      tdp: 4, // passing touchdowns (4 points)
      ra: 0, // rushing attempts
      ry: 0.1, // rushing yards (0.1 points per yard)
      tdr: 6, // rushing touchdowns (6 points)
      rec: 0.5, // receptions (0.5 PPR)
      rbrec: 0.5, // RB receptions
      wrrec: 0.5, // WR receptions
      terec: 0.5, // TE receptions
      recy: 0.1, // receiving yards (0.1 points per yard)
      tdrec: 6, // receiving touchdowns (6 points)
      twoptc: 2, // two-point conversions (2 points)
      fuml: -2, // fumbles lost (-2 points)
      prtd: 6, // punt return touchdowns (6 points)
      krtd: 6, // kick return touchdowns (6 points)
      trg: 0, // targets (no points in FanDuel)
      rush_first_down: 0, // rushing first downs
      rec_first_down: 0 // receiving first downs
      // TODO: Add support for unsupported FanDuel scoring:
      // - 100+ rushing yard bonus (3 points)
      // - 100+ receiving yard bonus (3 points)
      // - 300+ passing yard bonus (3 points)
      // - Team self fumble recovery touchdown (6 points)
      // - Two-point conversion thrown (2 points)
      // - Field goals: 0-39 yards (3 pts), 40-49 yards (4 pts), 50+ yards (5 pts)
      // - Extra-point conversions (1 point)
      // - All defensive scoring (sacks, fumble recoveries, safeties, etc.)
    },
    description:
      'FanDuel DFS scoring with half PPR, 4-point passing TDs, and yardage bonuses - bonus/kicker/defense support needed'
  },

  draftkings: {
    label: 'DraftKings DFS',
    config: {
      pa: 0, // passing attempts
      pc: 0, // passing completions
      py: 0.04, // passing yards (0.04 points per yard)
      ints: -1, // interceptions (-1 points, less punitive than standard)
      tdp: 4, // passing touchdowns (4 points)
      ra: 0, // rushing attempts
      ry: 0.1, // rushing yards (0.1 points per yard)
      tdr: 6, // rushing touchdowns (6 points)
      rec: 1, // receptions (1 PPR - full point per reception)
      rbrec: 1, // RB receptions
      wrrec: 1, // WR receptions
      terec: 1, // TE receptions
      recy: 0.1, // receiving yards (0.1 points per yard)
      tdrec: 6, // receiving touchdowns (6 points)
      twoptc: 2, // two-point conversions (2 points)
      fuml: -1, // fumbles lost (-1 points, less punitive than standard)
      prtd: 6, // punt return touchdowns (6 points)
      krtd: 6, // kick return touchdowns (6 points)
      trg: 0, // targets (no points in DraftKings)
      rush_first_down: 0, // rushing first downs
      rec_first_down: 0 // receiving first downs
      // TODO: Add support for unsupported DraftKings scoring:
      // - 300+ passing yard bonus (3 points)
      // - 100+ rushing yard bonus (3 points)
      // - 100+ receiving yard bonus (3 points)
      // - Kicker and defense/special teams scoring
    },
    description:
      'DraftKings DFS scoring with full PPR, 4-point passing TDs, and milestone bonuses - bonus/kicker/defense support needed'
  },

  half_ppr_lower_turnover: {
    label: 'Half PPR (Lower Turnover)',
    config: {
      pa: 0, // passing attempts
      pc: 0, // passing completions
      py: 0.04, // passing yards (points per yard)
      ints: -1, // interceptions (-1 point, less punitive)
      tdp: 4, // passing touchdowns
      ra: 0, // rushing attempts
      ry: 0.1, // rushing yards
      tdr: 6, // rushing touchdowns
      rec: 0.5, // receptions (half PPR)
      rbrec: 0.5, // RB receptions
      wrrec: 0.5, // WR receptions
      terec: 0.5, // TE receptions
      recy: 0.1, // receiving yards
      tdrec: 6, // receiving touchdowns
      twoptc: 2, // two-point conversions
      fuml: -1, // fumbles lost (-1 point, less punitive)
      prtd: 6, // punt return touchdowns
      krtd: 6, // kick return touchdowns
      trg: 0, // targets (no points in standard)
      rush_first_down: 0, // rushing first downs
      rec_first_down: 0 // receiving first downs
    },
    description:
      'Half PPR with lower turnover penalties: -1 INT, -1 fumble lost'
  },

  ppr_lower_turnover: {
    label: 'PPR (Lower Turnover)',
    config: {
      pa: 0, // passing attempts
      pc: 0, // passing completions
      py: 0.04, // passing yards (points per yard)
      ints: -1, // interceptions (-1 point, less punitive)
      tdp: 4, // passing touchdowns
      ra: 0, // rushing attempts
      ry: 0.1, // rushing yards
      tdr: 6, // rushing touchdowns
      rec: 1, // receptions (full PPR)
      rbrec: 1, // RB receptions
      wrrec: 1, // WR receptions
      terec: 1, // TE receptions
      recy: 0.1, // receiving yards
      tdrec: 6, // receiving touchdowns
      twoptc: 2, // two-point conversions
      fuml: -1, // fumbles lost (-1 point, less punitive)
      prtd: 6, // punt return touchdowns
      krtd: 6, // kick return touchdowns
      trg: 0, // targets (no points in standard)
      rush_first_down: 0, // rushing first downs
      rec_first_down: 0 // receiving first downs
    },
    description:
      'Full PPR with lower turnover penalties: -1 INT, -1 fumble lost'
  },

  genesis: {
    label: 'Genesis League',
    config: {
      pa: 0, // passing attempts
      pc: 0, // passing completions
      py: 0.05, // passing yards (0.05 points per yard)
      ints: -1, // interceptions (-1 point)
      tdp: 4, // passing touchdowns (4 points)
      ra: 0, // rushing attempts
      ry: 0.1, // rushing yards
      tdr: 6, // rushing touchdowns
      rec: 0.5, // receptions (half PPR)
      rbrec: 0.5, // RB receptions
      wrrec: 0.5, // WR receptions
      terec: 0.5, // TE receptions
      recy: 0.1, // receiving yards
      tdrec: 6, // receiving touchdowns
      twoptc: 2, // two-point conversions
      fuml: -1, // fumbles lost (-1 point)
      prtd: 6, // punt return touchdowns
      krtd: 6, // kick return touchdowns
      trg: 0, // targets (no points in Genesis)
      rush_first_down: 0, // rushing first downs
      rec_first_down: 0, // receiving first downs
      exclude_qb_kneels: true // exclude QB kneels from rushing yards
    },
    description:
      'Genesis League scoring with half PPR, 4-point passing TDs, 0.05 passing yards, and -1 turnovers'
  }
}

export const league_formats = {
  // Standard formats - 10 team versions
  standard_10_team: {
    label: 'Standard 10 Team (No PPR)',
    config: {
      num_teams: 10, // number of teams
      sqb: 1, // starting QB
      srb: 2, // starting RB
      swr: 2, // starting WR
      ste: 1, // starting TE
      srbwr: 0, // starting RB/WR flex
      srbwrte: 1, // starting RB/WR/TE flex
      sqbrbwrte: 0, // starting superflex
      swrte: 0, // starting WR/TE flex
      sdst: 1, // starting D/ST
      sk: 1, // starting K
      bench: 6, // bench spots
      ps: 0, // practice squad spots
      reserve_short_term_limit: 3, // Short term reserve spots
      cap: 200, // salary cap
      min_bid: 0 // minimum bid
    },
    scoring_format: 'standard',
    description:
      '10-team league with standard (no PPR) scoring - 1QB/2RB/2WR/1TE/1FLEX'
  },

  half_ppr_10_team: {
    label: 'Half PPR 10 Team',
    config: {
      num_teams: 10, // number of teams
      sqb: 1, // starting QB
      srb: 2, // starting RB
      swr: 2, // starting WR
      ste: 1, // starting TE
      srbwr: 0, // starting RB/WR flex
      srbwrte: 1, // starting RB/WR/TE flex
      sqbrbwrte: 0, // starting superflex
      swrte: 0, // starting WR/TE flex
      sdst: 1, // starting D/ST
      sk: 1, // starting K
      bench: 6, // bench spots
      ps: 0, // practice squad spots
      reserve_short_term_limit: 3, // Short term reserve spots
      cap: 200, // salary cap
      min_bid: 0 // minimum bid
    },
    scoring_format: 'half_ppr',
    description: '10-team league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX'
  },

  ppr_10_team: {
    label: 'PPR 10 Team',
    config: {
      num_teams: 10, // number of teams
      sqb: 1, // starting QB
      srb: 2, // starting RB
      swr: 2, // starting WR
      ste: 1, // starting TE
      srbwr: 0, // starting RB/WR flex
      srbwrte: 1, // starting RB/WR/TE flex
      sqbrbwrte: 0, // starting superflex
      swrte: 0, // starting WR/TE flex
      sdst: 1, // starting D/ST
      sk: 1, // starting K
      bench: 6, // bench spots
      ps: 0, // practice squad spots
      reserve_short_term_limit: 3, // Short term reserve spots
      cap: 200, // salary cap
      min_bid: 0 // minimum bid
    },
    scoring_format: 'ppr',
    description: '10-team league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX'
  },

  // Standard formats - 12 team versions
  standard_12_team: {
    label: 'Standard 12 Team (No PPR)',
    config: {
      num_teams: 12, // number of teams
      sqb: 1, // starting QB
      srb: 2, // starting RB
      swr: 2, // starting WR
      ste: 1, // starting TE
      srbwr: 0, // starting RB/WR flex
      srbwrte: 1, // starting RB/WR/TE flex
      sqbrbwrte: 0, // starting superflex
      swrte: 0, // starting WR/TE flex
      sdst: 1, // starting D/ST
      sk: 1, // starting K
      bench: 6, // bench spots
      ps: 0, // practice squad spots
      reserve_short_term_limit: 3, // Short term reserve spots
      cap: 200, // salary cap
      min_bid: 0 // minimum bid
    },
    scoring_format: 'standard',
    description:
      '12-team league with standard (no PPR) scoring - 1QB/2RB/2WR/1TE/1FLEX'
  },

  half_ppr_12_team: {
    label: 'Half PPR 12 Team',
    config: {
      num_teams: 12, // number of teams
      sqb: 1, // starting QB
      srb: 2, // starting RB
      swr: 2, // starting WR
      ste: 1, // starting TE
      srbwr: 0, // starting RB/WR flex
      srbwrte: 1, // starting RB/WR/TE flex
      sqbrbwrte: 0, // starting superflex
      swrte: 0, // starting WR/TE flex
      sdst: 1, // starting D/ST
      sk: 1, // starting K
      bench: 6, // bench spots
      ps: 0, // practice squad spots
      reserve_short_term_limit: 3, // Short term reserve spots
      cap: 200, // salary cap
      min_bid: 0 // minimum bid
    },
    scoring_format: 'half_ppr',
    description: '12-team league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX'
  },

  ppr_12_team: {
    label: 'PPR 12 Team',
    config: {
      num_teams: 12, // number of teams
      sqb: 1, // starting QB
      srb: 2, // starting RB
      swr: 2, // starting WR
      ste: 1, // starting TE
      srbwr: 0, // starting RB/WR flex
      srbwrte: 1, // starting RB/WR/TE flex
      sqbrbwrte: 0, // starting superflex
      swrte: 0, // starting WR/TE flex
      sdst: 1, // starting D/ST
      sk: 1, // starting K
      bench: 6, // bench spots
      ps: 0, // practice squad spots
      reserve_short_term_limit: 3, // Short term reserve spots
      cap: 200, // salary cap
      min_bid: 0 // minimum bid
    },
    scoring_format: 'ppr',
    description: '12-team league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX'
  },

  // Superflex formats - 10 team versions
  half_ppr_10_team_superflex: {
    label: 'Half PPR 10 Team Superflex',
    config: {
      num_teams: 10, // number of teams
      sqb: 1, // starting QB
      srb: 2, // starting RB
      swr: 2, // starting WR
      ste: 1, // starting TE
      srbwr: 0, // starting RB/WR flex
      srbwrte: 1, // starting RB/WR/TE flex
      sqbrbwrte: 1, // starting superflex
      swrte: 0, // starting WR/TE flex
      sdst: 1, // starting D/ST
      sk: 1, // starting K
      bench: 6, // bench spots
      ps: 0, // practice squad spots
      reserve_short_term_limit: 3, // Short term reserve spots
      cap: 200, // salary cap
      min_bid: 0 // minimum bid
    },
    scoring_format: 'half_ppr',
    description:
      '10-team superflex league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX'
  },

  ppr_10_team_superflex: {
    label: 'PPR 10 Team Superflex',
    config: {
      num_teams: 10, // number of teams
      sqb: 1, // starting QB
      srb: 2, // starting RB
      swr: 2, // starting WR
      ste: 1, // starting TE
      srbwr: 0, // starting RB/WR flex
      srbwrte: 1, // starting RB/WR/TE flex
      sqbrbwrte: 1, // starting superflex
      swrte: 0, // starting WR/TE flex
      sdst: 1, // starting D/ST
      sk: 1, // starting K
      bench: 6, // bench spots
      ps: 0, // practice squad spots
      reserve_short_term_limit: 3, // Short term reserve spots
      cap: 200, // salary cap
      min_bid: 0 // minimum bid
    },
    scoring_format: 'ppr',
    description:
      '10-team superflex league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX'
  },

  // Superflex formats - 12 team versions
  half_ppr_12_team_superflex: {
    label: 'Half PPR 12 Team Superflex',
    config: {
      num_teams: 12, // number of teams
      sqb: 1, // starting QB
      srb: 2, // starting RB
      swr: 2, // starting WR
      ste: 1, // starting TE
      srbwr: 0, // starting RB/WR flex
      srbwrte: 1, // starting RB/WR/TE flex
      sqbrbwrte: 1, // starting superflex
      swrte: 0, // starting WR/TE flex
      sdst: 1, // starting D/ST
      sk: 1, // starting K
      bench: 6, // bench spots
      ps: 0, // practice squad spots
      reserve_short_term_limit: 3, // Short term reserve spots
      cap: 200, // salary cap
      min_bid: 0 // minimum bid
    },
    scoring_format: 'half_ppr',
    description:
      '12-team superflex league with half PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX'
  },

  ppr_12_team_superflex: {
    label: 'PPR 12 Team Superflex',
    config: {
      num_teams: 12, // number of teams
      sqb: 1, // starting QB
      srb: 2, // starting RB
      swr: 2, // starting WR
      ste: 1, // starting TE
      srbwr: 0, // starting RB/WR flex
      srbwrte: 1, // starting RB/WR/TE flex
      sqbrbwrte: 1, // starting superflex
      swrte: 0, // starting WR/TE flex
      sdst: 1, // starting D/ST
      sk: 1, // starting K
      bench: 6, // bench spots
      ps: 0, // practice squad spots
      reserve_short_term_limit: 3, // Short term reserve spots
      cap: 200, // salary cap
      min_bid: 0 // minimum bid
    },
    scoring_format: 'ppr',
    description:
      '12-team superflex league with full PPR scoring - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX'
  },

  // Scott Fish Bowl formats
  sfb15_mfl: {
    label: 'Scott Fish Bowl 15 (MFL)',
    config: {
      num_teams: 12, // number of teams
      sqb: 1, // starting QB
      srb: 0, // starting RB
      swr: 0, // starting WR
      ste: 0, // starting TE
      srbwr: 0, // starting RB/WR flex
      srbwrte: 9, // starting RB/WR/TE flex (9 flex slots)
      sqbrbwrte: 2, // starting superflex (2 superflex slots)
      swrte: 0, // starting WR/TE flex
      sdst: 0, // starting D/ST (no D/ST)
      sk: 0, // starting K (no K)
      bench: 6, // bench spots
      ps: 0, // practice squad spots
      reserve_short_term_limit: 3, // Short term reserve spots
      cap: 200, // salary cap
      min_bid: 0 // minimum bid
    },
    scoring_format: 'sfb15_mfl',
    description:
      'Scott Fish Bowl 15 MFL format with 2 superflex and 9 flex positions'
  },

  sfb15_sleeper: {
    label: 'Scott Fish Bowl 15 (Sleeper)',
    config: {
      num_teams: 12, // number of teams
      sqb: 1, // starting QB
      srb: 0, // starting RB
      swr: 0, // starting WR
      ste: 0, // starting TE
      srbwr: 0, // starting RB/WR flex
      srbwrte: 9, // starting RB/WR/TE flex (9 flex slots)
      sqbrbwrte: 2, // starting superflex (2 superflex slots)
      swrte: 0, // starting WR/TE flex
      sdst: 0, // starting D/ST (no D/ST)
      sk: 0, // starting K (no K)
      bench: 6, // bench spots
      ps: 0, // practice squad spots
      reserve_short_term_limit: 3, // Short term reserve spots
      cap: 200, // salary cap
      min_bid: 0 // minimum bid
    },
    scoring_format: 'sfb15_sleeper',
    description:
      'Scott Fish Bowl 15 Sleeper format with 2 superflex and 9 flex positions'
  },

  // DraftKings DFS format
  draftkings_classic: {
    label: 'DraftKings Classic DFS',
    config: {
      num_teams: 1, // single entry (DFS)
      sqb: 1, // starting QB
      srb: 2, // starting RB
      swr: 3, // starting WR
      ste: 1, // starting TE
      srbwr: 0, // starting RB/WR flex
      srbwrte: 1, // starting RB/WR/TE flex
      sqbrbwrte: 0, // starting superflex
      swrte: 0, // starting WR/TE flex
      sdst: 1, // starting D/ST
      sk: 0, // starting K (no K in DraftKings)
      bench: 0, // no bench (DFS)
      ps: 0, // no practice squad
      reserve_short_term_limit: 0, // no short term reserve
      cap: 50000, // salary cap ($50k)
      min_bid: 0 // minimum bid
    },
    scoring_format: 'draftkings',
    description:
      'DraftKings classic DFS lineup - 1QB/2RB/3WR/1TE/1FLEX/1DST with $50k salary cap'
  },

  // Lower turnover formats - Half PPR
  half_ppr_lower_turnover_10_team: {
    label: 'Half PPR Lower Turnover 10 Team',
    config: {
      num_teams: 10, // number of teams
      sqb: 1, // starting QB
      srb: 2, // starting RB
      swr: 2, // starting WR
      ste: 1, // starting TE
      srbwr: 0, // starting RB/WR flex
      srbwrte: 1, // starting RB/WR/TE flex
      sqbrbwrte: 0, // starting superflex
      swrte: 0, // starting WR/TE flex
      sdst: 1, // starting D/ST
      sk: 1, // starting K
      bench: 6, // bench spots
      ps: 0, // practice squad spots
      reserve_short_term_limit: 3, // Short term reserve spots
      cap: 200, // salary cap
      min_bid: 0 // minimum bid
    },
    scoring_format: 'half_ppr_lower_turnover',
    description:
      '10-team league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX'
  },

  half_ppr_lower_turnover_12_team: {
    label: 'Half PPR Lower Turnover 12 Team',
    config: {
      num_teams: 12, // number of teams
      sqb: 1, // starting QB
      srb: 2, // starting RB
      swr: 2, // starting WR
      ste: 1, // starting TE
      srbwr: 0, // starting RB/WR flex
      srbwrte: 1, // starting RB/WR/TE flex
      sqbrbwrte: 0, // starting superflex
      swrte: 0, // starting WR/TE flex
      sdst: 1, // starting D/ST
      sk: 1, // starting K
      bench: 6, // bench spots
      ps: 0, // practice squad spots
      reserve_short_term_limit: 3, // Short term reserve spots
      cap: 200, // salary cap
      min_bid: 0 // minimum bid
    },
    scoring_format: 'half_ppr_lower_turnover',
    description:
      '12-team league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX'
  },

  half_ppr_lower_turnover_10_team_superflex: {
    label: 'Half PPR Lower Turnover 10 Team Superflex',
    config: {
      num_teams: 10, // number of teams
      sqb: 1, // starting QB
      srb: 2, // starting RB
      swr: 2, // starting WR
      ste: 1, // starting TE
      srbwr: 0, // starting RB/WR flex
      srbwrte: 1, // starting RB/WR/TE flex
      sqbrbwrte: 1, // starting superflex
      swrte: 0, // starting WR/TE flex
      sdst: 1, // starting D/ST
      sk: 1, // starting K
      bench: 6, // bench spots
      ps: 0, // practice squad spots
      reserve_short_term_limit: 3, // Short term reserve spots
      cap: 200, // salary cap
      min_bid: 0 // minimum bid
    },
    scoring_format: 'half_ppr_lower_turnover',
    description:
      '10-team superflex league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX'
  },

  half_ppr_lower_turnover_12_team_superflex: {
    label: 'Half PPR Lower Turnover 12 Team Superflex',
    config: {
      num_teams: 12, // number of teams
      sqb: 1, // starting QB
      srb: 2, // starting RB
      swr: 2, // starting WR
      ste: 1, // starting TE
      srbwr: 0, // starting RB/WR flex
      srbwrte: 1, // starting RB/WR/TE flex
      sqbrbwrte: 1, // starting superflex
      swrte: 0, // starting WR/TE flex
      sdst: 1, // starting D/ST
      sk: 1, // starting K
      bench: 6, // bench spots
      ps: 0, // practice squad spots
      reserve_short_term_limit: 3, // Short term reserve spots
      cap: 200, // salary cap
      min_bid: 0 // minimum bid
    },
    scoring_format: 'half_ppr_lower_turnover',
    description:
      '12-team superflex league with half PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX'
  },

  // Lower turnover formats - Full PPR
  ppr_lower_turnover_10_team: {
    label: 'PPR Lower Turnover 10 Team',
    config: {
      num_teams: 10, // number of teams
      sqb: 1, // starting QB
      srb: 2, // starting RB
      swr: 2, // starting WR
      ste: 1, // starting TE
      srbwr: 0, // starting RB/WR flex
      srbwrte: 1, // starting RB/WR/TE flex
      sqbrbwrte: 0, // starting superflex
      swrte: 0, // starting WR/TE flex
      sdst: 1, // starting D/ST
      sk: 1, // starting K
      bench: 6, // bench spots
      ps: 0, // practice squad spots
      reserve_short_term_limit: 3, // Short term reserve spots
      cap: 200, // salary cap
      min_bid: 0 // minimum bid
    },
    scoring_format: 'ppr_lower_turnover',
    description:
      '10-team league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX'
  },

  ppr_lower_turnover_12_team: {
    label: 'PPR Lower Turnover 12 Team',
    config: {
      num_teams: 12, // number of teams
      sqb: 1, // starting QB
      srb: 2, // starting RB
      swr: 2, // starting WR
      ste: 1, // starting TE
      srbwr: 0, // starting RB/WR flex
      srbwrte: 1, // starting RB/WR/TE flex
      sqbrbwrte: 0, // starting superflex
      swrte: 0, // starting WR/TE flex
      sdst: 1, // starting D/ST
      sk: 1, // starting K
      bench: 6, // bench spots
      ps: 0, // practice squad spots
      reserve_short_term_limit: 3, // Short term reserve spots
      cap: 200, // salary cap
      min_bid: 0 // minimum bid
    },
    scoring_format: 'ppr_lower_turnover',
    description:
      '12-team league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX'
  },

  ppr_lower_turnover_10_team_superflex: {
    label: 'PPR Lower Turnover 10 Team Superflex',
    config: {
      num_teams: 10, // number of teams
      sqb: 1, // starting QB
      srb: 2, // starting RB
      swr: 2, // starting WR
      ste: 1, // starting TE
      srbwr: 0, // starting RB/WR flex
      srbwrte: 1, // starting RB/WR/TE flex
      sqbrbwrte: 1, // starting superflex
      swrte: 0, // starting WR/TE flex
      sdst: 1, // starting D/ST
      sk: 1, // starting K
      bench: 6, // bench spots
      ps: 0, // practice squad spots
      reserve_short_term_limit: 3, // Short term reserve spots
      cap: 200, // salary cap
      min_bid: 0 // minimum bid
    },
    scoring_format: 'ppr_lower_turnover',
    description:
      '10-team superflex league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX'
  },

  ppr_lower_turnover_12_team_superflex: {
    label: 'PPR Lower Turnover 12 Team Superflex',
    config: {
      num_teams: 12, // number of teams
      sqb: 1, // starting QB
      srb: 2, // starting RB
      swr: 2, // starting WR
      ste: 1, // starting TE
      srbwr: 0, // starting RB/WR flex
      srbwrte: 1, // starting RB/WR/TE flex
      sqbrbwrte: 1, // starting superflex
      swrte: 0, // starting WR/TE flex
      sdst: 1, // starting D/ST
      sk: 1, // starting K
      bench: 6, // bench spots
      ps: 0, // practice squad spots
      reserve_short_term_limit: 3, // Short term reserve spots
      cap: 200, // salary cap
      min_bid: 0 // minimum bid
    },
    scoring_format: 'ppr_lower_turnover',
    description:
      '12-team superflex league with full PPR and lower turnovers (-1 INT, -1 fumble) - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX'
  },

  // Genesis League format
  genesis_10_team: {
    label: 'Genesis League 10 Team',
    config: {
      num_teams: 10, // number of teams
      sqb: 1, // starting QB
      srb: 2, // starting RB
      swr: 2, // starting WR
      ste: 1, // starting TE
      srbwr: 0, // starting RB/WR flex
      srbwrte: 1, // starting RB/WR/TE flex
      sqbrbwrte: 1, // starting superflex
      swrte: 0, // starting WR/TE flex
      sdst: 1, // starting D/ST
      sk: 0, // starting K (no kicker)
      bench: 7, // bench spots
      ps: 4, // practice squad spots
      reserve_short_term_limit: 99, // Short term reserve spots
      cap: 200, // salary cap
      min_bid: 0 // minimum bid
    },
    scoring_format: 'genesis',
    description:
      'Genesis League 10-team superflex format with no kicker - 1QB/2RB/2WR/1TE/1FLEX/1SFLEX'
  }
}

// No additional exports needed
