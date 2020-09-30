import React from 'react'

const defenseStats = (stats) => (
  <div className='row__group'>
    <div className='row__group-body'>
      <div className='player__row-metric'>{stats.dpa ? (stats.dpa || 0).toFixed(1) : '-'}</div>
      <div className='player__row-metric'>{stats.dya ? (stats.dya || 0).toFixed(1) : '-'}</div>
      <div className='player__row-metric'>{stats.dsk ? (stats.dsk || 0).toFixed(1) : '-'}</div>
      <div className='player__row-metric'>{stats.dint ? (stats.dint || 0).toFixed(1) : '-'}</div>
      <div className='player__row-metric'>{stats.dff ? (stats.dff || 0).toFixed(1) : '-'}</div>
      <div className='player__row-metric'>{stats.drf ? (stats.drf || 0).toFixed(1) : '-'}</div>
      <div className='player__row-metric'>{stats.dtno ? (stats.dtno || 0).toFixed(1) : '-'}</div>
      <div className='player__row-metric'>{stats.dfds ? (stats.dfds || 0).toFixed(1) : '-'}</div>
      <div className='player__row-metric'>{stats.dblk ? (stats.dblk || 0).toFixed(1) : '-'}</div>
      <div className='player__row-metric'>{stats.dsf ? (stats.dsf || 0).toFixed(1) : '-'}</div>
      <div className='player__row-metric'>{stats.dtpr ? (stats.dtpr || 0).toFixed(1) : '-'}</div>
      <div className='player__row-metric'>{stats.dtd ? (stats.dtd || 0).toFixed(1) : '-'}</div>
      <div className='player__row-metric'>{stats.prtd ? (stats.prtd || 0).toFixed(1) : '-'}</div>
      <div className='player__row-metric'>{stats.krtd ? (stats.krtd || 0).toFixed(1) : '-'}</div>
    </div>
  </div>
)

const kickerStats = (stats) => (
  <div className='row__group'>
    <div className='row__group-body'>
      <div className='player__row-metric'>{stats.xpm ? (stats.xpm || 0).toFixed(1) : '-'}</div>
      <div className='player__row-metric'>{stats.fgm ? (stats.fgm || 0).toFixed(1) : '-'}</div>
      <div className='player__row-metric'>{stats.fg19 ? (stats.fg19 || 0).toFixed(1) : '-'}</div>
      <div className='player__row-metric'>{stats.fg29 ? (stats.fg29 || 0).toFixed(1) : '-'}</div>
      <div className='player__row-metric'>{stats.fg39 ? (stats.fg39 || 0).toFixed(1) : '-'}</div>
      <div className='player__row-metric'>{stats.fg49 ? (stats.fg49 || 0).toFixed(1) : '-'}</div>
      <div className='player__row-metric'>{stats.fg50 ? (stats.fg50 || 0).toFixed(1) : '-'}</div>
    </div>
  </div>
)

const playerStats = (stats) => ([
  (
    <div className='row__group' key={0}>
      <div className='row__group-body'>
        <div className='player__row-metric'>{stats.py ? (stats.py || 0).toFixed(1) : '-'}</div>
        <div className='player__row-metric'>{stats.tdp ? (stats.tdp || 0).toFixed(1) : '-'}</div>
        <div className='player__row-metric'>{stats.ints ? (stats.ints || 0).toFixed(1) : '-'}</div>
      </div>
    </div>
  ), (
    <div className='row__group' key={1}>
      <div className='row__group-body'>
        <div className='player__row-metric'>{stats.ra ? (stats.ra || 0).toFixed(1) : '-'}</div>
        <div className='player__row-metric'>{stats.ry ? (stats.ry || 0).toFixed(1) : '-'}</div>
        <div className='player__row-metric'>{stats.tdr ? (stats.tdr || 0).toFixed(1) : '-'}</div>
        <div className='player__row-metric'>{stats.fuml ? (stats.fuml || 0).toFixed(1) : '-'}</div>
      </div>
    </div>
  ), (
    <div className='row__group' key={2}>
      <div className='row__group-body'>
        <div className='player__row-metric'>{stats.trg ? (stats.trg || 0).toFixed(1) : '-'}</div>
        <div className='player__row-metric'>{stats.rec ? (stats.rec || 0).toFixed(1) : '-'}</div>
        <div className='player__row-metric'>{stats.recy ? (stats.recy || 0).toFixed(1) : '-'}</div>
        <div className='player__row-metric'>{stats.tdrec ? (stats.tdrec || 0).toFixed(1) : '-'}</div>
      </div>
    </div>
  )
])

const getStatRows = (pos, stats) => {
  switch (pos) {
    case 'DST':
      return defenseStats(stats)
    case 'K':
      return kickerStats(stats)
    default:
      return playerStats(stats)
  }
}

export default class PlayerSelectedRow extends React.Component {
  render = () => {
    const { title, stats, action, className, games, lead, pos } = this.props
    const classNames = ['player__selected-row']
    if (className) classNames.push(className)
    const rows = getStatRows(pos, stats)
    return (
      <div className={classNames.join(' ')}>
        {lead || <div className='row__name'>{title}</div>}
        {games &&
          <div className='row__single-metric'>{games}</div>}
        {rows}
        {action}
      </div>
    )
  }
}
