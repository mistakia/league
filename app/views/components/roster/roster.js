import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'

import PlayerRosterRow from '@components/player-roster-row'
import { Roster as RosterBuilder } from '@libs-shared'
import TeamName from '@components/team-name'

import './roster.styl'
import { roster_slot_types } from '@constants'

export default class Roster extends React.Component {
  render = () => {
    const {
      roster,
      league,
      team_id,
      ps_drafted_count_max,
      ps_drafted_threshold_count_max,
      ps_signed_count_max,
      bench_count_max,
      reserve_short_term_count_max,
      reserve_long_term_count_max,
      is_psd_expanded,
      set_is_psd_expanded
    } = this.props

    if (!roster) {
      return null
    }

    const r = new RosterBuilder({ roster: roster.toJS(), league })
    const show_bid = team_id === roster.tid

    const rows = []
    if (league.starter_slots_quarterback) {
      const slot = roster_slot_types.QB
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.starter_slots_quarterback; i++) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            starter
            key={`${roster.tid}-${slot}-${i}`}
            {...{ pid, roster, show_bid }}
          />
        )
      }
    }

    if (league.starter_slots_running_back) {
      const slot = roster_slot_types.RB
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.starter_slots_running_back; i++) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            starter
            key={`${roster.tid}-${slot}-${i}`}
            {...{ pid, roster, show_bid }}
          />
        )
      }
    }

    if (league.starter_slots_wide_receiver) {
      const slot = roster_slot_types.WR
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.starter_slots_wide_receiver; i++) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            starter
            key={`${roster.tid}-${slot}-${i}`}
            {...{ pid, roster, show_bid }}
          />
        )
      }
    }

    if (league.starter_slots_tight_end) {
      const slot = roster_slot_types.TE
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.starter_slots_tight_end; i++) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            starter
            key={`${roster.tid}-${slot}-${i}`}
            {...{ pid, roster, show_bid }}
          />
        )
      }
    }

    if (league.starter_slots_kicker) {
      const slot = roster_slot_types.K
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.starter_slots_kicker; i++) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            starter
            key={`${roster.tid}-${slot}-${i}`}
            {...{ pid, roster, show_bid }}
          />
        )
      }
    }

    if (league.starter_slots_defense_special_teams) {
      const slot = roster_slot_types.DST
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.starter_slots_defense_special_teams; i++) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            starter
            key={`${roster.tid}-${slot}-${i}`}
            {...{ pid, roster, show_bid }}
          />
        )
      }
    }

    if (league.starter_slots_running_back_wide_receiver_flex) {
      const slot = roster_slot_types.RBWR
      const players = r.starters.filter((p) => p.slot === slot)
      for (
        let i = 0;
        i < league.starter_slots_running_back_wide_receiver_flex;
        i++
      ) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            starter
            key={`${roster.tid}-${slot}-${i}`}
            {...{ pid, roster, show_bid }}
          />
        )
      }
    }

    if (league.starter_slots_running_back_wide_receiver_tight_end_flex) {
      const slot = roster_slot_types.RBWRTE
      const players = r.starters.filter((p) => p.slot === slot)
      for (
        let i = 0;
        i < league.starter_slots_running_back_wide_receiver_tight_end_flex;
        i++
      ) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            starter
            key={`${roster.tid}-${slot}-${i}`}
            {...{ pid, roster, show_bid }}
          />
        )
      }
    }

    if (league.starter_slots_superflex) {
      const slot = roster_slot_types.QBRBWRTE
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.starter_slots_superflex; i++) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            starter
            key={`${roster.tid}-${slot}-${i}`}
            {...{ pid, roster, show_bid }}
          />
        )
      }
    }

    if (league.starter_slots_wide_receiver_tight_end_flex) {
      const slot = roster_slot_types.WRTE
      const players = r.starters.filter((p) => p.slot === slot)
      for (
        let i = 0;
        i < league.starter_slots_wide_receiver_tight_end_flex;
        i++
      ) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            starter
            key={`${roster.tid}-${slot}-${i}`}
            {...{ pid, roster, show_bid }}
          />
        )
      }
    }

    if (bench_count_max) {
      const players = r.bench.sort((a, b) => b.value - a.value)
      for (let i = 0; i < bench_count_max; i++) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${roster.tid}-bench-${i}`}
            {...{ pid, slot: roster_slot_types.BENCH, roster, show_bid }}
          />
        )
      }
    }

    if (league.practice_squad_slot_count) {
      const signed_players = r.practice_signed.sort((a, b) => b.value - a.value)
      for (let i = 0; i < ps_signed_count_max; i++) {
        const { pid } = signed_players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${roster.tid}-ps-${i}`}
            practice_signed
            {...{ pid, roster, show_bid }}
          />
        )
      }

      const drafted_players = r.practice_drafted.sort((a, b) => {
        const a_player = this.props.players.get('items').get(a.pid)
        const b_player = this.props.players.get('items').get(b.pid)

        if (!a_player || !b_player) return 0

        const a_draft_year = a_player.get('nfl_draft_year') || 0
        const b_draft_year = b_player.get('nfl_draft_year') || 0
        const a_draft_pos = a_player.get('draft_overall_pick') || 9999
        const b_draft_pos = b_player.get('draft_overall_pick') || 9999

        if (a_draft_year !== b_draft_year) {
          return b_draft_year - a_draft_year
        }

        return a_draft_pos - b_draft_pos
      })

      const total_players = drafted_players.length

      // In collapsed state, always show ps_drafted_threshold_count_max rows (all players up to threshold)
      // In expanded state, always show ps_drafted_count_max rows (all players)
      const display_count = is_psd_expanded
        ? ps_drafted_count_max
        : ps_drafted_threshold_count_max
      const display_players = is_psd_expanded
        ? drafted_players
        : drafted_players.slice(0, ps_drafted_threshold_count_max)

      // Add player rows
      for (let i = 0; i < display_count; i++) {
        const player = display_players[i]
        const pid = player ? player.pid : null
        rows.push(
          <PlayerRosterRow
            key={`psd-player-${roster.tid}-${i}-${pid || 'empty'}`}
            practice_drafted
            {...{ pid, roster, show_bid }}
          />
        )
      }

      // Always add toggle or spacer row for alignment
      if (
        total_players > ps_drafted_threshold_count_max &&
        set_is_psd_expanded
      ) {
        const hidden_count = total_players - ps_drafted_threshold_count_max
        rows.push(
          <div
            key={`psd-toggle-${roster.tid}`}
            className='roster__item roster__toggle'
            onClick={() => set_is_psd_expanded(!is_psd_expanded)}
          >
            {is_psd_expanded ? (
              <>
                <ExpandLessIcon fontSize='small' />
                hide ({hidden_count})
              </>
            ) : (
              <>
                <ExpandMoreIcon fontSize='small' />
                show all ({hidden_count})
              </>
            )}
          </div>
        )
      } else {
        // Add simple gray spacer for teams without additional players
        rows.push(
          <div
            key={`psd-spacer-${roster.tid}`}
            className='roster__item roster__spacer'
          />
        )
      }
    }

    if (reserve_short_term_count_max) {
      const players = r.reserve_short_term_players
      for (let i = 0; i < reserve_short_term_count_max; i++) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${roster.tid}-reserve-short-term-${i}`}
            reserve
            {...{ pid, roster, show_bid }}
          />
        )
      }

      const long_term_players = r.reserve_long_term_players
      for (let i = 0; i < reserve_long_term_count_max; i++) {
        const { pid } = long_term_players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${roster.tid}-reserve-long-term-${i}`}
            reserve
            {...{ pid, roster, show_bid }}
          />
        )
      }
    }

    return (
      <div className='roster'>
        <div className='roster__team'>
          <TeamName tid={roster.tid} />
          <div className='roster__salary metric'>{`$${r.availableCap}`}</div>
        </div>
        <div className='roster__slots'>{rows}</div>
      </div>
    )
  }
}

Roster.propTypes = {
  roster: ImmutablePropTypes.record,
  league: PropTypes.object,
  team_id: PropTypes.number,
  ps_signed_count_max: PropTypes.number,
  ps_drafted_count_max: PropTypes.number,
  ps_drafted_threshold_count_max: PropTypes.number,
  bench_count_max: PropTypes.number,
  reserve_short_term_count_max: PropTypes.number,
  reserve_long_term_count_max: PropTypes.number,
  players: ImmutablePropTypes.map,
  is_psd_expanded: PropTypes.bool,
  set_is_psd_expanded: PropTypes.func
}
