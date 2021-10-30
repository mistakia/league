const { constants, arrayToSentence, Roster } = require('../common')
const db = require('../db')
const getRoster = require('./get-roster')
const getLeague = require('./get-league')
const processRelease = require('./process-release')
const sendNotifications = require('./send-notifications')
const createConditionalPick = require('./create-conditional-pick')
const getTeam = require('./get-team')

module.exports = async function ({
  player,
  bid,
  tid,
  lid,
  userid,
  player_tid,
  uid
}) {
  // check player is on original team roster
  const isOriginalTeam = player_tid === tid
  const originalTeamRoster = await getRoster({ tid: player_tid })
  const playerRosterRow = originalTeamRoster.players.find(
    (p) => p.player === player
  )
  if (!playerRosterRow) {
    throw new Error('player no longer on original team roster')
  }

  const pos = playerRosterRow.pos
  const slot = constants.slots.BENCH
  const league = await getLeague(lid)
  const rosterRow = await getRoster({ tid })
  const roster = new Roster({ roster: rosterRow, league })

  const releases = await db('transition_releases').where('transitionid', uid)
  const cutlist = await db('league_cutlist')
    .where('tid', tid)
    .orderBy('order', 'asc')
  const releasePlayers = []

  const isValid = () =>
    roster.availableSpace >= 1 &&
    roster.availableCap >= bid &&
    roster.isEligibleForSlot({ slot, player, pos })

  if (isOriginalTeam) {
    roster.removePlayer(player)
  }

  // remove conditional releases
  if (releases.length) {
    for (const release of releases) {
      if (!roster.has(release.player)) {
        continue
      }
      roster.removePlayer(release.player)
      releasePlayers.push(release.player)
    }
  }

  while (!isValid() && cutlist.length) {
    const player = cutlist.shift()
    if (!roster.has(player.player)) {
      continue
    }

    roster.removePlayer(player.player)
    releasePlayers.push(player.player)
  }

  if (!isValid()) {
    throw new Error('exceeds roster limits')
  }

  if (!isOriginalTeam) {
    // remove player from original team roster
    await db('rosters_players')
      .del()
      .where({ rid: originalTeamRoster.uid, player })

    // add player to competing team roster
    await db('rosters_players').insert({
      rid: roster.uid,
      player,
      pos,
      slot: constants.slots.BENCH
    })

    // add conditional pick to original team
    await createConditionalPick({
      tid: player_tid,
      league
    })
  }

  // release conditional & cutlist players
  for (const player of releasePlayers) {
    await processRelease({ lid, tid, player, userid })
  }

  // create transaction
  const addTransaction = {
    userid: userid,
    tid,
    lid,
    player,
    type: constants.transactions.TRANSITION_TAG,
    value: bid,
    year: constants.season.year,
    timestamp: Math.round(Date.now() / 1000)
  }
  await db('transactions').insert(addTransaction)

  const playerIds = [player]
  releasePlayers.forEach((p) => playerIds.push(p))
  const playerRows = await db('player').whereIn('player', playerIds)
  const playerRow = playerRows.find((p) => p.player === player)
  const team = await getTeam(tid)

  // send notification
  let message = `${team.name} (${team.abbrv}) has signed restricted free agent ${playerRow.fname} ${playerRow.lname} (${playerRow.pos}) for $${bid}. `
  if (releasePlayers.length) {
    const releaseMessages = []
    for (const player of releasePlayers) {
      const releasePlayer = playerRows.find((p) => p.player === player)
      releaseMessages.push(
        `${releasePlayer.fname} ${releasePlayer.lname} (${releasePlayer.pos})`
      )
    }

    message += `${arrayToSentence(releaseMessages)} has been released.`
  }

  await sendNotifications({
    league,
    teamIds: [],
    voice: false,
    notifyLeague: true,
    message
  })
}
