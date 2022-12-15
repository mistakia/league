import * as constants from './constants.mjs'

const round = (value, precision) => {
  const multiplier = Math.pow(10, precision || 0)
  return Math.round(value * multiplier) / multiplier
}

const toPct = (value) => value * 100

// TODO - stats should be grouped by game to account for players who switched teams during the season
const calculateStatsFromPlays = (plays) => {
  const players = {}
  const teams = {}

  // TODO - handle player on multiple teamns
  const initialize_player_stats = (pid, off, def) => {
    if (players[pid]) return

    players[pid] = constants.create_full_stats()

    players[pid].off = off
    players[pid].def = def

    players[pid].tm = off
    players[pid].opp = def
  }

  const initialize_team_stats = (off, def) => {
    if (teams[off]) return

    teams[off] = constants.create_full_stats()

    teams[off].off = off
    teams[off].def = def

    teams[off].tm = off
    teams[off].opp = def
  }

  const add_stat = ({ pid, stat, value, play }) => {
    if (!pid) return
    value = Number(value)

    if (isNaN(value)) {
      // TODO log warning
      return
    }

    // TODO record longest rushing, receiving, passing play
    // TODO count big plays
    // TODO situational splits (i.e. # of defenders in box)
    const { off, def } = play
    initialize_player_stats(pid, off, def)
    initialize_team_stats(off, def)
    players[pid][stat] += value
    teams[off][stat] += value
  }

  const add_rush_stats = (play) => {
    add_stat({ pid: play.bc, stat: 'ra', value: 1, play })
    add_stat({ pid: play.bc, stat: 'ry', value: play.yds, play })
    if (play.yaco)
      add_stat({ pid: play.bc, stat: 'ryaco', value: play.yaco, play })
    if (play.fd) {
      add_stat({ pid: play.bc, stat: 'fd', value: 1, play })
      add_stat({ pid: play.bc, stat: 'rfd', value: 1, play })
    }
    if (play.succ) {
      add_stat({ pid: play.bc, stat: 'succ', value: 1, play })
      add_stat({ pid: play.bc, stat: 'rasucc', value: 1, play })
    }
    if (play.mbt) add_stat({ pid: play.bc, stat: 'mbt', value: play.mbt, play })
    if (play.yds > 0) add_stat({ pid: play.bc, stat: 'posra', value: 1, play })
    if (play.fd) add_stat({ pid: play.bc, stat: 'rfd', value: 1, play })
    if (play.td) add_stat({ pid: play.bc, stat: 'tdr', value: 1, play })
  }

  const add_pass_stats = (play) => {
    // passer
    if (play.succ) {
      add_stat({ pid: play.psr, stat: 'pasucc', value: 1, play })
      add_stat({ pid: play.psr, stat: 'succ', value: 1, play })
    }
    if (play.dot) {
      add_stat({ pid: play.psr, stat: 'pdot', value: play.dot, play })
    }
    if (play.qbp) add_stat({ pid: play.psr, stat: 'qbp', value: 1, play })
    if (play.qbhi) add_stat({ pid: play.psr, stat: 'qbhi', value: 1, play })
    if (play.qbhu) add_stat({ pid: play.psr, stat: 'qbhu', value: 1, play })
    if (play.high) add_stat({ pid: play.psr, stat: 'high', value: 1, play })
    if (play.intw) add_stat({ pid: play.psr, stat: 'intw', value: 1, play })
    if (play.drp) {
      add_stat({ pid: play.psr, stat: 'drp_pa', value: 1, play })
      add_stat({ pid: play.psr, stat: 'drp_py', value: play.dot, play })
    }

    // receiver
    if (play.trg) {
      add_stat({ pid: play.trg, stat: 'trg', value: 1, play })
      add_stat({ pid: play.trg, stat: 'rdot', value: play.dot, play })
      if (play.dot >= 20)
        add_stat({ pid: play.trg, stat: 'deep_trg', value: 1, play })
      if (play.cnb) add_stat({ pid: play.trg, stat: 'cnb', value: 1, play })
      if (play.drp) {
        add_stat({ pid: play.trg, stat: 'drp', value: 1, play })
        add_stat({ pid: play.trg, stat: 'drprecy', value: play.dot, play })
      }
    }

    if (play.intp) {
      add_stat({ pid: play.psr, stat: 'ints', value: 1, play })
    } else if (play.comp && play.trg) {
      // TODO deprecate - temp fix for missing trg
      // receiver
      add_stat({ pid: play.trg, stat: 'rec', value: 1, play })
      add_stat({ pid: play.trg, stat: 'recy', value: play.yds, play })
      add_stat({ pid: play.trg, stat: 'ryac', value: play.yac, play })
      add_stat({ pid: play.trg, stat: 'rcay', value: play.dot, play })
      if (play.mbt)
        add_stat({ pid: play.trg, stat: 'mbt', value: play.mbt, play })

      // passer
      add_stat({ pid: play.psr, stat: 'pa', value: 1, play })
      add_stat({ pid: play.psr, stat: 'py', value: play.yds, play })
      add_stat({ pid: play.psr, stat: 'pc', value: 1, play })
      add_stat({ pid: play.psr, stat: 'pcay', value: play.dot, play })
      if (play.yac)
        add_stat({ pid: play.psr, stat: 'pyac', value: play.yac, play })

      if (play.succ) add_stat({ pid: play.trg, stat: 'succ', value: 1, play })
      if (play.fd) {
        add_stat({ pid: play.psr, stat: 'fd', value: 1, play })
        add_stat({ pid: play.trg, stat: 'fd', value: 1, play })
      }

      if (play.td) {
        add_stat({ pid: play.psr, stat: 'tdp', value: 1, play })
        add_stat({ pid: play.trg, stat: 'tdrec', value: 1, play })
      }
    } else if (play.sk) {
      add_stat({ pid: play.psr, stat: 'sk', value: 1, play })
      add_stat({
        pid: play.psr,
        stat: 'sky',
        value: Math.abs(play.yds),
        play
      })
    } else {
      add_stat({ pid: play.psr, stat: 'pa', value: 1, play })
    }
  }

  const add_kick_stats = (play) => {
    if (play.fga) {
      add_stat({ pid: play.kick_player, stat: 'fga', value: 1, play })
      if (play.score_type === 'FG') {
        add_stat({ pid: play.kick_player, stat: 'fgm', value: 1, play })

        // minimum of 30 yards
        const kick_yards = Math.max(30, play.kick_distance)
        add_stat({
          pid: play.kick_player,
          stat: 'fgy',
          value: kick_yards,
          play
        })

        if (play.kick_distance <= 19) {
          add_stat({ pid: play.kick_player, stat: 'fg19', value: 1, play })
        } else if (play.kick_distance <= 29) {
          add_stat({ pid: play.kick_player, stat: 'fg29', value: 1, play })
        } else if (play.kick_distance <= 39) {
          add_stat({ pid: play.kick_player, stat: 'fg39', value: 1, play })
        } else if (play.kick_distance <= 49) {
          add_stat({ pid: play.kick_player, stat: 'fg49', value: 1, play })
        } else if (play.kick_distance >= 50) {
          add_stat({ pid: play.kick_player, stat: 'fg50', value: 1, play })
        }
      }
    } else if (play.xpa) {
      add_stat({ pid: play.kick_player, stat: 'xpa', value: 1, play })

      if (play.score_type === 'PAT') {
        add_stat({ pid: play.kick_player, stat: 'xpm', value: 1, play })
      }
    }
  }

  const add_two_point_conversion_stats = (play) => {
    if (play.score_type === 'PAT2') {
      if (play.psr) {
        add_stat({ pid: play.psr, stat: 'twoptc', value: 1, play })
      }
      if (play.trg) {
        add_stat({ pid: play.trg, stat: 'twoptc', value: 1, play })
      }
      if (play.bc) {
        add_stat({ pid: play.bc, stat: 'twoptc', value: 1, play })
      }
    }
  }

  plays.forEach((play) => {
    if (play.fuml) {
      add_stat({ pid: play.player_fuml, stat: 'fuml', value: 1, play })
    }

    // TODO register snaps

    switch (play.type) {
      case 'RUSH': {
        add_rush_stats(play)
        break
      }

      case 'PASS': {
        add_pass_stats(play)
        break
      }

      case 'FGXP': {
        add_kick_stats(play)
        break
      }

      case 'CONV': {
        add_two_point_conversion_stats(play)
        break
      }
    }
  })

  const calculate_derived_stats = (stats, team_stats) => {
    const skpa = stats.sk + stats.pa

    stats.tch = stats.ra + stats.rec

    stats.pc_pct = round(toPct(stats.pc / stats.pa), 1) || 0
    // stats.py_pg

    stats.tdp_pct = round(toPct(stats.tdp / stats.pa), 1) || 0
    stats.ints_pct = round(toPct(stats.ints / stats.pa), 1) || 0

    stats.intw_pct = round(toPct(stats.intw / stats.pa), 1) || 0
    stats.pcay_pc = round(stats.pcay / stats.pc, 1) || 0
    stats.py_pa = round(stats.py / stats.pa, 1) || 0
    stats.pyac_pc = round(stats.pyac / stats.pc, 1) || 0
    stats.py_pc = round(stats.py / stats.pc, 1) || 0
    stats.pacr = round(stats.py / stats.pdot, 2) || 0
    stats.pdot_pa = round(stats.pdot / stats.pa, 1) || 0
    // stats.apacr

    stats.sk_pct = round(toPct(stats.sk / skpa), 1) || 0
    stats.qbp_pct = round(toPct(stats.qbp / skpa), 1) || 0
    stats.qbhi_pct = round(toPct(stats.qbhi / skpa), 1) || 0
    stats.qbhu_pct = round(toPct(stats.qbhu / skpa), 1) || 0
    stats.nyg_pa = round((stats.py - stats.sky) / skpa, 1) || 0

    // stats.recy_pg

    stats.deep_trg_pct = round(toPct(stats.deep_trg / stats.trg), 1) || 0

    // stats.ay_snp
    stats.ay_rec = round(stats.rdot / stats.rec, 1) || 0
    stats.ay_trg = round(stats.rdot / stats.trg, 1) || 0
    stats.recy_ay = round(stats.recy / stats.rdot, 1) || 0
    // stats.recy_snp
    stats.recy_rec = round(stats.recy / stats.rec, 1) || 0
    stats.recy_trg = round(stats.recy / stats.trg, 1) || 0
    stats.yac_rec = round(stats.ryac / stats.rec, 1) || 0

    // stats.ry_pg
    stats.ry_ra = round(stats.ry / stats.ra, 1) || 0
    stats.ryaco_ra = round(stats.ryaco / stats.ra, 1) || 0

    stats.mbt_pt = round(stats.mbt / stats.tch, 1) || 0
    stats.fuml_ra = round(toPct(stats.fuml / stats.ra), 1) || 0
    stats.rasucc_ra = round(toPct(stats.rasucc / stats.ra), 1) || 0
    stats.posra_ra = round(toPct(stats.posra / stats.ra), 1) || 0

    // stats.fd_pct
    // stats.succ_psnp

    if (team_stats) {
      const stray = stats.rdot / team_stats.pdot // share of teams air yards
      const sttrg = stats.trg / team_stats.trg // share of teams targets
      stats.tm_ay_share = round(toPct(stray), 1) || 0
      stats.tm_trg_share = round(toPct(sttrg), 1) || 0
      stats.wopr = round(1.5 * sttrg + 0.7 * stray, 1) || 0

      stats.tm_ra_share = round(toPct(stats.ra / team_stats.ra), 1) || 0
      stats.tm_ry_share = round(toPct(stats.ry / team_stats.ry), 1) || 0
    }
  }

  for (const pid in players) {
    const stats = players[pid]
    const nfl_team = stats.off
    const team_stats = teams[nfl_team]

    calculate_derived_stats(stats, team_stats)
  }

  for (const pid in teams) {
    const stats = teams[pid]
    calculate_derived_stats(stats)
  }

  return { players, teams }
}

export default calculateStatsFromPlays
