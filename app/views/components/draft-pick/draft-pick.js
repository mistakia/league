import React, { useState } from 'react'
import dayjs from 'dayjs'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import RepeatIcon from '@mui/icons-material/Repeat'

import TeamName from '@components/team-name'
import DraftPickSheet from '@components/draft-pick-sheet'

import './draft-pick.styl'

export default function DraftPick({
  player_map,
  pick,
  team,
  is_active,
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

  const pos = player_map.get('pos')
  if (pos) class_names.push(pos)

  return (
    <>
      <div
        className={class_names.join(' ')}
        onClick={handle_pick_click}
        style={{ cursor: 'pointer' }}
      >
        <div className='draft__pick-num formatted'>
          {pick.pick_str || pick.pick || '-'}
        </div>
        <div className='draft__pick-num pick'>{`#${pick.pick}`}</div>
        <div className='draft__pick-main'>
          {Boolean(player_map.get('pid')) && (
            <div className='draft__pick-player'>
              <div className='draft__pick-player-name last'>
                {player_map.get('lname')}
              </div>
              <div className='draft__pick-player-name first'>
                {player_map.get('fname')}
              </div>
            </div>
          )}
          {is_active && !pick.pid && (
            <div className='draft__pick-window active'>On the clock</div>
          )}
          {!is_active &&
            !pick.pid &&
            Boolean(pick.pick) &&
            Boolean(pick.draftWindow) && (
              <div className='draft__pick-window'>
                {dayjs().to(pick.draftWindow)}
              </div>
            )}
          <div className='draft__pick-team'>
            <TeamName tid={team.uid} abbrv />
          </div>
        </div>
        {trade_count > 0 && (
          <div className='draft__pick-trades'>
            <RepeatIcon />
            <span>{trade_count}</span>
          </div>
        )}
      </div>

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
  is_user: PropTypes.bool,
  trade_count: PropTypes.number
}
