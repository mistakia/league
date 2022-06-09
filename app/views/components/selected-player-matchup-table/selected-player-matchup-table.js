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
      defenseStats,
      defensePercentiles,
      playerPercentiles
    } = this.props

    if (!opp) {
      return <div>BYE</div>
    }

    const rows = []
    for (const item of defenseStats) {
      const percentiles = defensePercentiles[item.type]

      const lead = (
        <div className='row__group'>
          <div className='row__group-body'>
            <div className='table__cell metric' />
            <div className='table__cell metric' />
            <div className='row__text'>{item.title}</div>
            <div className='table__cell metric'>
              {(item.points || 0).toFixed(1)}
            </div>
          </div>
        </div>
      )
      rows.push(
        <PlayerSelectedRow
          key={item.title}
          stats={item.stats}
          lead={lead}
          pos={position}
          percentiles={percentiles}
          header
        />
      )
    }

    for (const [index, gamelog] of gamelogs.entrySeq()) {
      // TODO pid
      const lead = (
        <div className='row__group'>
          <div className='row__group-body'>
            <div className='table__cell metric'>{gamelog.week}</div>
            <div className='table__cell metric'>{gamelog.tm}</div>
            <div className='row__text'>
              <PlayerNameText playerId={gamelog.player} />
            </div>
            <div className='table__cell metric'>
              {(gamelog.pts || 0).toFixed(1)}
            </div>
          </div>
        </div>
      )
      rows.push(
        <PlayerSelectedRow
          key={index}
          stats={gamelog}
          lead={lead}
          pos={position}
          percentiles={playerPercentiles}
        />
      )
    }

    return (
      <>
        <div className='selected__section-header'>
          <div className='row__group-head'>
            {position}s vs {opp} Gamelogs
          </div>
        </div>
        <div className='selected__section-header'>
          <div className='row__group'>
            <div className='row__group-body'>
              <div className='table__cell metric'>Wk</div>
              <div className='table__cell metric'>Tm</div>
              <div className='row__text'>Player</div>
              <div className='table__cell metric'>Pts</div>
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
  defenseStats: PropTypes.array,
  defensePercentiles: PropTypes.object,
  playerPercentiles: PropTypes.object
}
