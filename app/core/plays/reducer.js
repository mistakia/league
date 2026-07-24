import { Map } from 'immutable'

import { play_actions } from './actions'
import { scoreboard_actions } from '@core/scoreboard'

export function plays_reducer(state = new Map(), { payload, type }) {
  switch (type) {
    case scoreboard_actions.UPDATE_SCOREBOARD_PLAYS:
    case scoreboard_actions.GET_SCOREBOARD_FULFILLED:
    case play_actions.GET_PLAYS_FULFILLED:
      return state.withMutations((state) => {
        payload.data.forEach((play) => {
          const play_key = [play.week, `${play.esbid}:${play.play_id}`]
          const existing_play = state.getIn(play_key)

          // Preserve existing playStats if play already exists (e.g., from orphan playStat)
          const existing_playStats = existing_play?.playStats
            ? Array.isArray(existing_play.playStats)
              ? existing_play.playStats
              : [existing_play.playStats]
            : []

          state.setIn(play_key, {
            playStats: existing_playStats,
            ...play
          })
        })
      })

    case play_actions.GET_PLAYSTATS_FULFILLED:
      return state.withMutations((state) => {
        payload.data.forEach((playStat) => {
          if (!playStat.week) {
            console.warn(
              '[plays_reducer] playStat missing week field:',
              playStat
            )
            return
          }

          const play_key = [
            playStat.week,
            `${playStat.esbid}:${playStat.play_id}`
          ]
          let existing_play = state.getIn(play_key)

          // Create a minimal play entry if it doesn't exist (orphan playStat)
          if (!existing_play) {
            console.warn(
              '[plays_reducer] Orphan playStat: play does not exist yet, creating minimal play entry',
              {
                esbid: playStat.esbid,
                play_id: playStat.play_id,
                week: playStat.week,
                stat_id: playStat.stat_id,
                player_name: playStat.player_name
              }
            )
            existing_play = {
              esbid: playStat.esbid,
              play_id: playStat.play_id,
              week: playStat.week,
              playStats: []
            }
            state.setIn(play_key, existing_play)
          }

          // Ensure playStats is always an array
          const existing_playStats = Array.isArray(existing_play.playStats)
            ? existing_play.playStats
            : existing_play.playStats
              ? [existing_play.playStats]
              : []

          // Check if this playStat already exists to avoid duplicates
          const playStat_exists = existing_playStats.some(
            (ps) =>
              ps.esbid === playStat.esbid &&
              ps.play_id === playStat.play_id &&
              ps.stat_id === playStat.stat_id &&
              ps.player_name === playStat.player_name
          )
          if (!playStat_exists) {
            const updated_playStats = [...existing_playStats, playStat]
            state.setIn([...play_key, 'playStats'], updated_playStats)
          }
        })
      })

    default:
      return state
  }
}
