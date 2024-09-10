import fetch from 'node-fetch'
import debug from 'debug'

import db from '#db'
import config from '#config'
import * as cache from './cache.mjs'
import { constants, fixTeam } from '#libs-shared'

const log = debug('ngs')

export const getCurrentPlayers = async ({
  ignore_cache = false,
  season = constants.season.year
}) => {
  const cache_key = `/ngs/current_players/${season}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(`cache hit for ngs current players for season: ${season}`)
      return cache_value
    }
  }

  const url = `${config.ngs_api_url}/league/roster/current?teamId=ALL`
  log(`fetching ngs current players for season: ${season}`)
  const res = await fetch(url, {
    headers: { referer: 'https://nextgenstats.nfl.com/' }
  })
  const data = await res.json()

  if (data && data.teamPlayers.length) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}

export const getPlayer = async ({ ignore_cache = false, gsis_it_id } = {}) => {
  if (!gsis_it_id) {
    return
  }

  const cache_key = `/ngs/player/${gsis_it_id}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(`cache hit for ngs player with gsis_it_id: ${gsis_it_id}`)
      return cache_value
    }
  }

  const url = `${config.ngs_api_url}/league/player?nflId=${gsis_it_id}`
  log(`fetching ngs player with gsis_it_id: ${gsis_it_id}`)
  const res = await fetch(url, {
    headers: { referer: 'https://nextgenstats.nfl.com/' }
  })
  const data = await res.json()

  if (data && data.displayName) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}

