import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { roster_actions } from '@core/rosters'
import {
  getTeamsForCurrentLeague,
  getRostersForCurrentLeague,
  getCurrentLeague
} from '@core/selectors'
import { constants } from '@libs-shared'
import { player_actions } from '@core/players'

import RostersPage from './rosters'

const mapStateToProps = createSelector(
  getRostersForCurrentLeague,
  getCurrentLeague,
  getTeamsForCurrentLeague,
  (rosters, league, teams) => {
    let ps_drafted_count_max = 0
    let ps_signed_count_max = 0
    let bench_count_max = 0
    let ir_long_term_count_max = 0
    for (const roster of rosters.values()) {
      const ps_drafted_count = roster.players.filter((r) =>
        constants.ps_drafted_slots.includes(r.slot)
      )
      ps_drafted_count_max = Math.max(
        ps_drafted_count.size,
        ps_drafted_count_max
      )

      const ps_signed_count = roster.players.filter((r) =>
        constants.ps_signed_slots.includes(r.slot)
      )
      ps_signed_count_max = Math.max(ps_signed_count.size, ps_signed_count_max)

      const bench_count = roster.players.filter(
        (r) => r.slot === constants.slots.BENCH
      )
      bench_count_max = Math.max(bench_count.size, bench_count_max)

      const ir_long_term_count = roster.players.filter(
        (r) => r.slot === constants.slots.IR_LONG_TERM
      )
      ir_long_term_count_max = Math.max(
        ir_long_term_count.size,
        ir_long_term_count_max
      )
    }

    return {
      rosters,
      league,
      teams,
      ps_drafted_count_max,
      ps_signed_count_max,
      bench_count_max,
      ir_long_term_count_max
    }
  }
)

const mapDispatchToProps = {
  export_rosters: roster_actions.export_rosters,
  load_league_players: player_actions.load_league_players,
  load_rosters: roster_actions.load_rosters
}

export default connect(mapStateToProps, mapDispatchToProps)(RostersPage)
