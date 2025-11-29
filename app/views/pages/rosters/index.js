import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { roster_actions } from '@core/rosters'
import {
  current_season,
  roster_slot_types,
  practice_squad_drafted_slots,
  practice_squad_signed_slots
} from '@constants'
import {
  get_teams_for_current_league,
  get_rosters_for_current_league,
  get_current_league,
  get_players_state
} from '@core/selectors'
import { player_actions } from '@core/players'

import RostersPage from './rosters'

const map_state_to_props = createSelector(
  get_rosters_for_current_league,
  get_current_league,
  get_teams_for_current_league,
  get_players_state,
  (rosters, league, teams, players) => {
    let ps_drafted_count_max = 0
    let ps_drafted_threshold_count_max = 0
    let ps_signed_count_max = 0
    let bench_count_max = 0
    let reserve_short_term_count_max = 0
    let reserve_long_term_count_max = 0
    const recent_draft_cutoff = current_season.year - 2

    for (const roster of rosters.values()) {
      const ps_drafted_count = roster.players.filter((r) =>
        practice_squad_drafted_slots.includes(r.slot)
      )
      ps_drafted_count_max = Math.max(
        ps_drafted_count.size,
        ps_drafted_count_max
      )

      const ps_drafted_threshold_count = roster.players.filter((r) => {
        if (!practice_squad_drafted_slots.includes(r.slot)) return false
        const player = players.get('items').get(r.pid)
        if (!player) return false
        const draft_year = player.get('nfl_draft_year')
        return draft_year && draft_year > recent_draft_cutoff
      })
      ps_drafted_threshold_count_max = Math.max(
        ps_drafted_threshold_count.size,
        ps_drafted_threshold_count_max
      )

      const ps_signed_count = roster.players.filter((r) =>
        practice_squad_signed_slots.includes(r.slot)
      )
      ps_signed_count_max = Math.max(ps_signed_count.size, ps_signed_count_max)

      const bench_count = roster.players.filter(
        (r) => r.slot === roster_slot_types.BENCH
      )
      bench_count_max = Math.max(bench_count.size, bench_count_max)

      const reserve_short_term_count = roster.players.filter(
        (r) => r.slot === roster_slot_types.RESERVE_SHORT_TERM
      )
      reserve_short_term_count_max = Math.max(
        reserve_short_term_count.size,
        reserve_short_term_count_max
      )

      const reserve_long_term_count = roster.players.filter(
        (r) => r.slot === roster_slot_types.RESERVE_LONG_TERM
      )
      reserve_long_term_count_max = Math.max(
        reserve_long_term_count.size,
        reserve_long_term_count_max
      )
    }

    return {
      rosters,
      league,
      teams,
      ps_drafted_count_max,
      ps_drafted_threshold_count_max,
      ps_signed_count_max,
      bench_count_max,
      reserve_short_term_count_max,
      reserve_long_term_count_max
    }
  }
)

const map_dispatch_to_props = {
  export_rosters: roster_actions.export_rosters,
  load_league_players: player_actions.load_league_players,
  load_rosters: roster_actions.load_rosters
}

export default connect(map_state_to_props, map_dispatch_to_props)(RostersPage)
