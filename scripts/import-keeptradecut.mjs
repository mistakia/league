import fetch from 'node-fetch'
import { JSDOM } from 'jsdom'
import dayjs from 'dayjs'
import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#common'
import { isMain, getPlayer, wait, createPlayer, updatePlayer } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-keeptradecut')
debug.enable('import-keeptradecut,update-player,create-player')

const importPlayer = async (item) => {
  let player
  const dob = item.birthday
    ? dayjs.unix(item.birthday).format('YYYY-MM-DD')
    : null
  try {
    player = await getPlayer({ keeptradecut_id: item.playerID })
    if (!player) {
      player = await getPlayer({
        name: item.playerName,
        pos: item.position,
        team: item.team,
        dob
      })
    }
  } catch (err) {
    log(err)
    return null
  }

  if (!player) {
    player = await createPlayer({
      fname: item.playerName.split(' ').shift(),
      lname: item.playerName.substr(item.playerName.indexOf(' ') + 1),
      dob,
      start: item.draftYear,

      pos: item.position,
      pos1: item.position,
      posd: item.position,

      cteam: item.team,
      jnum: item.number,

      height: item.heightFeet * 12 + item.heightInches,
      weight: item.weight,

      col: item.college,

      keeptradecut_id: item.playerID
    })
  } else {
    await updatePlayer({
      player,
      update: { keeptradecut_id: item.playerID }
    })
  }

  return player
}

const importKeepTradeCut = async ({ full = false, dry = false } = {}) => {
  const url = 'https://keeptradecut.com/dynasty-rankings/history'
  const data = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }).then((res) => res.json())

  log(`Processing ${data.length} players`)

  for (const item of data) {
    if (!constants.positions.includes(item.position)) continue

    const player = await importPlayer(item)
    if (!player) continue

    const inserts = []

    if (full) {
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

    if (dry) {
      log(`${item.playerName} values: ${inserts.length}`)
      log(inserts[0])
      continue
    }

    await db('keeptradecut_rankings').insert(inserts).onConflict().ignore()

    if (full) await wait(4000)
  }
}

const main = async () => {
  let error
  try {
    await importKeepTradeCut({ full: argv.full, dry: argv.dry })
  } catch (err) {
    error = err
    log(err)
  }

  await db('jobs').insert({
    type: constants.jobs.IMPORT_KEEPTRADECUT,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default importKeepTradeCut
