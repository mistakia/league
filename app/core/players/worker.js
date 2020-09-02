import {
  constants,
  weightProjections,
  calculatePoints,
  calculateBaselines,
  calculateValues,
  calculatePrices,
  getRosterSize,
  Roster
} from '@common'

export function calculatePlayerValues (payload) {
  const { userId, vorpw, volsw, league, players, rosterRows } = payload
  const customBaselines = payload.baselines

  const rows = []
  for (let i = 0; i < league.nteams; i++) {
    rows.push(rosterRows[i] || { players: [] })
  }

  const rosteredPlayerIds = []
  const rosters = []
  for (const rosterRow of rows) {
    const roster = new Roster({ roster: rosterRow, league })
    roster.players.forEach(p => rosteredPlayerIds.push(p.player))
    rosters.push(roster)
  }

  const { nteams, cap, minBid } = league
  const rosterSize = getRosterSize(league)
  const leagueTotalCap = (nteams * cap) - (nteams * rosterSize * minBid)
  const leagueAvailableCap = rosters.reduce((s, r) => {
    return s + (r.availableCap - (minBid * r.availableSpace))
  }, 0)

  for (const player of players) {
    const { projections } = player

    player.projection = {}
    for (let week = 0; week <= constants.season.finalWeek; week++) {
      const projection = weightProjections({
        projections,
        weights: payload.sources,
        userId,
        week
      })
      player.projection[week] = projection

      // calculate points based on projection
      const points = calculatePoints({ stats: projection, position: player.pos1, league })
      player.points[week] = points
      player.vorp[week] = {}
      player.values[week] = {}
    }

    // calculate ros projection
    const ros = {}
    let projWks = 0
    for (const [week, projection] of Object.entries(player.projection)) {
      if (week && week !== '0' && week >= constants.season.week) {
        projWks += 1
        for (const [key, value] of Object.entries(projection)) {
          if (ros[key]) {
            ros[key] += value
          } else {
            ros[key] = value
          }
        }
      }
    }

    player.projWks = projWks
    player.projection.ros = ros
    player.points.ros = calculatePoints({ stats: ros, position: player.pos1, league })
  }

  const baselines = {}
  for (let week = 0; week <= constants.season.finalWeek; week++) {
    // calculate baseline
    const b = calculateBaselines({ players, league, rosterRows, week })

    // set manual baselines if they exist, use starter baseline by default
    for (const pos in b) {
      if (customBaselines[pos] && customBaselines[pos].manual) {
        b[pos].manual = players.find(p => p.player === customBaselines[pos].manual)
      } else {
        b[pos].manual = b[pos].starter
      }
    }

    baselines[week] = b

    // calculate values
    const total = calculateValues({ players, baselines: b, vorpw, volsw, week })
    calculatePrices({ cap: leagueTotalCap, total, players, week })
  }

  // calculate ros vorp
  const total = {
    available: 0,
    starter: 0,
    average: 0,
    hybrid: 0,
    bench: 0,
    manual: 0
  }

  const availableTotalsRestOfSeason = {
    available: 0,
    starter: 0,
    average: 0,
    hybrid: 0,
    bench: 0,
    manual: 0
  }

  const availableTotalsSeason = {
    available: 0,
    starter: 0,
    average: 0,
    hybrid: 0,
    bench: 0,
    manual: 0
  }

  for (const player of players) {
    const ros = {}
    const isAvailable = !rosteredPlayerIds.includes(player.player)
    for (const [week, vorp] of Object.entries(player.vorp)) {
      if (week && week >= constants.season.week) {
        for (const [key, value] of Object.entries(vorp)) {
          if (value < 0) {
            if (!ros[key]) ros[key] = 0
            continue
          }

          if (ros[key]) {
            ros[key] += value
          } else {
            ros[key] = value
          }

          total[key] += value

          // if player is availble add to inflation
          if (isAvailable) {
            availableTotalsRestOfSeason[key] += value
          }
        }
      }
    }
    if (isAvailable) {
      for (const [type, value] of Object.entries(player.vorp['0'])) {
        if (value > 0) {
          availableTotalsSeason[type] += value
        }
      }
    }
    player.vorp.ros = ros
  }

  // calculate ros contract value
  calculatePrices({ cap: leagueTotalCap, total, players, week: 'ros' })

  // calculate ros inflation prices
  const rate = {}
  for (const type in availableTotalsRestOfSeason) {
    rate[type] = availableTotalsRestOfSeason[type] ? leagueAvailableCap / availableTotalsRestOfSeason[type] : 0
  }

  const seasonRate = {}
  for (const type in availableTotalsSeason) {
    seasonRate[type] = availableTotalsSeason[type] ? leagueAvailableCap / availableTotalsSeason[type] : 0
  }

  for (const player of players) {
    player.values.inflation = {}
    for (const type in rate) {
      if (!rate[type]) {
        player.values.inflation[type] = player.values.ros[type]
        continue
      }
      const value = Math.round(rate[type] * player.vorp.ros[type])
      player.values.inflation[type] = value > 0 ? value : 0
    }

    player.values.inflationSeason = {}
    for (const type in seasonRate) {
      if (!seasonRate[type]) {
        player.values.inflationSeason[type] = player.values[0][type]
        continue
      }
      const value = Math.round(seasonRate[type] * player.vorp['0'][type])
      player.values.inflationSeason[type] = value > 0 ? value : 0
    }
  }

  return { baselines: baselines, players }
}
