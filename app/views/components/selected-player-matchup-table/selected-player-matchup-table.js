import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import PlayerSelectedRow from '@components/player-selected-row'
import PlayerSelectedRowHeader from '@components/player-selected-row-header'
import PlayerNameText from '@components/player-name-text'

export default class SelectedPlayerMatchupTable extends React.Component {
  render = () => {
    const {
      gamelogs,
      position,
      opp,
      nfl_team_against_seasonlogs
    } = this.props

    if (!opp) {
      return <div>BYE</div>
    }

    const rows = []
    nfl_team_against_seasonlogs.forEach((item, index) => {
      const lead = (
        <>
          <div className='table__cell sticky__column metric game__week' />
          <div className='table__cell sticky__column sticky__two text'>
            {item.title}
          </div>
          <div className='table__cell metric' />
          <div className='table__cell metric'>
            {(item.stats.pts || 0).toFixed(1)}
          </div>
          <div className='table__cell metric'>
            {item.points_added ? item.points_added.toFixed(1) : '-'}
          </div>
          <div className='table__cell metric'>{item.stats.rnk || '-'}</div>
        </>
      )
      rows.push(
        <PlayerSelectedRow
          key={`summary-${index}`}
          stats={item.stats}
          lead={lead}
          pos={position}
          header
        />
      )
    })

    gamelogs.forEach((gamelog, index) => {
      const lead = (
        <>
          <div className='table__cell sticky__column metric game__week'>
            {gamelog.week}
          </div>
          <div className='table__cell sticky__column sticky__two text'>
            <PlayerNameText pid={gamelog.pid} />
          </div>
          <div className='table__cell metric'>{gamelog.tm}</div>
          <div className='table__cell metric'>
            {(gamelog.pts || 0).toFixed(1)}
          </div>
          <div className='table__cell metric'>
            {gamelog.points_added ? gamelog.points_added.toFixed(1) : '-'}
          </div>
          <div className='table__cell metric'>{gamelog.pos_rnk || '-'}</div>
        </>
      )
      rows.push(
        <PlayerSelectedRow
          key={index}
          stats={gamelog}
          lead={lead}
          pos={position}
        />
      )
    })

    return (
      <>
        <div className='selected__section-header sticky__column'>
          <div className='row__group-head'>
            {position}s vs {opp} Gamelogs
          </div>
        </div>
        <div className='selected__section-header'>
          <div className='table__cell sticky__column metric game__week'>Wk</div>
          <div className='table__cell sticky__column sticky__two text'>
            Player
          </div>
          <div className='table__cell metric'>Tm</div>
          <div className='row__group'>
            <div className='row__group-head'>Fantasy</div>
            <div className='row__group-body'>
              <div className='table__cell metric'>Pts</div>
              <div className='table__cell metric'>Pts+</div>
              <div className='table__cell metric'>Rnk</div>
            </div>
          </div>
          <PlayerSelectedRowHeader pos={position} />
        </div>
        {rows}
      </>
    )
  }
}

SelectedPlayerMatchupTable.propTypes = {
  gamelogs: ImmutablePropTypes.list,
  position: PropTypes.string,
  opp: PropTypes.string,
  nfl_team_against_seasonlogs: PropTypes.array
}
