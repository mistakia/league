// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const argv = require('yargs').argv
const diff = require('deep-diff')

const db = require('../db')
const { readCSV } = require('../utils')
const { constants } = require('../common')

const formatCSV = (row) => {
  return {
    player: row.player,
    fname: row.fname,
    lname: row.lname,
    pname: row.pname,
    pos1: row.pos1,
    pos2: row.pos2,
    height: parseInt(row.height, 10) || null,
    weight: parseInt(row.weight, 10) || null,
    dob: row.dob,
    forty: parseFloat(row.forty) || null,
    bench: parseInt(row.bench, 10) || null,
    vertical: parseFloat(row.vertical) || null,
    broad: parseInt(row.broad, 10) || null,
    shuttle: parseFloat(row.shuttle, 10) || null,
    cone: parseFloat(row.cone) || null,
    arm: parseFloat(row.arm) || null,
    hand: parseFloat(row.hand) || null,
    dpos: parseInt(row.dpos, 10) || 0,
    col: row.col,
    dv: row.dv,
    start: parseInt(row.start, 10) || null,
    cteam: row.cteam,
    posd: row.posd,
    jnum: parseInt(row.jnum, 10) || 0,
    dcp: parseInt(row.dcp, 10) || 0
  }
}

const run = async () => {
  // read csv file
  const filepath = argv.file
  if (!filepath) {
    throw new Error('missing --file')
  }

  const timestamp = Math.round(Date.now() / 1000)
  const rows = await readCSV(filepath)

  const playerIds = rows.map((p) => p.player)

  const currentPlayers = await db('player').whereIn('player', playerIds)
  const currentPlayerIds = currentPlayers.map((p) => p.player)

  for (const player of currentPlayers) {
    const row = rows.find((r) => r.player === player.player)
    const formatted = formatCSV(row)
    const differences = diff(player, formatted)

    const edits = differences.filter((d) => d.kind === 'E')
    if (edits.length) {
      for (const edit of edits) {
        const prop = edit.path[0]
        try {
          await db('player')
            .update({
              [prop]: edit.rhs
            })
            .where({
              player: player.player
            })

          await db('changelog').insert({
            type: constants.changes.PLAYER_EDIT,
            id: player.player,
            prop,
            prev: edit.lhs,
            new: edit.rhs,
            timestamp
          })
        } catch (err) {
          console.log(err)
        }
      }
    }
  }

  const missingPlayerIds = playerIds.filter(
    (p) => !currentPlayerIds.includes(p)
  )

  for (const missingPlayerId of missingPlayerIds) {
    const row = rows.find((r) => r.player === missingPlayerId)
    const formatted = formatCSV(row)
    try {
      await db('player').insert({
        pos: row.pos1,
        ...formatted
      })

      await db('changelog').insert({
        type: constants.changes.PLAYER_NEW,
        id: row.player,
        timestamp
      })
    } catch (err) {
      console.log(err)
    }
  }
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
    type: constants.jobs.PLAYERS_ARMCHAIR,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (!module.parent) {
  main()
}
