import * as constants from './constants'

const round = (value, precision) => {
  var multiplier = Math.pow(10, precision || 0)
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

  const addStat = (playerId, stat, value) => {
    value = parseInt(value, 10)
    // TODO record longest rushing, receiving, passing play
    // TODO count big plays
    // TODO situational splits (i.e. # of defenders in box)
    players[playerId] = players[playerId] || constants.createFullStats()
    players[playerId][stat] += value
  }

  plays.forEach((play) => {
    if (play.fuml) {
      addStat(play.fum, 'fuml', 1)
      playerToTeam[play.fum] = play.off
    }

    switch (play.type) {
      case 'RUSH': {
        playerToTeam[play.bc] = play.off
        addTeamStat(play.off, 'ra', 1)
        addTeamStat(play.off, 'ry', play.yds)
        addStat(play.bc, 'ra', 1)
        addStat(play.bc, 'ry', play.yds)
        addStat(play.bc, 'ryaco', play.yaco)
        if (play.fd) {
          addStat(play.bc, 'fd', 1)
          addStat(play.bc, 'rfd', 1)
        }
        if (play.succ) {
          addStat(play.bc, 'succ', 1)
          addStat(play.bc, 'rasucc', 1)
        }
        if (play.mbt) addStat(play.bc, 'mbt', play.mbt)
        if (play.yds > 0) addStat(play.bc, 'posra', 1)
        if (play.fd) addStat(play.bc, 'rfd', 1)
        if (play.pts >= 6) addStat(play.bc, 'tdr', 1)
        break
      }

      case 'PASS': {
        // passer
        playerToTeam[play.psr] = play.off
        if (play.succ) {
          addStat(play.psr, 'psucc', 1)
          addStat(play.psr, 'succ', 1)
        }
        if (play.dot) addStat(play.psr, 'pdot', play.dot)
        if (play.tay) {
          addStat(play.psr, 'ptay', play.tay)
          addTeamStat(play.off, 'rtay', play.tay)
        }
        if (play.qbp) addStat(play.psr, 'qbp', 1)
        if (play.qbhi) addStat(play.psr, 'qbhi', 1)
        if (play.qbhu) addStat(play.psr, 'qbhu', 1)
        if (play.high) addStat(play.psr, 'high', 1)
        if (play.intw) addStat(play.psr, 'intw', 1)
        if (play.drp) {
          addStat(play.psr, 'drpp', 1)
          addStat(play.psr, 'drppy', play.tay)
        }

        // receiver
        if (play.trg) {
          playerToTeam[play.trg] = play.off
          addTeamStat(play.off, 'trg', 1)
          addStat(play.trg, 'trg', 1)
          addStat(play.trg, 'rdot', play.dot)
          addStat(play.trg, 'rtay', play.tay)
          if (play.tay >= 20) addStat(play.trg, 'dptrg', 1)
          if (play.cnb) addStat(play.trg, 'cnb', 1)
          if (play.drp) {
            addStat(play.trg, 'drp', 1)
            addStat(play.trg, 'drprecy', play.tay)
          }
        }

        if (play.ints) {
          addStat(play.psr, 'ints', 1)
        } else if (play.comp === 'Y') {
          // receiver
          addStat(play.trg, 'rec', 1)
          addStat(play.trg, 'recy', play.yds)
          addStat(play.trg, 'ryac', play.yac)
          addStat(play.trg, 'rcay', play.tay)
          if (play.mbt) addStat(play.trg, 'mbt', play.mbt)

          // passer
          addStat(play.psr, 'pa', 1)
          addStat(play.psr, 'py', play.yds)
          addStat(play.psr, 'pc', 1)
          addStat(play.psr, 'pcay', play.tay)
          if (play.yac) addStat(play.psr, 'pyac', play.yac)

          if (play.succ) addStat(play.trg, 'succ', 1)
          if (play.fd) {
            addStat(play.psr, 'fd', 1)
            addStat(play.trg, 'fd', 1)
          }

          if (play.pts >= 6) {
            addStat(play.psr, 'tdp', 1)
            addStat(play.trg, 'tdrec', 1)
          }
        } else if (play.sk1) {
          addStat(play.psr, 'sk', 1)
          addStat(play.psr, 'sky', play.yds)
        } else {
          addStat(play.psr, 'pa', 1)
        }
      }
    }
  })

  for (const player in players) {
    const stats = players[player]
    const team = playerToTeam[player]
    const teamStats = teams[team]

    const skpa = stats.sk + stats.pa

    stats._tch = stats.ra + stats.rec

    stats.pc_pct = round(toPct(stats.pc / stats.pa), 1) || 0
    // stats.py_pg

    stats.tdp_pct = round(toPct(stats.tdp / stats.pa), 1) || 0
    stats.ints_pct = round(toPct(stats.ints / stats.pa), 1) || 0

    stats.intw_pct = round(toPct(stats.intw / stats.pa), 1) || 0
    stats.pcay_pc = round(stats.pcay / stats.pc, 1) || 0
    stats._ypa = round(stats.py / stats.pa, 1) || 0
    stats._aypa = round(stats.ptay / stats.pa, 1) || 0
    // stats._adjypa
    stats._ypc = round(stats.py / stats.pc, 1) || 0
    // stats._ypg
    stats._pacr = round(stats.py / stats.ptay, 2) || 0
    stats.pdot_pa = round(stats.pdot / stats.pa, 1) || 0
    // stats._apacr

    stats.sk_pct = round(toPct(stats.sk / skpa), 1) || 0
    stats.qbp_pct = round(toPct(stats.qbp / skpa), 1) || 0
    stats.qbhi_pct = round(toPct(stats.qbhi / skpa), 1) || 0
    stats.qbhu_pct = round(toPct(stats.qbhu / skpa), 1) || 0
    stats._nygpa = round((stats.py - stats.sky) / skpa, 1) || 0

    stats.recy_prec = round(stats.recy / stats.rec, 1) || 0
    // stats.recy_pg

    const strtay = stats.rtay / teamStats.rtay
    const sttrg = stats.trg / teamStats.trg
    stats._strtay = round(toPct(strtay), 1) || 0
    stats._sttrg = round(toPct(sttrg), 1) || 0

    stats.dptrg_pct = round(toPct(stats.dptrg / stats.trg), 1) || 0
    stats.rdot_ptrg = round(stats.rdot / stats.trg, 1) || 0

    // stats._ayps
    stats._ayprec = round(stats.rtay / stats.rec, 1) || 0
    stats._ayptrg = round(stats.rtay / stats.trg, 1) || 0
    stats._recypay = round(stats.recy / stats.rtay, 1) || 0
    // stats._recypsnp
    stats._recyprec = round(stats.recy / stats.rec, 1) || 0
    stats._recyptrg = round(stats.recy / stats.trg, 1) || 0
    stats._wopr = round((1.5 * sttrg) + (0.7 * strtay), 1) || 0
    stats._ryacprec = round(stats.ryac / stats.rec, 1) || 0

    // stats.ry_pg
    stats.ry_pra = round(stats.ry / stats.ra, 1) || 0
    stats.ryaco_pra = round(stats.ryaco / stats.ra, 1) || 0

    stats.mbt_pt = round(toPct(stats.mbt / (stats.ra + stats.rec)), 1) || 0
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
