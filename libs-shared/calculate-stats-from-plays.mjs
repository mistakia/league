import { create_empty_extended_stats } from '#constants'

const round = (value, precision) => {
  const multiplier = Math.pow(10, precision || 0)
  return Math.round(value * multiplier) / multiplier
}

const toPct = (value) => value * 100

const safe_div = ({ numerator, denominator }) => {
  if (!denominator) return 0
  return numerator / denominator
}

const calculateStatsFromPlays = (plays) => {
  const players = {}
  const teams = {}
  const playerToTeam = {}

  const addTeamStat = (team, stat, value) => {
    value = Number(value)
    teams[team] = teams[team] || create_empty_extended_stats()
    teams[team][stat] += value
  }

  const addStat = (pid, stat, value) => {
    if (!pid) return
    value = Number(value)

    if (isNaN(value)) {
      // TODO log warning
      return
    }

    // TODO record longest rushing, receiving, passing play
    // TODO count big plays
    // TODO situational splits (i.e. # of defenders in box)
    players[pid] = players[pid] || create_empty_extended_stats()
    players[pid][stat] += value
  }

  plays.forEach((play) => {
    if (play.fuml) {
      addStat(play.player_fuml_pid, 'fuml', 1)
      playerToTeam[play.player_fuml_pid] = play.off
    }

    switch (play.play_type) {
      case 'RUSH': {
        playerToTeam[play.bc_pid] = play.off
        addTeamStat(play.off, 'ra', 1)
        addTeamStat(play.off, 'ry', play.yds_gained)
        addStat(play.bc_pid, 'ra', 1)
        addStat(play.bc_pid, 'ry', play.rush_yds)
        if (play.yards_after_any_contact)
          addStat(play.bc_pid, 'ryaco', play.yards_after_any_contact)
        if (play.first_down) {
          addStat(play.bc_pid, 'first_down', 1)
          addStat(play.bc_pid, 'rfd', 1)
        }
        if (play.successful_play) {
          addStat(play.bc_pid, 'successful_play', 1)
          addStat(play.bc_pid, 'rasucc', 1)
        }
        if (play.mbt) addStat(play.bc_pid, 'mbt', play.mbt)
        if (play.rush_yds > 0) addStat(play.bc_pid, 'posra', 1)
        if (play.first_down) addStat(play.bc_pid, 'rfd', 1)
        if (play.td) addStat(play.bc_pid, 'tdr', 1)
        break
      }

      case 'PASS': {
        // passer
        playerToTeam[play.psr_pid] = play.off
        if (play.successful_play) {
          addStat(play.psr_pid, 'psucc', 1)
          addStat(play.psr_pid, 'successful_play', 1)
        }
        if (play.dot) {
          addStat(play.psr_pid, 'pdot', play.dot)
          addTeamStat(play.off, 'rdot', play.dot)
        }
        if (play.qb_pressure) addStat(play.psr_pid, 'qb_pressure', 1)
        if (play.qb_hit) addStat(play.psr_pid, 'qb_hit', 1)
        if (play.qb_hurry) addStat(play.psr_pid, 'qb_hurry', 1)
        if (play.highlight_pass) addStat(play.psr_pid, 'highlight_pass', 1)
        if (play.int_worthy) addStat(play.psr_pid, 'int_worthy', 1)
        if (play.dropped_pass) {
          addStat(play.psr_pid, 'drpp', 1)
          addStat(play.psr_pid, 'drppy', play.dot)
        }

        // receiver
        if (play.trg_pid) {
          playerToTeam[play.trg_pid] = play.off
          addTeamStat(play.off, 'trg', 1)
          addStat(play.trg_pid, 'trg', 1)
          addStat(play.trg_pid, 'rdot', play.dot)
          if (play.dot >= 20) addStat(play.trg_pid, 'dptrg', 1)
          if (play.contested_ball) addStat(play.trg_pid, 'contested_ball', 1)
          if (play.dropped_pass) {
            addStat(play.trg_pid, 'drops', 1)
            addStat(play.trg_pid, 'drprecy', play.dot)
          }
        }

        if (play.intp) {
          addStat(play.psr_pid, 'ints', 1)
        } else if (play.comp && play.trg_pid) {
          // TODO deprecate - temp fix for missing trg
          // receiver
          addStat(play.trg_pid, 'rec', 1)
          addStat(play.trg_pid, 'recy', play.recv_yds)
          addStat(play.trg_pid, 'ryac', play.yards_after_catch)
          addStat(play.trg_pid, 'rcay', play.dot)
          if (play.mbt) addStat(play.trg_pid, 'mbt', play.mbt)

          // passer
          addStat(play.psr_pid, 'pa', 1)
          addStat(play.psr_pid, 'py', play.pass_yds)
          addStat(play.psr_pid, 'pc', 1)
          addStat(play.psr_pid, 'pcay', play.dot)
          if (play.yards_after_catch)
            addStat(play.psr_pid, 'pyac', play.yards_after_catch)

          if (play.successful_play) addStat(play.trg_pid, 'successful_play', 1)
          if (play.first_down) {
            addStat(play.psr_pid, 'first_down', 1)
            addStat(play.trg_pid, 'first_down', 1)
          }

          if (play.td) {
            addStat(play.psr_pid, 'tdp', 1)
            addStat(play.trg_pid, 'tdrec', 1)
          }
        } else if (play.sk) {
          addStat(play.psr_pid, 'sk', 1)
          addStat(play.psr_pid, 'sky', Math.abs(play.yds_gained))
        } else {
          addStat(play.psr_pid, 'pa', 1)
        }
      }
    }
  })

  for (const pid in players) {
    const stats = players[pid]
    const team = playerToTeam[pid]
    const team_stats = teams[team]

    const skpa = stats.sk + stats.pa

    stats._tch = stats.ra + stats.rec

    stats.pc_pct =
      round(
        toPct(safe_div({ numerator: stats.pc, denominator: stats.pa })),
        1
      ) || 0
    // stats.py_pg

    stats.tdp_pct =
      round(
        toPct(safe_div({ numerator: stats.tdp, denominator: stats.pa })),
        1
      ) || 0
    stats.ints_pct =
      round(
        toPct(safe_div({ numerator: stats.ints, denominator: stats.pa })),
        1
      ) || 0

    stats.int_worthy_pct =
      round(
        toPct(safe_div({ numerator: stats.int_worthy, denominator: stats.pa })),
        1
      ) || 0
    stats.pcay_pc =
      round(safe_div({ numerator: stats.pcay, denominator: stats.pc }), 1) || 0
    stats._ypa =
      round(safe_div({ numerator: stats.py, denominator: stats.pa }), 1) || 0
    stats.pyac_pc =
      round(safe_div({ numerator: stats.pyac, denominator: stats.pc }), 1) || 0
    // stats._adjypa
    stats._ypc =
      round(safe_div({ numerator: stats.py, denominator: stats.pc }), 1) || 0
    // stats._ypg
    stats._pacr =
      round(safe_div({ numerator: stats.py, denominator: stats.pdot }), 2) || 0
    stats.pdot_pa =
      round(safe_div({ numerator: stats.pdot, denominator: stats.pa }), 1) || 0
    // stats._apacr

    stats.sk_pct =
      round(toPct(safe_div({ numerator: stats.sk, denominator: skpa })), 1) || 0
    stats.qb_pressure_pct =
      round(
        toPct(safe_div({ numerator: stats.qb_pressure, denominator: skpa })),
        1
      ) || 0
    stats.qb_hit_pct =
      round(
        toPct(safe_div({ numerator: stats.qb_hit, denominator: skpa })),
        1
      ) || 0
    stats.qb_hurry_pct =
      round(
        toPct(safe_div({ numerator: stats.qb_hurry, denominator: skpa })),
        1
      ) || 0
    stats._nygpa =
      round(
        safe_div({ numerator: stats.py - stats.sky, denominator: skpa }),
        1
      ) || 0

    stats.recy_prec =
      round(safe_div({ numerator: stats.recy, denominator: stats.rec }), 1) || 0
    // stats.recy_pg

    const team_rdot = team_stats ? team_stats.rdot : 0
    const team_trg = team_stats ? team_stats.trg : 0
    const stray = team_rdot ? stats.rdot / team_rdot : 0 // share of teams air yards
    const sttrg = team_trg ? stats.trg / team_trg : 0 // share of teams targets
    stats._stray = round(toPct(stray), 1) || 0
    stats._sttrg = round(toPct(sttrg), 1) || 0

    stats.dptrg_pct =
      round(
        toPct(safe_div({ numerator: stats.dptrg, denominator: stats.trg })),
        1
      ) || 0

    // stats._ayps
    stats._ayprec =
      round(safe_div({ numerator: stats.rdot, denominator: stats.rec }), 1) || 0
    stats._ayptrg =
      round(safe_div({ numerator: stats.rdot, denominator: stats.trg }), 1) || 0
    stats._recypay =
      round(safe_div({ numerator: stats.recy, denominator: stats.rdot }), 1) ||
      0
    // stats._recypsnp
    stats._recyprec =
      round(safe_div({ numerator: stats.recy, denominator: stats.rec }), 1) || 0
    stats._recyptrg =
      round(safe_div({ numerator: stats.recy, denominator: stats.trg }), 1) || 0
    stats._wopr = round(1.5 * sttrg + 0.7 * stray, 1) || 0
    stats._ryacprec =
      round(safe_div({ numerator: stats.ryac, denominator: stats.rec }), 1) || 0

    // stats.ry_pg
    stats.ry_pra =
      round(safe_div({ numerator: stats.ry, denominator: stats.ra }), 1) || 0
    stats.ryaco_pra =
      round(safe_div({ numerator: stats.ryaco, denominator: stats.ra }), 1) || 0

    stats.mbt_pt =
      round(safe_div({ numerator: stats.mbt, denominator: stats._tch }), 1) || 0
    stats._fumlpra =
      round(
        toPct(safe_div({ numerator: stats.fuml, denominator: stats.ra })),
        1
      ) || 0
    stats.rasucc_pra =
      round(
        toPct(safe_div({ numerator: stats.rasucc, denominator: stats.ra })),
        1
      ) || 0
    stats.posra_pra =
      round(
        toPct(safe_div({ numerator: stats.posra, denominator: stats.ra })),
        1
      ) || 0

    const team_ra = team_stats ? team_stats.ra : 0
    const team_ry = team_stats ? team_stats.ry : 0
    stats._stra = team_ra ? round(toPct(stats.ra / team_ra), 1) || 0 : 0
    stats._stry = team_ry ? round(toPct(stats.ry / team_ry), 1) || 0 : 0

    // stats.fd_pct
    // stats.succ_psnp
  }

  return players
}

export default calculateStatsFromPlays
