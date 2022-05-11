import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { Table } from 'console-table-printer'

import db from '#db'
import { constants } from '#common'
import { isMain } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('draw-divisions')
debug.enable('draw-divisions')

const run = async ({ lid }) => {
  log(`Drawing divisions for leagueId: ${lid}`)
  const teams = await db('teams').where({ lid })
  const tids = teams.map((t) => t.uid)

  // get team stats for last three years
  const cutoff = constants.season.year - 3
  const teamStats = await db('team_stats')
    .where('year', '>=', cutoff)
    .whereIn('tid', tids)

  const wins = teamStats.map((t) => t.wins)
  const minWin = Math.min(...wins)
  const maxWin = Math.max(...wins)

  const pfs = teamStats.map((t) => t.pf)
  const maxPf = Math.max(...pfs)
  const minPf = Math.min(...pfs)

  const powerIndexes = []
  for (const teamStat of teamStats) {
    const team = teams.find((t) => t.uid === teamStat.tid)
    const normWins = (teamStat.wins - minWin) / (maxWin - minWin)
    const normPf = (teamStat.pf - minPf) / (maxPf - minPf)
    powerIndexes.push({
      tid: teamStat.tid,
      name: team.name,
      powerIndex: normWins + normPf
    })
  }

  const sorted = powerIndexes.sort((a, b) => b.powerIndex - a.powerIndex)
  const poolLimit = 4
  const pools = []
  while (sorted.length > 0) {
    pools.push(sorted.splice(0, poolLimit))
  }

  if (argv.print) {
    pools.forEach((pool, index) => {
      const p = new Table()
      console.log(`Pool ${index + 1}`)
      for (const team of pool) {
        p.addRow({
          team: team.name,
          PowerIndex: team.powerIndex.toFixed(2)
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

    for (const team of division) {
      await db('teams').update({ div }).where({ uid: team.tid })
    }

    if (argv.print) {
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
    }

    await run({ lid })
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

if (isMain()) {
  main()
}
