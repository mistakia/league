// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const debug = require('debug')
const moment = require('moment')
const argv = require('yargs').argv

const db = require('../db')
const {
  constants,
  groupBy,
  fixTeam,
  calculateStatsFromPlayStats,
  calculateDstStatsFromPlays
} = require('../common')

const log = debug('process:play-stats')
debug.enable('process:play-stats')

const timestamp = Math.round(Date.now() / 1000)
const week = argv.week || (Math.max(moment().day() === 2
  ? (constants.season.week - 1)
  : constants.season.week, 1))

const year = constants.season.year

const upsert = async ({ player, stats, opp, pos, tm }) => {
  const exists = await db('gamelogs').where({
    player,
    week,
    year
  }).limit(1)

  const cleanedStats = Object.keys(stats)
    .filter(key => constants.fantasyStats.includes(key))
    .reduce((obj, key) => {
      obj[key] = stats[key]
      return obj
    }, {})

  if (exists.length) {
    await db('gamelogs').update({
      tm,
      ...cleanedStats
    }).where({
      player,
      week,
      year
    })
  } else {
    await db('gamelogs').insert({
      tm,
      player,
      pos,
      opp,
      week,
      year,
      ...cleanedStats
    })
  }
}

const run = async () => {
  const playStats = await db('nflPlayStat')
    .select('nflPlayStat.*', 'nflPlay.drivePlayCount', 'nflPlay.playTypeNFL', 'nflSchedule.homeTeamAbbr', 'nflSchedule.awayTeamAbbr', 'nflPlay.possessionTeam')
    .join('nflSchedule', 'nflPlayStat.esbid', '=', 'nflSchedule.esbid')
    .join('nflPlay', function () {
      this.on('nflPlay.esbid', '=', 'nflPlayStat.esbid')
      this.andOn('nflPlay.playId', '=', 'nflPlayStat.playId')
    })
    .where('nflPlay.season', year)
    .where('nflPlay.week', week)
    .where('nflPlayStat.valid', 1)

  const groups = groupBy(playStats, 'gsispid')
  const gsispids = Object.keys(groups)
  const players = await db('player').whereIn('gsispid', gsispids)
  const playerGsispids = players.map(p => p.gsispid)
  const missingGsispids = gsispids.filter(p => !playerGsispids.includes(p))
  const missing = []
  for (const gsispid of missingGsispids) {
    const playStat = groups[gsispid].find(p => p.teamid && p.playerName)
    if (!playStat) continue

    const params = {
      pname: playStat.playerName,
      cteam: constants.nflTeamIds[playStat.teamid]
    }

    const results = await db('player').where(params)

    if (results.length !== 1) {
      missing.push(params)
      continue
    }

    const player = results[0]

    if (!argv.dry) {
      await db('changelog').insert({
        type: constants.changes.PLAYER_EDIT,
        id: player.player,
        prop: 'gsispid',
        prev: player.gsispid,
        new: gsispid,
        timestamp
      })

      await db('player').update({ gsispid }).where({ player: player.player })
    }
    player.gsispid = gsispid
    players.push(player)
  }

  for (const gsispid of Object.keys(groups)) {
    const player = players.find(p => p.gsispid === gsispid)
    if (!player) continue
    if (!constants.positions.includes(player.pos)) continue

    const playStat = groups[gsispid].find(p => p.possessionTeam)
    const opp = fixTeam(playStat.possessionTeam) === fixTeam(playStat.homeTeamAbbr)
      ? fixTeam(playStat.awayTeamAbbr)
      : fixTeam(playStat.homeTeamAbbr)
    const stats = calculateStatsFromPlayStats(groups[gsispid])
    if (argv.dry) continue

    await upsert({
      player: player.player,
      pos: player.pos,
      tm: constants.nflTeamIds[playStat.teamid],
      opp,
      stats
    })
  }

  for (const team of constants.nflTeams) {
    const opponentPlays = playStats.filter(p => {
      if (fixTeam(p.homeTeamAbbr) !== team && fixTeam(p.awayTeamAbbr) !== team) {
        return false
      }

      return Boolean(p.possessionTeam) && fixTeam(p.possessionTeam) !== team
    })
    if (!opponentPlays.length) continue
    const play = opponentPlays[0]
    const opp = fixTeam(play.homeTeamAbbr) === team ? play.awayTeamAbbr : play.homeTeamAbbr
    const groupedPlays = groupBy(opponentPlays, 'playId')
    const formattedPlays = []
    for (const playId in groupedPlays) {
      const playStats = groupedPlays[playId]
      const p = playStats[0]
      formattedPlays.push({
        possessionTeam: p.possessionTeam,
        drivePlayCount: p.drivePlayCount,
        playTypeNFL: p.playTypeNFL,
        playStats
      })
    }
    const stats = calculateDstStatsFromPlays(formattedPlays, team)
    if (argv.dry) continue
    await upsert({
      player: team,
      pos: 'DST',
      tm: team,
      opp: fixTeam(opp),
      stats
    })
  }

  log(`Could not locate ${missing.length} players`)
  missing.forEach(m => log(`could not find player: ${m.pname} / ${m.cteam}`))
}

module.exports = run

const main = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.PROCESS_PLAY_STATS,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (!module.parent) {
  main()
}
