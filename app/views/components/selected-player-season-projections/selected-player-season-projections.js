import React from 'react'

import Icon from '@components/icon'
import { weightProjections } from '@common'
import Source from '@components/source'
import PlayerSelectedRow from '@components/player-selected-row'

export default class SelectedPlayerSeasonProjections extends React.Component {
  handleClearClick = () => {
    this.props.delete(this.props.player.player)
  }

  render = () => {
    const { player } = this.props

    const projections = []
    player.projections.forEach((p, index) => {
      const isUser = !p.sourceid
      const title = (isUser ? 'User' : <Source sourceId={p.sourceid} />)
      const action = (
        <div className='row__action'>
          {isUser && <div onClick={this.handleClearClick}><Icon name='clear' /></div>}
        </div>
      )

      const item = (
        <PlayerSelectedRow
          key={index}
          stats={p}
          title={title}
          action={action}
        />
      )
      projections.push(item)
    })

    const projAvg = weightProjections({
      projections: player.projections.filter(p => p.sourceid),
      userId: 0
    })

    projections.push(
      <PlayerSelectedRow
        className='average__row'
        key='average'
        stats={projAvg}
        title='Average'
        action={(<div className='row__action' />)}
      />
    )

    return (
      <div className='selected__section'>
        <div className='selected__section-header'>
          <div className='row__group-head'>
            Season Projections
          </div>
        </div>
        <div className='selected__section-header'>
          <div className='row__name'>Source</div>
          <div className='row__group'>
            <div className='row__group-head'>Passing</div>
            <div className='row__group-body'>
              <div className='player__row-metric'>YDS</div>
              <div className='player__row-metric'>TD</div>
              <div className='player__row-metric'>INT</div>
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-head'>Rushing</div>
            <div className='row__group-body'>
              <div className='player__row-metric'>CAR</div>
              <div className='player__row-metric'>YDS</div>
              <div className='player__row-metric'>TD</div>
              <div className='player__row-metric'>FUM</div>
            </div>
          </div>
          <div className='row__group'>
            <div className='row__group-head'>Receiving</div>
            <div className='row__group-body'>
              <div className='player__row-metric'>TAR</div>
              <div className='player__row-metric'>REC</div>
              <div className='player__row-metric'>YDS</div>
              <div className='player__row-metric'>TD</div>
            </div>
          </div>
          <div className='row__action' />
        </div>
        {projections}
      </div>
    )
  }
}
