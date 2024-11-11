import React from 'react'

// import EditableProjection from '@components/editable-projection'
import Position from '@components/position'
import PlayerWatchlistAction from '@components/player-watchlist-action'
import PercentileMetric from '@components/percentile-metric'
import NFLTeam from '@components/nfl-team'
import TeamName from '@components/team-name'
import { Player, connect } from '@components/player'
import IconButton from '@components/icon-button'
import { constants } from '@libs-shared'
import PlayerLabel from '@components/player-label'
import PlayerTag from '@components/player-tag'
import { Team } from '@core/teams'

import './player-row.styl'

class PlayerRow extends Player {
  render = () => {
    const {
      playerMap,
      selectedPlayer,
      isHosted,
      is_logged_in,
      selected, // inherited from Player class
      status,
      teamId,
      player_row_index,
      teams,
      highlight_teamIds,
      selected_view_grouped_fields,
      week
    } = this.props

    const pid = playerMap.get('pid')
    const tid = playerMap.get('tid')
    const team = teams.get(tid, new Team())
    const nfl_team = playerMap.get('team')
    const pos = playerMap.get('pos')
    const isRostered = Boolean(tid)
    const isSelected = selectedPlayer === pid || selected === pid

    const classNames = ['player__row']
    if (isSelected) classNames.push('selected')
    if (is_logged_in && !isRostered) classNames.push('fa')
    else if (highlight_teamIds.includes(tid))
      classNames.push(`draft-order-${team.get('draft_order')}`)
    else if (teamId && tid === teamId) classNames.push('rostered')

    // TODO add baseline__player className

    const name =
      window.innerWidth <= 600 ? playerMap.get('pname') : playerMap.get('name')

    const field_items = []
    selected_view_grouped_fields.forEach((group, index) => {
      const group_items = []
      group.fields.forEach((field_info, index) => {
        if (field_info.component) {
          const Component = field_info.component
          group_items.push(<Component {...{ nfl_team, pos, week }} />)
        } else {
          const value = field_info.getValue
            ? field_info.getValue(playerMap)
            : playerMap.getIn(field_info.key_path)
          const percentile_key = field_info.getPercentileKey
            ? field_info.getPercentileKey(playerMap)
            : field_info.percentile_key
          group_items.push(
            <PercentileMetric
              key={index}
              value={value}
              show_positivity={field_info.show_positivity || false}
              fixed={field_info.fixed || 0}
              percentile_key={percentile_key}
              field={field_info.percentile_field}
            />
          )
        }
      })

      field_items.push(
        <div className='row__group' key={index}>
          <div className='row__group-body'>{group_items}</div>
        </div>
      )
    })

    return (
      <div className={classNames.join(' ')}>
        <div className='player__row-lead'>
          <div className='player__row-index'>{player_row_index + 1}</div>
          <div className='player__row-action watchlist'>
            <PlayerWatchlistAction pid={pid} />
          </div>
          <div className='player__row-pos'>
            <Position pos={pos} />
          </div>
          <div className='player__row-name cursor' onClick={this.handleClick}>
            <span>{name}</span>
            {constants.year === playerMap.get('start') && (
              <PlayerLabel label='R' type='rookie' description='Rookie' />
            )}
            <NFLTeam team={nfl_team} />
          </div>
          {is_logged_in && (
            <div className='player__row-tag'>
              <PlayerTag tag={playerMap.get('tag')} />
            </div>
          )}
          {is_logged_in && (
            <div className='player__row-action actions'>
              {Boolean(isHosted) && (
                <IconButton
                  small
                  text
                  onClick={this.handleContextClick}
                  icon='more'
                />
              )}
            </div>
          )}
          {is_logged_in && (
            <div className='player__row-availability'>
              {isRostered ? (
                <TeamName abbrv tid={tid} />
              ) : status.waiver.active ||
                status.waiver.poach ||
                status.waiver.practice ||
                status.locked ? (
                'W'
              ) : (
                'FA'
              )}
            </div>
          )}
        </div>
        {field_items}
      </div>
    )
  }
}

export default connect(PlayerRow)
