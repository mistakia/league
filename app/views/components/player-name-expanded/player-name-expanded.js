import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import dayjs from 'dayjs'

import { Player, connect } from '@components/player'
import Position from '@components/position'
import NFLTeam from '@components/nfl-team'
import { nth } from '@libs-shared'
import IconButton from '@components/icon-button'
import PlayerLabel from '@components/player-label'
import PlayerTag from '@components/player-tag'
import PlayerHeadshot from '@components/player-headshot'

import './player-name-expanded.styl'
import {
  current_season,
  roster_slot_types,
  player_nfl_status,
  nfl_player_status_abbreviations,
  nfl_player_status_descriptions
} from '@constants'

function getClock({ desc, game_clock_start, qtr }) {
  switch (desc) {
    case 'END QUARTER 1':
      return 'End of 1st'

    case 'END QUARTER 2':
      return 'Half'

    case 'END QUARTER 3':
      return 'End of 3rd'

    case 'END GAME':
      return 'Final'

    default:
      return qtr ? `${game_clock_start || ''} ${qtr}${nth(qtr)}` : '-'
  }
}

function GameStatus({ status, player_map }) {
  if (!current_season.isRegularSeason && !status) {
    return null
  }

  if (!player_map.get('pid')) {
    return null
  }

  if (!status || !status.game) {
    return <div className='player__name-expanded-game bye'>BYE</div>
  }

  const opponent =
    player_map.get('team') === status.game.h
      ? `v${status.game.v}`
      : `@${status.game.h}`

  if (!status.lastPlay) {
    let game_time = 'TBD'
    if (status.game.date && status.game.time_est) {
      game_time = dayjs
        .tz(
          `${status.game.date} ${status.game.time_est}`,
          'YYYY/MM/DD HH:mm:SS',
          'America/New_York'
        )
        .local()
        .format('ddd, h:mmA')
    }

    return (
      <div className='player__name-expanded-game'>
        {game_time} {opponent}
      </div>
    )
  }

  const clock = getClock(status.lastPlay)

  return (
    <div className='player__name-expanded-game'>
      {opponent} <span className='clock'>{clock}</span>
    </div>
  )
}

GameStatus.propTypes = {
  status: PropTypes.object,
  player_map: ImmutablePropTypes.map
}

class PlayerNameExpanded extends Player {
  render = () => {
    const {
      player_map,
      is_hosted,
      hideActions,
      status,
      minimize,
      headshot_square,
      selected_year
    } = this.props

    const classNames = ['player__name-expanded']
    if (minimize) classNames.push('minimize')

    const playerName =
      window.innerWidth < 600
        ? player_map.get('pname')
        : `${player_map.get('fname', '')} ${player_map.get('lname', '')}`

    const player_nfl_status_value = player_map.get('nfl_status')
    const player_game_status = player_map.get('game_status')
    const slot = player_map.get('slot')

    // game status should supersede nfl status
    const player_status_label =
      nfl_player_status_abbreviations[player_game_status] ||
      nfl_player_status_abbreviations[player_nfl_status_value]
    const player_status_description =
      nfl_player_status_descriptions[player_game_status] ||
      nfl_player_status_descriptions[player_nfl_status_value]
    const player_has_non_active_status = Boolean(
      (nfl_player_status_abbreviations[player_nfl_status_value] &&
        player_nfl_status_value !== player_nfl_status.ACTIVE) ||
        (nfl_player_status_abbreviations[player_game_status] &&
          player_game_status !== player_nfl_status.ACTIVE)
    )

    return (
      <div className={classNames.join(' ')}>
        {Boolean(is_hosted && player_map.get('pid') && !hideActions) && (
          <div className='player__name-expanded-action'>
            <IconButton
              small
              text
              onClick={this.handleContextClick}
              icon='more'
            />
          </div>
        )}
        <div className='player__name-headshot'>
          <PlayerHeadshot player_map={player_map} square={headshot_square} />
        </div>
        <div className='player__name-expanded-main'>
          <div
            className='player__name-expanded-row player__name-expanded-name cursor'
            onClick={this.handleClick}
          >
            <div className='player__name-expanded-full-name'>
              {playerName || '-'}
            </div>
            {current_season.year === player_map.get('nfl_draft_year') && (
              <PlayerLabel label='R' type='rookie' description='Rookie' />
            )}
            {(slot === roster_slot_types.PSP ||
              slot === roster_slot_types.PSDP) && (
              <PlayerLabel label='P' description='Protected Practice Squad' />
            )}
            <PlayerTag tag={player_map.get('tag')} />
          </div>
          <div className='player__name-expanded-row'>
            <Position pos={player_map.get('pos')} />
            <NFLTeam team={player_map.get('team')} />
            {selected_year === current_season.year && (
              <GameStatus status={status} player_map={player_map} />
            )}
            {player_has_non_active_status && (
              <PlayerLabel
                type='game'
                label={player_status_label}
                description={player_status_description}
              />
            )}
          </div>
        </div>
      </div>
    )
  }
}

PlayerNameExpanded.propTypes = {
  status: PropTypes.object,
  player_map: ImmutablePropTypes.map,
  headshot_square: PropTypes.bool
}

export default connect(PlayerNameExpanded)
