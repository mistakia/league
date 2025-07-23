import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'

import PlayerRosterRow from '@components/player-roster-row'
import { Roster as RosterBuilder, constants } from '@libs-shared'
import TeamName from '@components/team-name'

import './roster.styl'

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
      ir_long_term_count_max,
      is_psd_expanded,
      set_is_psd_expanded
    } = this.props

    if (!roster) {
      return null
    }

    const r = new RosterBuilder({ roster: roster.toJS(), league })
    const show_bid = team_id === roster.tid

    const rows = []
    if (league.sqb) {
      const slot = constants.slots.QB
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sqb; i++) {
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

    if (league.srb) {
      const slot = constants.slots.RB
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.srb; i++) {
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

    if (league.swr) {
      const slot = constants.slots.WR
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.swr; i++) {
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

    if (league.ste) {
      const slot = constants.slots.TE
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.ste; i++) {
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

    if (league.sk) {
      const slot = constants.slots.K
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sk; i++) {
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

    if (league.sdst) {
      const slot = constants.slots.DST
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sdst; i++) {
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

    if (league.srbwr) {
      const slot = constants.slots.RBWR
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.srbwr; i++) {
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

    if (league.srbwrte) {
      const slot = constants.slots.RBWRTE
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.srbwrte; i++) {
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

    if (league.sqbrbwrte) {
      const slot = constants.slots.QBRBWRTE
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.sqbrbwrte; i++) {
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

    if (league.swrte) {
      const slot = constants.slots.WRTE
      const players = r.starters.filter((p) => p.slot === slot)
      for (let i = 0; i < league.swrte; i++) {
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
            {...{ pid, slot: constants.slots.BENCH, roster, show_bid }}
          />
        )
      }
    }

    if (league.ps) {
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
        const a_draft_pos = a_player.get('dpos') || 9999
        const b_draft_pos = b_player.get('dpos') || 9999

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

    if (league.ir) {
      const players = r.ir
      for (let i = 0; i < league.ir; i++) {
        const { pid } = players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${roster.tid}-ir-${i}`}
            reserve
            {...{ pid, roster, show_bid }}
          />
        )
      }

      const long_term_players = r.ir_long_term
      for (let i = 0; i < ir_long_term_count_max; i++) {
        const { pid } = long_term_players[i] || {}
        rows.push(
          <PlayerRosterRow
            key={`${roster.tid}-ir-lt-${i}`}
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
  ir_long_term_count_max: PropTypes.number,
  players: ImmutablePropTypes.map,
  is_psd_expanded: PropTypes.bool,
  set_is_psd_expanded: PropTypes.func
}
