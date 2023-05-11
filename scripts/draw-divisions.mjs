import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { Table } from 'console-table-printer'

import db from '#db'
import { constants, sum } from '#common'
import { isMain } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('draw-divisions')
debug.enable('draw-divisions')

const run = async ({ lid, print = true, dry_run = false }) => {
  log(`Drawing divisions for leagueId: ${lid}`)
  const teams = await db('teams').where({ lid, year: constants.season.year })
  if (!teams.length) {
    log(`No teams found for leagueId: ${lid}`)
    return
  }

  const tids = teams.map((t) => t.uid)

  // get team stats for last three years
  const cutoff = constants.season.year - 3
  const teamStats = await db('team_stats')
    .where('year', '>=', cutoff)
    .whereIn('tid', tids)

  let maxPf = 0
  let minPf = Infinity
  let maxWin = 0
  let minWin = Infinity

  for (const team of teams) {
    const stats = teamStats.filter((t) => t.tid === team.uid)
    team.wins = sum(stats.map((s) => s.wins))
    team.losses = sum(stats.map((s) => s.losses))
    team.pf = sum(stats.map((s) => s.pf))

    if (team.wins > maxWin) maxWin = team.wins
    if (team.wins < minWin) minWin = team.wins
    if (team.pf > maxPf) maxPf = team.pf
    if (team.pf < minPf) minPf = team.pf
  }

  const powerIndexes = []
  for (const team of teams) {
    const normWins = (team.wins - minWin) / (maxWin - minWin)
    const normPf = (team.pf - minPf) / (maxPf - minPf)
    powerIndexes.push({
      tid: team.uid,
      name: team.name,
      powerIndex: normWins + normPf,
      wins: team.wins,
      pf: team.pf
    })
  }

  const sorted = powerIndexes.sort((a, b) => b.powerIndex - a.powerIndex)
  const poolLimit = 4
  const pools = []
  while (sorted.length > 0) {
    pools.push(sorted.splice(0, poolLimit))
  }

  if (print) {
    pools.forEach((pool, index) => {
      const p = new Table()
      console.log(`Pool ${index + 1}`)
      for (const team of pool) {
        p.addRow({
          team: team.name,
          PowerIndex: team.powerIndex.toFixed(2),
          Wins: team.wins,
          PF: Math.floor(team.pf)
        })
      }
      p.printTable()
    })
  }

  for (let i = 0; i < 4; i++) {
    const div = i + 1
    const division = []
    for (const pool of pools) {
      const team = pool.splice(Math.floor(Math.random() * pool.length), 1)
      division.push(team[0])
    }

    if (!dry_run) {
      for (const team of division) {
        await db('teams')
          .update({ div })
          .where({ uid: team.tid, year: constants.season.year })
      }
    }

    if (print) {
      console.log(`Division ${div}`)
      const p = new Table()
      for (const team of division) {
        p.addRow({
          team: team.name,
          PowerIndex: team.powerIndex.toFixed(2)
        })
      }
      p.printTable()
    }
  }
}

export default run

const main = async () => {
  let error
  try {
    const lid = argv.lid
    if (!lid) {
      console.log('missing --lid')
      process.exit()
    }

    await run({ lid, print: argv.print, dry_run: argv.dry })
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.DRAW_DIVISIONS,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}
