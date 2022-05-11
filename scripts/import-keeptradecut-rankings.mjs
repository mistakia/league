import fetch from 'node-fetch'
import { JSDOM } from 'jsdom'
import dayjs from 'dayjs'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#common'
import { isMain, getPlayer, wait } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-ktc-rankings')
debug.enable('import-ktc-rankings')

const run = async () => {
  const url = 'https://keeptradecut.com/dynasty-rankings/history'
  const data = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }).then((res) => res.json())

  log(`Processing ${data.length} players`)

  for (const item of data) {
    const player = await getPlayer({ keeptradecut_id: item.playerID })
    if (!player) continue

    const inserts = []

    if (argv.full) {
      const html = await fetch(
        `https://keeptradecut.com/dynasty-rankings/players/${item.slug}`
      ).then((res) => res.text())

      const dom = new JSDOM(html, { runScripts: 'dangerously' })
      dom.window.playerOneQB.overallValue.forEach((i) => {
        inserts.push({
          qb: 1,
          player: player.player,
          d: dayjs(i.d, 'YYYY-MM-DD').unix(),
          v: i.v,
          type: constants.KEEPTRADECUT.VALUE
        })
      })

      dom.window.playerOneQB.overallRankHistory.forEach((i) => {
        inserts.push({
          qb: 1,
          player: player.player,
          d: dayjs(i.d, 'YYYY-MM-DD').unix(),
          v: i.v,
          type: constants.KEEPTRADECUT.OVERALL_RANK
        })
      })

      dom.window.playerOneQB.positionalRankHistory.forEach((i) => {
        inserts.push({
          qb: 1,
          player: player.player,
          d: dayjs(i.d, 'YYYY-MM-DD').unix(),
          v: i.v,
          type: constants.KEEPTRADECUT.POSITION_RANK
        })
      })

      dom.window.playerSuperflex.overallValue.forEach((i) => {
        inserts.push({
          qb: 2,
          player: player.player,
          d: dayjs(i.d, 'YYYY-MM-DD').unix(),
          v: i.v,
          type: constants.KEEPTRADECUT.VALUE
        })
      })

      dom.window.playerSuperflex.overallRankHistory.forEach((i) => {
        inserts.push({
          qb: 2,
          player: player.player,
          d: dayjs(i.d, 'YYYY-MM-DD').unix(),
          v: i.v,
          type: constants.KEEPTRADECUT.OVERALL_RANK
        })
      })

      dom.window.playerSuperflex.positionalRankHistory.forEach((i) => {
        inserts.push({
          qb: 2,
          player: player.player,
          d: dayjs(i.d, 'YYYY-MM-DD').unix(),
          v: i.v,
          type: constants.KEEPTRADECUT.POSITION_RANK
        })
      })
    } else {
      item.oneQBValues.history.forEach((i) => {
        inserts.push({
          qb: 1,
          player: player.player,
          d: dayjs(i.d, 'YYYY-MM-DD').unix(),
          v: i.v,
          type: constants.KEEPTRADECUT.VALUE
        })
      })

      item.superflexValues.history.forEach((i) => {
        inserts.push({
          qb: 2,
          player: player.player,
          d: dayjs(i.d, 'YYYY-MM-DD').unix(),
          v: i.v,
          type: constants.KEEPTRADECUT.VALUE
        })
      })
    }

    if (argv.dry) {
      log(`${item.playerName} values: ${inserts.length}`)
      log(inserts[0])
      continue
    }

    await db('keeptradecut_rankings').insert(inserts).onConflict().ignore()

    if (argv.full) await wait(4000)
  }
}

const main = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.EXAMPLE,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (isMain()) {
  main()
}

export default run
