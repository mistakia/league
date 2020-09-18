import React from 'react'

export default class PlayerSelectedRow extends React.Component {
  render = () => {
    const { title, stats, action, className, games } = this.props
    const classNames = ['player__selected-row']
    if (className) classNames.push(className)
    return (
      <div className={classNames.join(' ')}>
        <div className='row__name'>
          {title}
        </div>
        {games &&
          <div className='row__single-metric'>{games}</div>}
        <div className='row__group'>
          <div className='row__group-body'>
            <div className='player__row-metric'>{(stats.py || 0).toFixed(1)}</div>
            <div className='player__row-metric'>{(stats.tdp || 0).toFixed(1)}</div>
            <div className='player__row-metric'>{(stats.ints || 0).toFixed(1)}</div>
          </div>
        </div>
        <div className='row__group'>
          <div className='row__group-body'>
            <div className='player__row-metric'>{(stats.ra || 0).toFixed(1)}</div>
            <div className='player__row-metric'>{(stats.ry || 0).toFixed(1)}</div>
            <div className='player__row-metric'>{(stats.tdr || 0).toFixed(1)}</div>
            <div className='player__row-metric'>{(stats.fuml || 0).toFixed(1)}</div>
          </div>
        </div>
        <div className='row__group'>
          <div className='row__group-body'>
            <div className='player__row-metric'>{(stats.trg || 0).toFixed(1)}</div>
            <div className='player__row-metric'>{(stats.rec || 0).toFixed(1)}</div>
            <div className='player__row-metric'>{(stats.recy || 0).toFixed(1)}</div>
            <div className='player__row-metric'>{(stats.tdrec || 0).toFixed(1)}</div>
          </div>
        </div>
        {action}
      </div>
    )
  }
}
