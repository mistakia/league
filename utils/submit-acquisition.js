const API = require('groupme').Stateless
const moment = require('moment')

const db = require('../db')

const { constants, Roster } = require('../common')
const sendNotifications = require('./send-notifications')
const getRoster = require('./get-roster')
const isPlayerOnWaivers = require('./is-player-on-waivers')
const processRelease = require('./process-release')

module.exports = async function ({
  leagueId,
  drop,
  player,
  teamId,
  bid = 0,
  userId,
  slot = constants.slots.BENCH
}) {
  const type = slot === constants.slots.BENCH ? constants.transactions.ROSTER_ADD
    : constants.transactions.PRACTICE_ADD

  // verify player and drop ids
  const playerIds = [player]
  if (drop) playerIds.push(drop)
  const playerRows = await db('player').whereIn('player', playerIds)
  const playerRow = playerRows.find(p => p.player === player)
  if (!playerRow) {
    throw new Error('invalid player')
  }
  let dropPlayerRow
  if (drop) {
    dropPlayerRow = playerRows.find(p => p.player === drop)
    if (!dropPlayerRow) {
      throw new Error('invalid drop')
    }
  }

  // verify leagueId
  const leagues = await db('leagues').where({ uid: leagueId }).limit(1)
  if (!leagues.length) {
    throw new Error('invalid leagueId')
  }

  const teams = await db('teams').where({ uid: teamId }).limit(1)
  const team = teams[0]

  if (team.faab - bid < 0) {
    throw new Error('exceeds available free agent auction budget')
  }

  // verify player is a free agent
  const league = leagues[0]
  const rosters = await db('rosters_players')
    .join('rosters', 'rosters_players.rid', 'rosters.uid')
    .where({
      lid: leagueId,
      week: constants.season.week,
      year: constants.season.year,
      player
    }).limit(1)
  if (rosters.length) {
    throw new Error('player is not a free agent')
  }

  // verify no veterans are signed in the offseason & the rookie draft is complete
  if (!constants.season.isRegularSeason) {
    if (playerRow.start !== constants.season.year) {
      throw new Error('veteran free agency not open')
    }

    // verify rookie draft is complete
    const totalPicks = league.nteams * 3
    if (!league.ddate || moment().isBefore(moment(league.ddate, 'X').add(totalPicks, 'day'))) {
      throw new Error('rookie free agency not open')
    }
  }

  // verify player is not on waivers - dropped in the last 24 hours excluding cycling
  const isOnWaivers = await isPlayerOnWaivers({ player, leagueId })
  if (isOnWaivers) {
    throw new Error('player is on waivers')
  }

  // verify team has bench space & passes roster constraints
  const rosterRow = await getRoster({
    tid: teamId,
    week: constants.season.week,
    year: constants.season.year
  })
  const roster = new Roster({ roster: rosterRow, league })
  if (drop) {
    if (!roster.has(drop)) {
      throw new Error('invalid drop')
    }

    roster.removePlayer(drop)
  }

  const hasSlot = roster.isEligibleForSlot({ slot, player, pos: playerRow.pos1 })
  if (!hasSlot) {
    throw new Error('exceeds roster limits')
  }

  const result = []

  // process release
  if (drop) {
    const releaseData = await processRelease({
      player: drop,
      tid: teamId,
      lid: leagueId,
      useris: userId
    })
    result.push(releaseData)
  }

  // add player to roster
  await db('rosters_players').insert({
    rid: roster.uid,
    player,
    pos: playerRow.pos1,
    slot
  })

  // add player transaction
  const addTransaction = {
    userid: userId,
    tid: teamId,
    lid: leagueId,
    player,
    type,
    value: bid,
    year: constants.season.year,
    timestamp: Math.round(Date.now() / 1000)
  }
  await db('transactions').insert(addTransaction)

  result.push({
    player: player,
    slot,
    rid: roster.uid,
    pos: playerRow.pos1,
    transaction: addTransaction
  })

  // send notification
  let message = `${team.name} (${team.abbrv}) has signed free agent ${playerRow.fname} ${playerRow.lname} (${playerRow.pos1}) for ${bid}.`
  if (drop) {
    message += ` ${dropPlayerRow.fname} ${dropPlayerRow.lname} (${dropPlayerRow.pos1}) has been released.`
  }
  await sendNotifications({
    leagueId: league.uid,
    teamIds: [],
    voice: false,
    league: true,
    message
  })

  if (league.groupme_token && league.groupme_id) {
    await API.Bots.post.Q(league.groupme_token, league.groupme_id, message, {})
  }

  return result
}
