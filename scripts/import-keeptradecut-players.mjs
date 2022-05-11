import debug from 'debug'
import fetch from 'node-fetch'

import db from '#db'
import { constants } from '#common'
import { isMain, getPlayer, updatePlayer } from '#utils'

const log = debug('import-ktc-players')
debug.enable('import-ktc-players,update-player')

const run = async () => {
  const url = 'https://keeptradecut.com/dynasty-rankings/history'
  const data = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }).then((res) => res.json())

  const missing = []
  let editCount = 0
  for (const item of data) {
    const params = {
      keeptradecut_id: item.playerID,
      name: item.playerName,
      team: item.team,
      pos: item.position
    }
    let player

    try {
      player = await getPlayer(params)
      if (!player) {
        missing.push(params)
        continue
      }
    } catch (err) {
      console.log(err)
      missing.push(params)
      continue
    }

    const edits = await updatePlayer({
      player,
      update: { keeptradecut_id: item.playerID }
    })
    editCount += edits
  }

  missing.forEach((m) =>
    log(
      `no match: ${m.name} / ${m.pos} / ${m.team} (KTC ID: ${m.keeptradecut_id}`
    )
  )

  log(`Updated: ${editCount}, Unmatched: ${missing.length}`)
}

const main = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.PLAYERS_KEEPTRADECUT,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain()) {
  main()
}

export default run
