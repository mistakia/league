import {
  calculateStatsFromPlays,
  groupBy,
  uniqBy,
  constants,
  calculatePercentiles,
  weightProjections,
  calculatePoints,
  calculateBaselines,
  calculateValues,
  calculatePrices,
  getRosterSize,
  getOptimizerPositionConstraints,
  Roster,
  optimizeStandingsLineup
} from '@common'
import gaussian from 'gaussian'
import solver from 'javascript-lp-solver'

export function calculateStats(params) {
  return calculateStatsFromPlays(params)
}

export function calculateTeamPercentiles(teams) {
  const grouped = groupBy(teams, 'seas')
  const percentiles = {}

  for (const group in grouped) {
    percentiles[group] = calculatePercentiles({
      items: grouped[group],
      stats: constants.teamStats
    })
  }

  return percentiles
}

export function processTeamGamelogs(gamelogs) {
  return calculatePercentiles({
    items: gamelogs,
    stats: constants.teamStats
  })
}

export function calculatePlayerValues(payload) {
  const currentWeek = constants.season.week
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
    roster.players.forEach((p) => rosteredPlayerIds.push(p.player))
    rosters.push(roster)
  }

  const { nteams, cap, minBid } = league
  const rosterSize = getRosterSize(league)
  const leagueTotalCap = nteams * cap - nteams * rosterSize * minBid
  const leagueAvailableCap = rosters.reduce((s, r) => {
    return s + (r.availableCap - minBid * r.availableSpace)
  }, 0)

  const finalWeek = constants.season.finalWeek
  for (const player of players) {
    const { projections } = player

    player.projection = {}
    for (let week = 0; week <= finalWeek; week++) {
      const projection = weightProjections({
        projections,
        weights: payload.sources,
        userId,
        week
      })
      player.projection[week] = projection

      // calculate points based on projection
      const points = calculatePoints({
        stats: projection,
        position: player.pos,
        league
      })
      player.points[week] = points
      player.vorp[week] = {}
      player.values[week] = {}
    }

    // calculate ros projection
    const ros = constants.createStats()
    let projWks = 0
    for (const [week, projection] of Object.entries(player.projection)) {
      if (week && week !== '0' && week >= currentWeek) {
        projWks += 1
        for (const [key, value] of Object.entries(projection)) {
          ros[key] += value
        }
      }
    }

    player.projWks = projWks
    player.projection.ros = ros
    player.points.ros = calculatePoints({
      stats: ros,
      position: player.pos,
      league
    })
  }

  const baselines = {}
  for (let week = 0; week <= finalWeek; week++) {
    // calculate baseline
    const b = calculateBaselines({ players, league, rosterRows, week })

    // set manual baselines if they exist, use starter baseline by default
    for (const pos in b) {
      if (customBaselines[pos] && customBaselines[pos].manual) {
        b[pos].manual = players.find(
          (p) => p.player === customBaselines[pos].manual
        )
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
    default: 0,
    available: 0,
    starter: 0,
    average: 0,
    hybrid: 0,
    manual: 0
  }

  const availableTotalsRestOfSeason = {
    default: 0,
    available: 0,
    starter: 0,
    average: 0,
    hybrid: 0,
    manual: 0
  }

  const availableTotalsSeason = {
    default: 0,
    available: 0,
    starter: 0,
    average: 0,
    hybrid: 0,
    manual: 0
  }

  for (const player of players) {
    const ros = {}
    const isAvailable = !rosteredPlayerIds.includes(player.player)
    for (const [week, vorp] of Object.entries(player.vorp)) {
      if (week && week >= currentWeek) {
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
    rate[type] = availableTotalsRestOfSeason[type]
      ? leagueAvailableCap / availableTotalsRestOfSeason[type]
      : 0
  }

  const seasonRate = {}
  for (const type in availableTotalsSeason) {
    seasonRate[type] = availableTotalsSeason[type]
      ? leagueAvailableCap / availableTotalsSeason[type]
      : 0
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

const average = (data) => data.reduce((sum, value) => sum + value) / data.length
const standardDeviation = (values) =>
  Math.sqrt(average(values.map((value) => (value - average(values)) ** 2)))

export function calculateStandings({
  league,
  tids,
  starters,
  active,
  gamelogs,
  matchups
}) {
  const currentWeek = constants.season.week
  const result = {}
  for (const tid of tids) {
    result[tid] = {
      tid,
      gamelogs: [],
      games: {},
      points: {
        weeks: {}
      },
      stats: constants.createFantasyTeamStats(),
      potentialPoints: {},
      potentialPointsPenalty: {}
    }

    result[tid].stats.pmin = 99999
  }

  const minStarters =
    league.sqb +
    league.srb +
    league.swr +
    league.ste +
    league.srbwr +
    league.srbwrte +
    league.sqbrbwrte +
    league.swrte +
    league.sdst +
    league.sk

  for (let week = 1; week < currentWeek; week++) {
    for (const tid of tids) {
      const startingPlayers = starters[week][tid]
      const starterIds = startingPlayers.map((p) => p.player)
      let total = 0
      result[tid].games[week] = {}
      const optimizePlayers = []
      for (const { player, pos } of active[week][tid]) {
        const gamelog = gamelogs.find(
          (g) => g.week === week && g.player === player
        )
        if (!gamelog) {
          continue
        }

        result[tid].gamelogs.push(gamelog)
        const points = calculatePoints({
          stats: gamelog,
          position: pos,
          league
        })
        result[tid].games[week][player] = points.total
        if (starterIds.includes(player)) {
          const starter = startingPlayers.find((p) => p.player === player)
          total = points.total + total
          result[tid].stats[`pPos${pos}`] += points.total
          result[tid].stats[`pSlot${starter.slot}`] += points.total
        }
        optimizePlayers.push({
          player,
          pos,
          points: points.total
        })
      }

      // calculate optimal lineup
      const optimizeResult = optimizeStandingsLineup({
        players: optimizePlayers,
        league
      })
      if (optimizeResult.starters.length < minStarters) {
        result[tid].potentialPointsPenalty[week] = true
      }
      result[tid].potentialPoints[week] = optimizeResult.total
      result[tid].stats.pp += optimizeResult.total

      if (result[tid].stats.pmax < total) result[tid].stats.pmax = total
      if (result[tid].stats.pmin > total) result[tid].stats.pmin = total

      result[tid].points.weeks[week] = total
      result[tid].stats.pf += total
    }
  }

  for (let week = 1; week < currentWeek; week++) {
    const weekMatchups = matchups.filter((m) => m.week === week)
    for (const m of weekMatchups) {
      const homeScore = result[m.hid].points.weeks[week]
      const awayScore = result[m.aid].points.weeks[week]

      const pHomeScore = result[m.hid].potentialPoints[week]
      const pAwayScore = result[m.aid].potentialPoints[week]

      result[m.hid].stats.pa += awayScore
      result[m.aid].stats.pa += homeScore

      if (homeScore > awayScore) {
        result[m.hid].stats.wins += 1
        result[m.aid].stats.losses += 1

        if (pAwayScore > homeScore) {
          result[m.aid].stats.pw += 1
          result[m.hid].stats.pl += 1
        }
      } else if (homeScore < awayScore) {
        result[m.hid].stats.losses += 1
        result[m.aid].stats.wins += 1

        if (pHomeScore > awayScore) {
          result[m.hid].stats.pw += 1
          result[m.aid].stats.pl += 1
        }
      } else {
        result[m.hid].stats.ties += 1
        result[m.aid].stats.ties += 1
      }
    }

    // calculate all play record

    for (const tid of tids) {
      const scores = Object.values(result)
        .filter((p) => p.tid !== tid)
        .map((p) => p.points.weeks[week])
      const score = result[tid].points.weeks[week]
      result[tid].stats.apWins += scores.filter((p) => p < score).length
      result[tid].stats.apLosses += scores.filter((p) => p > score).length
      result[tid].stats.apTies += scores.filter((p) => p === score).length

      if (result[tid].potentialPointsPenalty[week]) {
        const pps = Object.values(result).map((p) => p.potentialPoints[week])
        const max = Math.max(...pps)
        result[tid].stats.ppp += max - result[tid].potentialPoints[week]
      }
    }
  }

  // calculate draft order
  const potentialPoints = Object.values(result).map(
    (p) => p.stats.pp + p.stats.ppp
  )
  const allPlayLosses = Object.values(result).map((p) => p.stats.apLosses)
  const minPP = Math.min(...potentialPoints)
  const maxPP = Math.max(...potentialPoints)
  const minAPL = Math.min(...allPlayLosses)
  const maxAPL = Math.max(...allPlayLosses)
  for (const tid of tids) {
    const pp = result[tid].stats.pp + result[tid].stats.ppp
    const apl = result[tid].stats.apLosses
    const normPP = (pp - minPP) / (maxPP - minPP)
    const normAPL = (apl - minAPL) / (maxAPL - minAPL)
    result[tid].stats.doi = 9 * normPP + normAPL

    const points = Object.values(result[tid].points.weeks)
    result[tid].stats.pdev = points.length ? standardDeviation(points) : null
    result[tid].stats.pdiff = result[tid].stats.pf - result[tid].stats.pa
    result[tid].stats.pp_pct =
      (result[tid].stats.pf / result[tid].stats.pp) * 100
  }

  const percentiles = calculatePercentiles({
    items: Object.values(result).map((t) => t.stats),
    stats: constants.fantasyTeamStats
  })

  return { teams: result, percentiles }
}

const SIMULATIONS = 10000

export function simulate({ teams, matchups, rosters }) {
  const result = {}

  for (const tid in rosters) {
    result[tid] = {
      tid: rosters[tid].tid,
      wildcards: 0,
      wildcardAppearances: 0,
      byes: 0,
      championships: 0,
      championshipAppearances: 0,
      divisionWins: 0,
      playoffAppearances: 0
    }
  }

  const distributions = {}
  for (const matchup of matchups) {
    const home = rosters[matchup.hid].lineups[matchup.week]
    const away = rosters[matchup.aid].lineups[matchup.week]

    // TODO - use individual player probability curves
    // TODO - calculate team std dev based on history
    const dist = {}
    dist.home = gaussian(home.total, Math.pow(15, 2))
    dist.away = gaussian(away.total, Math.pow(15, 2))
    distributions[matchup.uid] = dist
  }

  for (let i = 0; i < SIMULATIONS; i++) {
    const standings = {}
    for (const tid in rosters) {
      standings[tid] = {
        div: teams[tid].div,
        tid,
        wins: 0,
        losses: 0,
        ties: 0,
        pointsFor: 0,
        pointsAgainst: 0
      }
    }

    for (const matchup of matchups) {
      const dist = distributions[matchup.uid]
      const homeScore = dist.home.random(1)[0]
      const awayScore = dist.away.random(1)[0]

      standings[matchup.hid].pointsFor += homeScore
      standings[matchup.aid].pointsFor += awayScore

      if (homeScore > awayScore) {
        // home team win
        standings[matchup.hid].wins += 1
        standings[matchup.aid].losses += 1
      } else if (awayScore > homeScore) {
        // away team win
        standings[matchup.aid].wins += 1
        standings[matchup.hid].losses += 1
      } else if (awayScore === homeScore) {
        // tie
        standings[matchup.hid].ties += 1
        standings[matchup.aid].ties += 1
      }
    }

    // process standings, combine with current standings
    for (const tid in rosters) {
      const team = teams[tid]
      standings[tid].wins += team.stats.wins
      standings[tid].losses += team.stats.losses
      standings[tid].ties += team.stats.ties
      standings[tid].pointsFor += team.stats.pf
    }

    // determine division winners
    const divisions = groupBy(Object.values(standings), 'div')
    const divisionWinners = []
    for (const teams of Object.values(divisions)) {
      const sorted = teams.sort(
        (a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor
      )
      divisionWinners.push(sorted[0])
    }
    const sortedDivisionWinners = divisionWinners.sort(
      (a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor
    )
    const byeTeams = sortedDivisionWinners.slice(0, 2)
    const divisionWinnerIds = divisionWinners.map((t) => t.tid)

    // determine wildcard winners
    const wildcardRanks = Object.values(standings)
      .filter((t) => !divisionWinnerIds.includes(t.tid))
      .sort((a, b) => b.pointsFor - a.pointsFor)
    const wildcardWinners = wildcardRanks.slice(0, 2)

    // determine playoff teams
    const wildcardTeams = wildcardWinners.concat(
      sortedDivisionWinners.slice(2, 4)
    )
    const playoffTeams = byeTeams.concat(wildcardTeams)

    // record results
    divisionWinners.forEach((t) => {
      result[t.tid].divisionWins += 1
    })
    wildcardWinners.forEach((t) => {
      result[t.tid].wildcards += 1
    })
    playoffTeams.forEach((t) => {
      result[t.tid].playoffAppearances += 1
    })
    wildcardTeams.forEach((t) => {
      result[t.tid].wildcardAppearances += 1
    })
    byeTeams.forEach((t) => {
      result[t.tid].byes += 1
    })

    // TODO simulate playoffs

    // TODO record wildcard winners
    // TODO record championship teams

    // TODO calculate draft order

    // TODO save result
  }

  // process simulation results
  // TODO championship appearance
  // TODO championship win
  // TODO draft order
  for (const [tid, team] of Object.entries(result)) {
    result[tid].playoffOdds = team.playoffAppearances / SIMULATIONS
    result[tid].divisionOdds = team.divisionWins / SIMULATIONS
    result[tid].byeOdds = team.byes / SIMULATIONS
  }

  return result
}

function rollup(group) {
  const stats = {
    total: [],
    avg: []
  }

  for (const gamelogs of Object.values(group)) {
    const t = sum(gamelogs, constants.fantasyStats)
    const weeks = uniqBy(gamelogs, 'week').length
    stats.avg.push(avg(t, constants.fantasyStats, weeks))
    stats.total.push(t)
  }

  const percentiles = {}
  for (const type in stats) {
    percentiles[type] = calculatePercentiles({
      items: stats[type],
      stats: constants.fantasyStats
    })
  }

  return {
    stats,
    percentiles
  }
}

const copy = ({ opp, tm }) => ({ opp, tm })

const sum = (items = [], keys = []) => {
  const r = copy(items[0])
  for (const key of keys) {
    r[key] = items.reduce((acc, item) => acc + item[key], 0)
  }
  return r
}

const avg = (item, props, num) => {
  const obj = copy(item)
  for (const prop of props) {
    obj[prop] = item[prop] / num
  }
  return obj
}

const adj = (actual, average, props) => {
  const obj = copy(actual)
  for (const prop of props) {
    obj[prop] = actual[prop] - average[prop]
  }
  return obj
}

export function processPlayerGamelogs(gamelogs) {
  const positions = groupBy(gamelogs, 'pos')

  const defense = {}
  const offense = {}
  const individual = {}

  for (const position in positions) {
    const glogs = positions[position]

    const defenseGroups = groupBy(glogs, 'opp')
    defense[position] = rollup(defenseGroups)

    const offenseGroups = groupBy(glogs, 'tm')
    offense[position] = rollup(offenseGroups)

    const adjusted = []
    for (const team of constants.nflTeams) {
      // get defense gamelogs
      const gs = defenseGroups[team]
      // group by week
      const weekGroups = groupBy(gs, 'week')
      const weeks = []
      for (const logs of Object.values(weekGroups)) {
        // sum week
        const gamelog = sum(logs, constants.fantasyStats)
        // get offense (opponent) average
        const offenseAverage = offense[position].stats.avg.find(
          (g) => g.tm === gamelog.tm
        )
        // calculate difference (adjusted)
        const adjusted = adj(gamelog, offenseAverage, constants.fantasyStats)
        weeks.push(adjusted)
      }
      const total = sum(weeks, constants.fantasyStats, weeks.length)
      adjusted.push(avg(total, constants.fantasyStats, weeks.length))
    }

    defense[position].stats.adj = adjusted
    defense[position].percentiles.adj = calculatePercentiles({
      items: adjusted,
      stats: constants.fantasyStats
    })

    individual[position] = calculatePercentiles({
      items: glogs,
      stats: constants.fantasyStats
    })
  }

  return {
    offense,
    defense,
    individual
  }
}

export function optimizeLineup({ players, league }) {
  const results = {}
  const positions = players.map((p) => p.pos)
  const constraints = getOptimizerPositionConstraints({ positions, league })

  const finalWeek = constants.season.finalWeek
  for (
    let week = Math.max(constants.season.week, 1);
    week <= finalWeek;
    week++
  ) {
    const variables = {}
    const ints = {}

    for (const player of players) {
      variables[player.player] = {
        points: Math.round(
          (player.points[week] && player.points[week].total) || 0
        ),
        starter: 1
      }
      variables[player.player][player.player] = 1
      constraints[player.player] = { max: 1 }
      ints[player.player] = 1
      for (const pos of constants.positions) {
        variables[player.player][pos] = player.pos === pos ? 1 : 0
      }
    }

    const model = {
      optimize: 'points',
      opType: 'max',
      constraints,
      variables,
      ints
    }

    const result = solver.Solve(model)
    const starters = Object.keys(result).filter(
      (r) =>
        r.match(/^([A-Z]{2,})-([0-9]{4,})$/gi) || r.match(/^([A-Z]{1,3})$/gi)
    )

    results[week] = {
      total: result.result,
      starters
    }
  }

  return results
}

export function optimizeAuctionLineup({
  limits = {},
  players,
  vbaseline,
  league,
  active = [],
  valueType = '0'
}) {
  const variables = {}
  const ints = {}

  const pool = players.concat(active)
  const positions = pool.map((p) => p.pos)
  const positionConstraints = getOptimizerPositionConstraints({
    positions,
    league
  })
  const constraints = {
    value: { max: Math.round(league.cap * 0.9) },
    ...positionConstraints,
    ...limits
  }

  const addPlayer = ({ player, freeAgent }) => {
    variables[player.player] = {
      points: Math.round(player.points[valueType].total || 0),
      starter: 1
    }
    variables[player.player][player.player] = 1
    // variables[player.player][player.pos] = 1
    if (constraints[player.player]) {
      constraints[player.player].max = 1
    } else {
      constraints[player.player] = { max: 1 }
    }
    ints[player.player] = 1
    for (const pos of constants.positions) {
      variables[player.player][pos] = player.pos === pos ? 1 : 0
    }

    if (freeAgent) {
      variables[player.player].fa = 1
      variables[player.player].value = Math.round(
        player.values[valueType][vbaseline] || 0
      )
    }
  }

  active.forEach((player) => addPlayer({ player, freeAgent: false }))
  players.forEach((player) => addPlayer({ player, freeAgent: true }))

  const model = {
    optimize: 'points',
    opType: 'max',
    constraints,
    variables,
    ints
  }

  return solver.Solve(model)
}
