const dayjs = require('dayjs')
const advancedFormat = require('dayjs/plugin/advancedFormat')

const db = require('../db')

const { constants, Roster, isSantuaryPeriod } = require('../common')
const sendNotifications = require('./send-notifications')
const getRoster = require('./get-roster')
const getLeague = require('./get-league')

dayjs.extend(advancedFormat)

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
  const league = await getLeague(leagueId)
  if (!league) {
    throw new Error('invalid leagueId')
  }

  // verify player is on a practice squad
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
  const playerTid = slots[0].tid

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

  // verify it is not Regular Season or Free Agency Sanctuary Period
  if (isSantuaryPeriod(league)) {
    throw new Error('Santuary period')
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

  // TODO - verify team does not have any tied up cap in a pending poach

  // verify release player is not used in a pending poach
  if (release.length) {
    const pendingPoachReleases = await db('poach_releases')
      .select('poach_releases.player')
      .join('poaches', 'poach_releases.poachid', 'poaches.uid')
      .whereNull('processed')
      .where('tid', teamId)
    const pendingPoachReleasePlayers = pendingPoachReleases.map((p) => p.player)
    for (const player of release) {
      if (pendingPoachReleasePlayers.includes(player)) {
        throw new Error('release player used in another poach')
      }
    }
  }

  const data = {
    userid: userId,
    tid: teamId,
    lid: leagueId,
    player_tid: playerTid,
    player,
    submitted: Math.round(Date.now() / 1000)
  }
  const rows = await db('poaches').insert(data)
  const poachid = rows[0]
  const releaseInserts = release.map((player) => ({ poachid, player }))
  if (releaseInserts.length) {
    await db('poach_releases').insert(releaseInserts)
  }

  const message = `${team.name} has submitted a poaching claim for ${
    poachPlayer.fname
  } ${poachPlayer.lname} (${
    poachPlayer.pos
  }). This claim will be processed around ${constants.season.now
    .add('48', 'hours')
    .format('dddd, MMMM Do h:mm a')} EST.`
  await sendNotifications({
    league,
    teamIds: [],
    voice: true,
    notifyLeague: true,
    message
  })

  return {
    uid: poachid,
    release,
    ...data
  }
}
