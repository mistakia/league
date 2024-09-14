import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import dayjs from 'dayjs'

import { Player, connect } from '@components/player'
import Position from '@components/position'
import NFLTeam from '@components/nfl-team'
import { constants, nth } from '@libs-shared'
import IconButton from '@components/icon-button'
import PlayerLabel from '@components/player-label'
import PlayerTag from '@components/player-tag'
import PlayerHeadshot from '@components/player-headshot'

import './player-name-expanded.styl'

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

function GameStatus({ status, playerMap }) {
  if (!constants.isRegularSeason && !status) {
    return null
  }

  if (!playerMap.get('pid')) {
    return null
  }

  if (!status || !status.game) {
    return <div className='player__name-expanded-game bye'>BYE</div>
  }

  const opponent =
    playerMap.get('team') === status.game.h
      ? `v${status.game.v}`
      : `@${status.game.h}`

  if (!status.lastPlay) {
    const gameTime = dayjs
      .tz(
        `${status.game.date} ${status.game.time_est}`,
        'YYYY/MM/DD HH:mm:SS',
        'America/New_York'
      )
      .local()
      .format('ddd, h:mmA')

    return (
      <div className='player__name-expanded-game'>
        {gameTime} {opponent}
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
  playerMap: ImmutablePropTypes.map
}

class PlayerNameExpanded extends Player {
  render = () => {
    const {
      playerMap,
      isHosted,
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
        ? playerMap.get('pname')
        : `${playerMap.get('fname', '')} ${playerMap.get('lname', '')}`

    const player_nfl_status = playerMap.get('nfl_status')
    const player_game_status = playerMap.get('game_status')
    const slot = playerMap.get('slot')

    // game status should supersede nfl status
    const player_status_label =
      constants.nfl_player_status_abbreviations[player_game_status] ||
      constants.nfl_player_status_abbreviations[player_nfl_status]
    const player_status_description =
      constants.nfl_player_status_descriptions[player_game_status] ||
      constants.nfl_player_status_descriptions[player_nfl_status]
    const player_has_non_active_status = Boolean(
      (constants.nfl_player_status_abbreviations[player_nfl_status] &&
        player_nfl_status !== constants.player_nfl_status.ACTIVE) ||
        (constants.nfl_player_status_abbreviations[player_game_status] &&
          player_game_status !== constants.player_nfl_status.ACTIVE)
    )

    return (
      <div className={classNames.join(' ')}>
        {Boolean(isHosted && playerMap.get('pid') && !hideActions) && (
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
          <PlayerHeadshot playerMap={playerMap} square={headshot_square} />
        </div>
        <div className='player__name-expanded-main'>
          <div
            className='player__name-expanded-row player__name-expanded-name cursor'
            onClick={this.handleClick}
          >
            <div className='player__name-expanded-full-name'>
              {playerName || '-'}
            </div>
            {constants.year === playerMap.get('start') && (
              <PlayerLabel label='R' type='rookie' description='Rookie' />
            )}
            {(slot === constants.slots.PSP ||
              slot === constants.slots.PSDP) && (
              <PlayerLabel label='P' description='Protected Practice Squad' />
            )}
            <PlayerTag tag={playerMap.get('tag')} />
          </div>
          <div className='player__name-expanded-row'>
            <Position pos={playerMap.get('pos')} />
            <NFLTeam team={playerMap.get('team')} />
            {selected_year === constants.year && (
              <GameStatus status={status} playerMap={playerMap} />
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
  playerMap: ImmutablePropTypes.map,
  headshot_square: PropTypes.bool
}

export default connect(PlayerNameExpanded)
