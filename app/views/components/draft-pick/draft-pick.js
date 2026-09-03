import React, { useState } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import Icon from '@components/icon'
import TeamName from '@components/team-name'
import DraftPickSheet from '@components/draft-pick-sheet'
import Tooltip from '@components/tooltip'

import './draft-pick.styl'

export default function DraftPick({
  player_map,
  pick,
  team,
  is_active,
  is_next_up,
  is_user,
  trade_count
}) {
  const [sheet_open, set_sheet_open] = useState(false)

  const handle_pick_click = () => {
    set_sheet_open(true)
  }

  const handle_sheet_close = () => {
    set_sheet_open(false)
  }

  const class_names = ['draft__pick']
  if (is_active && !pick.pid) {
    class_names.push('active')
  }

  if (is_user) {
    class_names.push('user')
  }

  const pos = player_map.get('primary_position')
  if (pos) class_names.push(pos)

  // Hover names when the pick is currently scheduled to be on the clock. A
  // null window is a fact about the board, not a missing value: between a
  // resume and the next published slate every pick is void.
  const tooltip = pick.pid
    ? `Drafted: ${player_map.get('first_name')} ${player_map.get('last_name')}`
    : is_active
      ? 'On the clock now'
      : pick.draftWindow
        ? `Scheduled on the clock: ${pick.draftWindow.format('dddd, MMM D [at] h:mm A')}`
        : 'No published window yet'

  return (
    <>
      <Tooltip title={tooltip} placement='top' arrow>
        <div
          className={class_names.join(' ')}
          onClick={handle_pick_click}
          style={{ cursor: 'pointer' }}
        >
          <div className='draft__pick-num formatted'>
            {pick.pick_string || pick.pick || '-'}
          </div>
          <div className='draft__pick-num pick'>{`#${pick.pick}`}</div>
          <div className='draft__pick-main'>
            {Boolean(player_map.get('pid')) && (
              <div className='draft__pick-player'>
                <div className='draft__pick-player-name last'>
                  {player_map.get('last_name')}
                </div>
                <div className='draft__pick-player-name first'>
                  {player_map.get('first_name')}
                </div>
              </div>
            )}
            {is_active && !pick.pid && (
              <div className='draft__pick-window active'>On the clock</div>
            )}
            {is_next_up &&
              !pick.pid &&
              Boolean(pick.pick) &&
              Boolean(pick.draftWindow) && (
                <div className='draft__pick-window'>
                  {pick.draftWindow.format('ddd h:mm A')}
                </div>
              )}
            <div className='draft__pick-team'>
              <TeamName tid={team.team_id} abbrv />
            </div>
          </div>
          {trade_count > 0 && (
            <div className='draft__pick-trades'>
              <Icon name='repeat' />
              <span>{trade_count}</span>
            </div>
          )}
        </div>
      </Tooltip>

      <DraftPickSheet
        pick={pick}
        isOpen={sheet_open}
        onClose={handle_sheet_close}
      />
    </>
  )
}

DraftPick.propTypes = {
  player_map: ImmutablePropTypes.map,
  pick: PropTypes.object,
  team: ImmutablePropTypes.record,
  is_active: PropTypes.bool,
  is_next_up: PropTypes.bool,
  is_user: PropTypes.bool,
  trade_count: PropTypes.number
}