export const getPlays = async ({ ignore_cache = false, esbid } = {}) => {
  if (!esbid) {
    return
  }

  const cache_key = `/ngs/plays/${esbid}.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(`cache hit for ngs game with esbid: ${esbid}`)
      return cache_value
    }
  }

  log(`fetching ngs game with esbid: ${esbid}`)
  const url = `${config.ngs_api_url}/live/plays/playlist/game?gameId=${esbid}`
  const res = await fetch(url, {
    headers: {
      origin: 'https://nextgenstats.nfl.com',
      referer: 'https://nextgenstats.nfl.com/stats/game-center'
    }
  })
  const data = await res.json()

  if (data && data.gameId) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}

export const get_highlight_players = async ({ ignore_cache = false }) => {
  const cache_key = `/ngs/highlight_players.json`
  if (!ignore_cache) {
    const cache_value = await cache.get({ key: cache_key })
    if (cache_value) {
      log(`cache hit for ngs highlight players`)
      return cache_value
    }
  }

  const url = `${config.ngs_api_url}/plays/highlight/players`
  log(`fetching ngs highlight players`)
  const res = await fetch(url, {
    headers: {
      origin: 'https://nextgenstats.nfl.com',
      referer: 'https://nextgenstats.nfl.com/stats/game-center'
    }
  })
  const data = await res.json()

  if (data && data.players && data.players.length) {
    await cache.set({ key: cache_key, value: data })
  }

  return data
}

export const format_play_data = (play) => {
  const data = {
    sequence: play.sequence,
    state: play.playState,
    dwn: play.down,
    home_score: play.homeScore,
    special: play.isSTPlay,
    score: play.isScoring,
    desc: play.playDescription,
    play_type_ngs: play.playType,
    pos_team_id: play.possessionTeamId,
    qtr: play.quarter,
    year: play.season,
    // seas_type: play.seasonType,
    away_score: play.visitorScore,
    week: play.week,
    ydl_num: play.yardlineNumber,
    yards_to_go: play.yardsToGo,
    off_formation: play.offense ? play.offense.offenseFormation : null,
    off_personnel: play.offense ? play.offense.personnel : null,
    box_ngs: play.defense ? play.defense.defendersInTheBox : null,
    pru_ngs: play.defense ? play.defense.numberOfPassRushers : null,
    def_personnel: play.defense ? play.defense.personnel : null,
    game_clock_start: play.gameClockStart,
    game_clock_end: play.gameClockEnd,
    qb_pressure_ngs: play.passInfo ? play.passInfo.wasPressure : null,
    air_yards_ngs: play.passInfo ? play.passInfo.airYards : null,
    time_to_throw_ngs: play.passInfo ? play.passInfo.timeToThrow : null,
    route_ngs: play.recInfo ? play.recInfo.route : null,
    man_zone_ngs: play.defense ? play.defense.manZoneType : null,
    cov_type_ngs: play.defense ? play.defense.coverageType : null
  }

  if (play.possessionTeam) {
    data.pos_team = fixTeam(play.possessionTeam)
  }

  if (play.yardlineSide) {
    data.ydl_side = fixTeam(play.yardlineSide)
  }

  if (play.ydl_num) {
    if (play.ydl_num === 50) {
      data.ydl_100 = 50
    } else if (data.pos_team && data.ydl_side) {
      data.ydl_100 =
        data.ydl_side === data.pos_team ? 100 - data.ydl_num : data.ydl_num
    }
  }

  return data
}

export const format_play_stat_data = (playStat) => ({
  yards: playStat.yards,
  clubCode: playStat.clubCode ? fixTeam(playStat.clubCode) : null,
  gsisId: playStat.gsisId,
  playerName: playStat.playerName
})

export const save_play_data = async ({ data, esbid }) => {
  const timestamp = Math.round(Date.now() / 1000)
  const play_inserts = []
  const play_stat_inserts = []
  const snap_inserts = []

  const seas_type = data.plays.find((play) => play.seasonType)?.seasonType
  const year = data.plays.find((play) => play.season)?.season
  const week = data.plays.find((play) => play.week)?.week

  if (!seas_type) {
    throw new Error(`could not find seas_type in play data for esbid: ${esbid}`)
  }

  for (const play of data.plays) {
    const { playId } = play
    if (!play.playType) {
      log(`skipping playId: ${playId} missing playType (esbid: ${esbid})`)
      continue
    }

    const play_data = format_play_data(play)
    play_inserts.push({
      playId,
      esbid,
      updated: timestamp,
      seas_type,
      ...play_data
    })

    if (play.playStats && Array.isArray(play.playStats)) {
      for (const playStat of play.playStats) {
        const play_stat_data = format_play_stat_data(playStat)
        play_stat_inserts.push({
          playId,
          esbid,
          valid: 1,
          statId: playStat.statId,
          ...play_stat_data
        })
      }
    }

    if (play.nflIds && Array.isArray(play.nflIds)) {
      for (const gsis_it_id of play.nflIds) {
        snap_inserts.push({
          esbid,
          gsis_it_id,
          playId
        })
      }
    }
  }

  const end_play_exists = data.plays.find(
    (p) => p.playDescription === 'END GAME' && p.playState === 'APPROVED'
  )

  if (end_play_exists) {
    // reset final table playStats
    await db('nfl_play_stats').update({ valid: 0 }).where({ esbid })

    if (snap_inserts.length) {
      try {
        await db('nfl_snaps').where({ esbid }).del()
        await db('nfl_snaps')
          .insert(snap_inserts)
          .onConflict(['esbid', 'playId', 'gsis_it_id'])
          .merge()
      } catch (err) {
        log(`Error on inserting snaps for esbid: ${esbid}`)
        log(err)
      }
    }

    if (play_inserts.length) {
      try {
        await db('nfl_play_stats')
          .insert(play_stat_inserts)
          .onConflict(['esbid', 'playId', 'statId', 'playerName'])
          .merge()
        await db('nfl_plays')
          .insert(play_inserts)
          .onConflict(['esbid', 'playId', 'year'])
          .merge()
        log(`inserted ${play_inserts.length} play stats for esbid: ${esbid}`)
      } catch (err) {
        log(`Error on inserting plays and play stats for esbid: ${esbid}`)
        log(err)
      }
    }
  }

  const is_current_week =
    year === constants.season.year && week === constants.season.nfl_seas_week
  if (is_current_week) {
    if (snap_inserts.length) {
      try {
        await db('nfl_snaps_current_week').where({ esbid }).del()
        await db('nfl_snaps_current_week')
          .insert(snap_inserts)
          .onConflict(['esbid', 'playId', 'gsis_it_id'])
          .merge()
      } catch (err) {
        log(`Error on inserting snaps for esbid: ${esbid}`)
        log(err)
      }
    }

    if (play_inserts.length) {
      try {
        if (play_stat_inserts.length) {
          await db('nfl_play_stats_current_week').where({ esbid }).del()

          await db('nfl_play_stats_current_week').insert(play_stat_inserts)
        }

        await db('nfl_plays_current_week')
          .insert(play_inserts)
          .onConflict(['esbid', 'playId'])
          .merge()
      } catch (err) {
        log(`Error on inserting plays and play stats for esbid: ${esbid}`)
        log(err)
      }
    }
  }
}
