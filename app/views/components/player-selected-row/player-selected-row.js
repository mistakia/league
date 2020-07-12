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
            <div className='player__row-metric'>{Math.round(stats.py) || 0}</div>
            <div className='player__row-metric'>{Math.round(stats.tdp) || 0}</div>
            <div className='player__row-metric'>{Math.round(stats.ints) || 0}</div>
          </div>
        </div>
        <div className='row__group'>
          <div className='row__group-body'>
            <div className='player__row-metric'>{Math.round(stats.ra) || 0}</div>
            <div className='player__row-metric'>{Math.round(stats.ry) || 0}</div>
            <div className='player__row-metric'>{Math.round(stats.tdr) || 0}</div>
            <div className='player__row-metric'>{Math.round(stats.fuml) || 0}</div>
          </div>
        </div>
        <div className='row__group'>
          <div className='row__group-body'>
            <div className='player__row-metric'>{Math.round(stats.trg) || 0}</div>
            <div className='player__row-metric'>{Math.round(stats.rec) || 0}</div>
            <div className='player__row-metric'>{Math.round(stats.recy) || 0}</div>
            <div className='player__row-metric'>{Math.round(stats.tdrec) || 0}</div>
          </div>
        </div>
        {action}
      </div>
    )
  }
}
