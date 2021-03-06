const API = require('groupme').Stateless
const dayjs = require('dayjs')

const db = require('../db')

const { constants, Roster } = require('../common')
const sendNotifications = require('./send-notifications')
const getRoster = require('./get-roster')
const isPlayerOnWaivers = require('./is-player-on-waivers')
const processRelease = require('./process-release')
const isPlayerLocked = require('./is-player-locked')

module.exports = async function ({
  leagueId,
  drop,
  player,
  teamId,
  bid = 0,
  userId,
  slot = constants.slots.BENCH
}) {
  const type =
    slot === constants.slots.BENCH
      ? constants.transactions.ROSTER_ADD
      : constants.transactions.PRACTICE_ADD

  // verify player and drop ids
  const playerIds = [player]
  if (drop) playerIds.push(drop)
  const playerRows = await db('player').whereIn('player', playerIds)
  const playerRow = playerRows.find((p) => p.player === player)
  if (!playerRow) {
    throw new Error('invalid player')
  }
  let dropPlayerRow
  if (drop) {
    dropPlayerRow = playerRows.find((p) => p.player === drop)
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
    })
    .limit(1)
  if (rosters.length) {
    throw new Error('player is not a free agent')
  }

  // verify player is not locked
  const isLocked = await isPlayerLocked(player)
  if (isLocked) {
    throw new Error('player is locked, game has started')
  }

  // verify no veterans are signed in the offseason & the rookie draft is complete
  if (!constants.season.isRegularSeason) {
    if (playerRow.start !== constants.season.year) {
      throw new Error('veteran free agency not open')
    }

    // verify rookie draft is complete
    const days = league.nteams * 3 + 1 // total picks + waiver day
    if (
      !league.ddate ||
      dayjs().isBefore(dayjs.unix(league.ddate).add(days, 'day'))
    ) {
      throw new Error('rookie free agency not open')
    }
  }

  // verify player is not on waivers - dropped in the last 24 hours excluding cycling
  const isOnWaivers = await isPlayerOnWaivers({ player, leagueId })
  if (isOnWaivers) {
    throw new Error('player is on waivers')
  }

  // verify player is practice squad eligible (rookie, not on a team, or on a PS)
  if (type === constants.transactions.PRACTICE_ADD) {
    if (
      playerRow.start !== constants.season.year &&
      playerRow.posd !== 'PS' &&
      playerRow.cteam !== 'INA'
    ) {
      throw new Error('player is not practice squad eligible')
    }
  }

  // verify team has bench space & passes roster constraints
  const rosterRow = await getRoster({ tid: teamId })
  const roster = new Roster({ roster: rosterRow, league })
  let dropPlayer
  if (drop) {
    dropPlayer = roster.get(drop)
    if (!dropPlayer) {
      throw new Error('invalid drop')
    }

    if (dropPlayer.slot !== constants.slots.PSP) {
      roster.removePlayer(drop)
    }
  }

  const hasSlot = roster.isEligibleForSlot({ slot, player, pos: playerRow.pos })
  if (!hasSlot) {
    throw new Error('exceeds roster limits')
  }

  const result = []

  // process release
  if (dropPlayer && dropPlayer.slot !== constants.slots.PSP) {
    const releaseData = await processRelease({
      player: drop,
      tid: teamId,
      lid: leagueId,
      userid: userId
    })
    result.push(releaseData)
  }

  // add player to roster
  await db('rosters_players').insert({
    rid: roster.uid,
    player,
    pos: playerRow.pos,
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
    pos: playerRow.pos,
    transaction: addTransaction
  })

  // send notification
  let message = `${team.name} (${team.abbrv}) has signed free agent ${playerRow.fname} ${playerRow.lname} (${playerRow.pos}) for $${bid}.`
  if (drop) {
    message += ` ${dropPlayerRow.fname} ${dropPlayerRow.lname} (${dropPlayerRow.pos}) has been released.`
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
