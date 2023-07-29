import * as constants from './constants.mjs'

const round = (value, precision) => {
  const multiplier = Math.pow(10, precision || 0)
  return Math.round(value * multiplier) / multiplier
}

const toPct = (value) => value * 100

const calculateStatsFromPlays = (plays) => {
  const players = {}
  const teams = {}
  const playerToTeam = {}

  const addTeamStat = (team, stat, value) => {
    value = parseInt(value, 10)
    teams[team] = teams[team] || constants.createFullStats()
    teams[team][stat] += value
  }

  const addStat = (pid, stat, value) => {
    if (!pid) return
    value = parseInt(value, 10)

    if (isNaN(value)) {
      // TODO log warning
      return
    }

    // TODO record longest rushing, receiving, passing play
    // TODO count big plays
    // TODO situational splits (i.e. # of defenders in box)
    players[pid] = players[pid] || constants.createFullStats()
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
        if (play.yaco) addStat(play.bc_pid, 'ryaco', play.yaco)
        if (play.fd) {
          addStat(play.bc_pid, 'fd', 1)
          addStat(play.bc_pid, 'rfd', 1)
        }
        if (play.succ) {
          addStat(play.bc_pid, 'succ', 1)
          addStat(play.bc_pid, 'rasucc', 1)
        }
        if (play.mbt) addStat(play.bc_pid, 'mbt', play.mbt)
        if (play.rush_yds > 0) addStat(play.bc_pid, 'posra', 1)
        if (play.fd) addStat(play.bc_pid, 'rfd', 1)
        if (play.td) addStat(play.bc_pid, 'tdr', 1)
        break
      }

      case 'PASS': {
        // passer
        playerToTeam[play.psr_pid] = play.off
        if (play.succ) {
          addStat(play.psr_pid, 'psucc', 1)
          addStat(play.psr_pid, 'succ', 1)
        }
        if (play.dot) {
          addStat(play.psr_pid, 'pdot', play.dot)
          addTeamStat(play.off, 'rdot', play.dot)
        }
        if (play.qbp) addStat(play.psr_pid, 'qbp', 1)
        if (play.qbhi) addStat(play.psr_pid, 'qbhi', 1)
        if (play.qbhu) addStat(play.psr_pid, 'qbhu', 1)
        if (play.high) addStat(play.psr_pid, 'high', 1)
        if (play.int_worthy) addStat(play.psr_pid, 'int_worthy', 1)
        if (play.drp) {
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
          if (play.cnb) addStat(play.trg_pid, 'cnb', 1)
          if (play.drp) {
            addStat(play.trg_pid, 'drp', 1)
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
          addStat(play.trg_pid, 'ryac', play.yac)
          addStat(play.trg_pid, 'rcay', play.dot)
          if (play.mbt) addStat(play.trg_pid, 'mbt', play.mbt)

          // passer
          addStat(play.psr_pid, 'pa', 1)
          addStat(play.psr_pid, 'py', play.pass_yds)
          addStat(play.psr_pid, 'pc', 1)
          addStat(play.psr_pid, 'pcay', play.dot)
          if (play.yac) addStat(play.psr_pid, 'pyac', play.yac)

          if (play.succ) addStat(play.trg_pid, 'succ', 1)
          if (play.fd) {
            addStat(play.psr_pid, 'fd', 1)
            addStat(play.trg_pid, 'fd', 1)
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
    const teamStats = teams[team]

    const skpa = stats.sk + stats.pa

    stats._tch = stats.ra + stats.rec

    stats.pc_pct = round(toPct(stats.pc / stats.pa), 1) || 0
    // stats.py_pg

    stats.tdp_pct = round(toPct(stats.tdp / stats.pa), 1) || 0
    stats.ints_pct = round(toPct(stats.ints / stats.pa), 1) || 0

    stats.int_worthy_pct = round(toPct(stats.int_worthy / stats.pa), 1) || 0
    stats.pcay_pc = round(stats.pcay / stats.pc, 1) || 0
    stats._ypa = round(stats.py / stats.pa, 1) || 0
    stats.pyac_pc = round(stats.pyac / stats.pc, 1) || 0
    // stats._adjypa
    stats._ypc = round(stats.py / stats.pc, 1) || 0
    // stats._ypg
    stats._pacr = round(stats.py / stats.pdot, 2) || 0
    stats.pdot_pa = round(stats.pdot / stats.pa, 1) || 0
    // stats._apacr

    stats.sk_pct = round(toPct(stats.sk / skpa), 1) || 0
    stats.qbp_pct = round(toPct(stats.qbp / skpa), 1) || 0
    stats.qbhi_pct = round(toPct(stats.qbhi / skpa), 1) || 0
    stats.qbhu_pct = round(toPct(stats.qbhu / skpa), 1) || 0
    stats._nygpa = round((stats.py - stats.sky) / skpa, 1) || 0

    stats.recy_prec = round(stats.recy / stats.rec, 1) || 0
    // stats.recy_pg

    const stray = stats.rdot / teamStats.rdot // share of teams air yards
    const sttrg = stats.trg / teamStats.trg // share of teams targets
    stats._stray = round(toPct(stray), 1) || 0
    stats._sttrg = round(toPct(sttrg), 1) || 0

    stats.dptrg_pct = round(toPct(stats.dptrg / stats.trg), 1) || 0

    // stats._ayps
    stats._ayprec = round(stats.rdot / stats.rec, 1) || 0
    stats._ayptrg = round(stats.rdot / stats.trg, 1) || 0
    stats._recypay = round(stats.recy / stats.rdot, 1) || 0
    // stats._recypsnp
    stats._recyprec = round(stats.recy / stats.rec, 1) || 0
    stats._recyptrg = round(stats.recy / stats.trg, 1) || 0
    stats._wopr = round(1.5 * sttrg + 0.7 * stray, 1) || 0
    stats._ryacprec = round(stats.ryac / stats.rec, 1) || 0

    // stats.ry_pg
    stats.ry_pra = round(stats.ry / stats.ra, 1) || 0
    stats.ryaco_pra = round(stats.ryaco / stats.ra, 1) || 0

    stats.mbt_pt = round(stats.mbt / stats._tch, 1) || 0
    stats._fumlpra = round(toPct(stats.fuml / stats.ra), 1) || 0
    stats.rasucc_pra = round(toPct(stats.rasucc / stats.ra), 1) || 0
    stats.posra_pra = round(toPct(stats.posra / stats.ra), 1) || 0

    stats._stra = round(toPct(stats.ra / teamStats.ra), 1) || 0
    stats._stry = round(toPct(stats.ry / teamStats.ry), 1) || 0

    // stats.fd_pct
    // stats.succ_psnp
  }

  return players
}

export default calculateStatsFromPlays
