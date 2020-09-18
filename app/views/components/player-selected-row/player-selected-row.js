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
            <div className='player__row-metric'>{stats.py ? (stats.py || 0).toFixed(1) : '-'}</div>
            <div className='player__row-metric'>{stats.tdp ? (stats.tdp || 0).toFixed(1) : '-'}</div>
            <div className='player__row-metric'>{stats.ints ? (stats.ints || 0).toFixed(1) : '-'}</div>
          </div>
        </div>
        <div className='row__group'>
          <div className='row__group-body'>
            <div className='player__row-metric'>{stats.ra ? (stats.ra || 0).toFixed(1) : '-'}</div>
            <div className='player__row-metric'>{stats.ry ? (stats.ry || 0).toFixed(1) : '-'}</div>
            <div className='player__row-metric'>{stats.tdr ? (stats.tdr || 0).toFixed(1) : '-'}</div>
            <div className='player__row-metric'>{stats.fuml ? (stats.fuml || 0).toFixed(1) : '-'}</div>
          </div>
        </div>
        <div className='row__group'>
          <div className='row__group-body'>
            <div className='player__row-metric'>{stats.trg ? (stats.trg || 0).toFixed(1) : '-'}</div>
            <div className='player__row-metric'>{stats.rec ? (stats.rec || 0).toFixed(1) : '-'}</div>
            <div className='player__row-metric'>{stats.recy ? (stats.recy || 0).toFixed(1) : '-'}</div>
            <div className='player__row-metric'>{stats.tdrec ? (stats.tdrec || 0).toFixed(1) : '-'}</div>
          </div>
        </div>
        {action}
      </div>
    )
  }
}
