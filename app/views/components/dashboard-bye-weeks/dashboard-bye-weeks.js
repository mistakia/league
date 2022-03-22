import React from 'react'
import PropTypes from 'prop-types'
import Popover from '@material-ui/core/Popover'

import { constants } from '@common'
import Position from '@components/position'

import './dashboard-bye-weeks.styl'

const weeksRemaining = constants.season.finalWeek - constants.season.week

function ByeWeekPopover({ players, bye }) {
  const [anchorEl, setAnchorEl] = React.useState(null)

  const items = []
  const labels = []
  const sorted = players.sort(
    (a, b) => b.getIn(['lineups', 'starts']) - a.getIn(['lineups', 'starts'])
  )
  for (const [index, player] of sorted.entries()) {
    const starts = player.getIn(['lineups', 'starts'], 0)
    // TODO - use global variable tied to settings
    const isStarter = starts / weeksRemaining > 0.4
    const classNames = ['dashboard__bye-week-row-item']
    if (isStarter) classNames.push('starter')

    labels.push(
      <div key={index} className='dashboard__bye-week-pop-player'>
        {player.name} ({player.pos} - {player.team})
      </div>
    )

    items.push(
      <div key={index} className={classNames.join(' ')}>
        <Position pos={player.pos} />
      </div>
    )
  }

  const handlePopoverOpen = (event) => setAnchorEl(event.currentTarget)
  const handlePopoverClose = () => setAnchorEl(null)
  const open = Boolean(anchorEl)

  return (
    <div>
      <div
        className='dashboard__bye-week-row-body'
        onMouseEnter={handlePopoverOpen}
        onMouseLeave={handlePopoverClose}
      >
        {items}
      </div>
      <Popover
        style={{ pointerEvents: 'none' }}
        open={open}
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left'
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left'
        }}
        onClose={handlePopoverClose}
        disableRestoreFocus
      >
        <div className='dashboard__bye-week-pop-label'>Week {bye} Byes</div>
        {labels}
      </Popover>
    </div>
  )
}

ByeWeekPopover.propTypes = {
  players: PropTypes.array,
  bye: PropTypes.string
}

export default class DashboardByeWeeks extends React.Component {
  render = () => {
    const { byes } = this.props
    const items = []
    for (const bye in byes) {
      const players = byes[bye]
      items.push(
        <div key={bye} className='dashboard__bye-week-row'>
          <div className='dashboard__bye-week-row-label metric'>W{bye}</div>
          <ByeWeekPopover players={players} bye={bye} />
        </div>
      )
    }
    return (
      <div className='dashboard__bye-week'>
        <div className='dashboard__section-side-title'>Bye Weeks</div>
        {items}
      </div>
    )
  }
}

DashboardByeWeeks.propTypes = {
  byes: PropTypes.object
}
