import { connect } from 'react-redux'
import { createSelector } from 'reselect'

import { rosterActions } from '@core/rosters'
import {
  getTeamsForCurrentLeague,
  getRostersForCurrentLeague,
  getCurrentLeague
} from '@core/selectors'
import { constants } from '@libs-shared'
import { playerActions } from '@core/players'

import RostersPage from './rosters'

const mapStateToProps = createSelector(
  getRostersForCurrentLeague,
  getCurrentLeague,
  getTeamsForCurrentLeague,
  (rosters, league, teams) => {
    let ps_drafted_count_max = 0
    let ps_signed_count_max = 0
    let bench_count_max = 0
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
    }

    return {
      rosters,
      league,
      teams,
      ps_drafted_count_max,
      ps_signed_count_max,
      bench_count_max
    }
  }
)

const mapDispatchToProps = {
  exportRosters: rosterActions.exportRosters,
  loadLeaguePlayers: playerActions.loadLeaguePlayers,
  loadRosters: rosterActions.loadRosters
}

export default connect(mapStateToProps, mapDispatchToProps)(RostersPage)
