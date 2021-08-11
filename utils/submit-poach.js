const dayjs = require('dayjs')
const API = require('groupme').Stateless

const db = require('../db')

const { constants, Roster } = require('../common')
const sendNotifications = require('./send-notifications')
const getRoster = require('./get-roster')

module.exports = async function ({
  leagueId,
  release = [],
  player,
  teamId,
  team,
  userId
}) {
  // verify player and release ids
  const playerIds = [player]
  if (release.length) {
    release.forEach((player) => playerIds.push(player))
  }
  const playerRows = await db('player').whereIn('player', playerIds)
  if (playerRows.length !== playerIds.length) {
    throw new Error('could not find playerIds')
  }
  const poachPlayer = playerRows.find((p) => p.player === player)

  // verify leagueId
  const leagues = await db('leagues').where({ uid: leagueId })
  if (!leagues.length) {
    throw new Error('invalid leagueId')
  }

  // verify player is on a practice squad
  const league = leagues[0]
  const slots = await db('rosters_players')
    .join('rosters', 'rosters_players.rid', 'rosters.uid')
    .where({
      lid: leagueId,
      week: constants.season.week,
      year: constants.season.year,
      player,
      slot: constants.slots.PS
    })
  if (!slots.length) {
    throw new Error('player is not in an unprotected practice squad slot')
  }

  // verify no existing poaches exist
  const poaches = await db('poaches').where({ player }).whereNull('processed')
  if (poaches.length) {
    throw new Error('player has existing poaching claim')
  }

  // verify poaching team roster has bench space
  const rosterRow = await getRoster({ tid: teamId })
  const roster = new Roster({ roster: rosterRow, league })
  if (release.length) {
    for (const player of release) {
      if (!roster.has(player)) {
        throw new Error('invalid release player, not on roster')
      }
      roster.removePlayer(player)
    }
  }
  const hasSlot = roster.hasOpenBenchSlot(poachPlayer.pos)
  if (!hasSlot) {
    throw new Error('poaching claim unsuccessful, no available roster space')
  }

  // verify team has enough cap if during the offseason
  const transactions = await db('transactions')
    .where({ player, lid: leagueId })
    .orderBy('timestamp', 'desc')
    .orderBy('uid', 'desc')
    .limit(1)
  const tran = transactions[0]
  const playerPoachValue = tran.value + 2
  if (
    !constants.season.isRegularSeason &&
    roster.availableCap - playerPoachValue < 0
  ) {
    throw new Error('not enough available cap')
  }

  const data = {
    userid: userId,
    tid: teamId,
    lid: leagueId,
    player,
    submitted: Math.round(Date.now() / 1000)
  }
  const rows = await db('poaches').insert(data)
  const releaseInserts = release.map((player) => ({ poachid: rows[0], player }))
  await db('poach_releases').insert(releaseInserts)

  const message = `${team.name} has submitted a poaching claim for ${
    poachPlayer.fname
  } ${poachPlayer.lname} (${
    poachPlayer.pos
  }). This claim will be processed around ${dayjs()
    .utcOffset(-4)
    .add('48', 'hours')
    .format('dddd, MMMM Do h:mm a')} EST.`
  await sendNotifications({
    leagueId: league.uid,
    teamIds: [],
    voice: true,
    league: true,
    message
  })

  if (league.groupme_token && league.groupme_id) {
    await API.Bots.post.Q(league.groupme_token, league.groupme_id, message, {})
  }

  return data
}
