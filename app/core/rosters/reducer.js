import { Map } from 'immutable'

import { rosterActions } from './actions'
import { createRoster } from './roster'
import { appActions } from '@core/app'
import { constants } from '@libs-shared'
import { auctionActions } from '@core/auction'
import { teamActions } from '@core/teams'

export function rostersReducer(state = new Map(), { payload, type }) {
  switch (type) {
    case appActions.LOGOUT:
      return new Map()

    case rosterActions.GET_ROSTERS_FULFILLED:
      return state.withMutations((state) => {
        payload.data.forEach((r) =>
          state.setIn([r.tid, r.year, r.week], createRoster(r))
        )
      })

    case auctionActions.AUCTION_PROCESSED: {
      const { tid, pid, rid, pos, userid, value, type, year, timestamp, lid } =
        payload
      return state.updateIn(
        [payload.tid, constants.year, constants.week, 'players'],
        (players) =>
          players.push({
            rid,
            slot: constants.slots.BENCH,
            tag: 1,
            pid,
            pos,
            userid,
            value,
            type,
            year,
            timestamp,
            tid,
            lid
          })
      )
    }

    case rosterActions.POST_RELEASE_FULFILLED: {
      const players = state.getIn([
        payload.data.transaction.tid,
        constants.year,
        constants.week,
        'players'
      ])
      if (!players) return state
      const key = players.findKey((p) => p.pid === payload.data.pid)
      return state.deleteIn([
        payload.data.transaction.tid,
        constants.year,
        constants.week,
        'players',
        key
      ])
    }

    case rosterActions.ROSTER_TRANSACTIONS: {
      return state.withMutations((state) => {
        payload.data.forEach((p) => {
          const t = p.transaction
          const players = state.getIn([
            t.tid,
            constants.year,
            constants.week,
            'players'
          ])
          if (!players) return state

          const key = players.findKey((p) => p.pid === t.pid)
          if (t.type === constants.transactions.ROSTER_RELEASE) {
            return state.deleteIn([
              t.tid,
              constants.year,
              constants.week,
              'players',
              key
            ])
          } else {
            return state.updateIn(
              [t.tid, constants.year, constants.week, 'players'],
              (arr) =>
                arr.push({
                  rid: t.rid,
                  slot: p.slot,
                  pid: t.pid,
                  tag: t.tag,
                  pos: t.pos,
                  userid: t.userid,
                  tid: t.tid,
                  lid: t.lid,
                  type: t.type,
                  value: t.value,
                  year: t.year,
                  timestamp: t.timestamp
                })
            )
          }
        })
      })
    }

    case rosterActions.PUT_ROSTER_FULFILLED: {
      return state.withMutations((state) => {
        const tid = payload.data[0].tid
        const players = state.getIn([
          tid,
          constants.year,
          constants.week,
          'players'
        ])
        if (!players) return state

        payload.data.forEach(({ pid, slot }) => {
          const index = players.findIndex((p) => p.pid === pid)
          state.setIn(
            [tid, constants.year, constants.week, 'players', index, 'slot'],
            slot
          )
        })
      })
    }

    case rosterActions.ROSTER_TRANSACTION:
    case rosterActions.POST_ACTIVATE_FULFILLED:
    case rosterActions.POST_DEACTIVATE_FULFILLED:
    case rosterActions.POST_PROTECT_FULFILLED:
    case rosterActions.POST_RESERVE_FULFILLED: {
      return state.withMutations((state) => {
        const players = state.getIn([
          payload.data.tid,
          constants.year,
          constants.week,
          'players'
        ])
        if (!players) return state

        const index = players.findIndex((p) => p.pid === payload.data.pid)
        if (payload.data.slot) {
          state.setIn(
            [
              payload.data.tid,
              constants.year,
              constants.week,
              'players',
              index,
              'slot'
            ],
            payload.data.slot
          )

          if (payload.data.transaction) {
            const { type, value, timestamp } = payload.data.transaction
            state.mergeIn(
              [
                payload.data.tid,
                constants.year,
                constants.week,
                'players',
                index
              ],
              {
                type,
                value,
                timestamp
              }
            )
          }
        } else {
          state.deleteIn([
            payload.data.tid,
            constants.year,
            constants.week,
            'players',
            index
          ])
        }
      })
    }

    case rosterActions.SET_LINEUPS:
      return state.withMutations((state) => {
        for (const teamId in payload.lineups) {
          const lineups = payload.lineups[teamId]
          for (const week in lineups) {
            const tid = parseInt(teamId, 10)
            state.setIn(
              [tid, constants.year, constants.week, 'lineups', week],
              lineups[week]
            )
          }
        }
      })

    case teamActions.POST_TEAMS_FULFILLED:
      return state.setIn(
        [payload.data.team.uid, constants.year, constants.week],
        createRoster(payload.data.roster)
      )

    case teamActions.DELETE_TEAMS_FULFILLED:
      return state.delete(payload.opts.teamId)

    case rosterActions.POST_ROSTERS_FULFILLED: {
      const { rid, slot, pos, pid } = payload.data
      const { userid, tid, lid, type, value, year, timestamp } =
        payload.data.transaction
      return state.updateIn(
        [payload.opts.teamId, constants.year, constants.week, 'players'],
        (arr) =>
          arr.push({
            rid,
            tag: 1,
            slot,
            pid,
            pos,
            userid,
            tid,
            lid,
            type,
            value,
            year,
            timestamp
          })
      )
    }

    case rosterActions.POST_TAG_FULFILLED:
      return state.withMutations((state) => {
        const players = state.getIn([
          payload.opts.teamId,
          constants.year,
          constants.week,
          'players'
        ])
        if (!players) return state

        const index = players.findIndex((p) => p.pid === payload.opts.pid)
        state.setIn(
          [
            payload.opts.teamId,
            constants.year,
            constants.week,
            'players',
            index,
            'tag'
          ],
          payload.opts.tag
        )

        if (payload.opts.remove) {
          const index = players.findIndex((p) => p.pid === payload.opts.remove)
          state.setIn(
            [
              payload.opts.teamId,
              constants.year,
              constants.week,
              'players',
              index,
              'tag'
            ],
            constants.tags.REGULAR
          )
        }
      })

    case rosterActions.PUT_ROSTERS_FULFILLED:
      return state // TODO

    case rosterActions.DELETE_ROSTERS_FULFILLED:
      return state.updateIn(
        [payload.opts.teamId, constants.year, constants.week, 'players'],
        (arr) => arr.filter((p) => p.pid !== payload.opts.pid)
      )

    case rosterActions.UPDATE_TRANSITION_TAG:
    case rosterActions.ADD_TRANSITION_TAG: {
      return state.withMutations((state) => {
        const players = state.getIn([
          payload.teamId,
          constants.year,
          constants.week,
          'players'
        ])
        if (!players) return state

        const index = players.findIndex((p) => p.pid === payload.pid)

        // Store previous state for potential reversion
        const previous_tag = state.getIn([
          payload.teamId,
          constants.year,
          constants.week,
          'players',
          index,
          'tag'
        ])

        const previous_bid = state.getIn([
          payload.teamId,
          constants.year,
          constants.week,
          'players',
          index,
          'bid'
        ])

        // Store previous state in a meta field
        state.setIn(
          [
            payload.teamId,
            constants.year,
            constants.week,
            'players',
            index,
            'previous_state'
          ],
          { tag: previous_tag, bid: previous_bid }
        )

        // Apply the transition tag
        state.setIn(
          [
            payload.teamId,
            constants.year,
            constants.week,
            'players',
            index,
            'tag'
          ],
          constants.tags.TRANSITION
        )

        state.setIn(
          [
            payload.teamId,
            constants.year,
            constants.week,
            'players',
            index,
            'bid'
          ],
          payload.bid
        )

        if (payload.remove) {
          const remove_index = players.findIndex(
            (p) => p.pid === payload.remove
          )

          // Store the removed player's tag before changing it
          const removed_player_tag = state.getIn([
            payload.teamId,
            constants.year,
            constants.week,
            'players',
            remove_index,
            'tag'
          ])

          // Store removed player info in a meta field on the main player
          state.setIn(
            [
              payload.teamId,
              constants.year,
              constants.week,
              'players',
              index,
              'removed_player_info'
            ],
            { pid: payload.remove, previous_tag: removed_player_tag }
          )

          state.setIn(
            [
              payload.teamId,
              constants.year,
              constants.week,
              'players',
              remove_index,
              'tag'
            ],
            constants.tags.REGULAR
          )
        }
      })
    }

    case rosterActions.REMOVE_TRANSITION_TAG:
    case rosterActions.REMOVE_TAG: {
      const players = state.getIn([
        payload.teamId,
        constants.year,
        constants.week,
        'players'
      ])
      if (!players) return state

      const index = players.findIndex((p) => p.pid === payload.pid)
      return state.mergeIn(
        [payload.teamId, constants.year, constants.week, 'players', index],
        {
          tag: constants.tags.REGULAR,
          bid: null
        }
      )
    }

    case rosterActions.PUT_TRANSITION_TAG_FAILED:
    case rosterActions.POST_TRANSITION_TAG_FAILED: {
      return state.withMutations((state) => {
        const players = state.getIn([
          payload.opts.teamId,
          constants.year,
          constants.week,
          'players'
        ])
        if (!players) return state

        const index = players.findIndex((p) => p.pid === payload.opts.pid)

        // Get previous state if available
        const previous_state = state.getIn([
          payload.opts.teamId,
          constants.year,
          constants.week,
          'players',
          index,
          'previous_state'
        ])

        // Get removed player info if available
        const removed_player_info = state.getIn([
          payload.opts.teamId,
          constants.year,
          constants.week,
          'players',
          index,
          'removed_player_info'
        ])

        // Restore previous tag and bid
        if (previous_state) {
          state.setIn(
            [
              payload.opts.teamId,
              constants.year,
              constants.week,
              'players',
              index,
              'tag'
            ],
            previous_state.tag
          )

          state.setIn(
            [
              payload.opts.teamId,
              constants.year,
              constants.week,
              'players',
              index,
              'bid'
            ],
            previous_state.bid
          )
        } else {
          // Fallback to default values if no previous state found
          state.setIn(
            [
              payload.opts.teamId,
              constants.year,
              constants.week,
              'players',
              index,
              'tag'
            ],
            constants.tags.REGULAR
          )

          state.setIn(
            [
              payload.opts.teamId,
              constants.year,
              constants.week,
              'players',
              index,
              'bid'
            ],
            null
          )
        }

        // Restore removed player's tag if applicable
        if (removed_player_info) {
          const removed_index = players.findIndex(
            (p) => p.pid === removed_player_info.pid
          )
          if (removed_index !== -1) {
            state.setIn(
              [
                payload.opts.teamId,
                constants.year,
                constants.week,
                'players',
                removed_index,
                'tag'
              ],
              removed_player_info.previous_tag
            )
          }
        }

        // Clean up the temporary state fields
        state.deleteIn([
          payload.opts.teamId,
          constants.year,
          constants.week,
          'players',
          index,
          'previous_state'
        ])

        state.deleteIn([
          payload.opts.teamId,
          constants.year,
          constants.week,
          'players',
          index,
          'removed_player_info'
        ])
      })
    }

    case rosterActions.POST_RESTRICTED_FREE_AGENT_NOMINATION_FULFILLED:
      return state
        .updateIn(
          [payload.opts.teamId, constants.year, constants.week, 'players'],
          (players) =>
            players.map((player) => ({
              ...player,
              transition_tag_nominated: null
            }))
        )
        .updateIn(
          [payload.opts.teamId, constants.year, constants.week, 'players'],
          (players) =>
            players.map((player) => {
              if (player.pid === payload.opts.pid) {
                return {
                  ...player,
                  transition_tag_nominated: payload.data.nominated
                }
              }
              return player
            })
        )

    case rosterActions.DELETE_RESTRICTED_FREE_AGENT_NOMINATION_FULFILLED:
      return state.updateIn(
        [payload.opts.team_id, constants.year, constants.week, 'players'],
        (players) => {
          if (!players) return players
          return players.map((player) => {
            if (player.pid === payload.opts.pid) {
              return { ...player, transition_tag_nominated: null }
            }
            return player
          })
        }
      )

    default:
      return state
  }
}
