import React from 'react'
import PropTypes from 'prop-types'
import { SortableContainer, SortableElement } from 'react-sortable-hoc'
import Toolbar from '@material-ui/core/Toolbar'

import { constants } from '@common'
import PlayerRoster from '@components/player-roster'
import PlayerRosterHeader from '@components/player-roster-header'

import './dashboard-players-table.styl'

const RecommendedSalaryHeader = () => (
  <PlayerRosterHeader
    tooltip='Recommended Salary based on projected points over baseline player'
    title='Rec Salary'
  />
)

const ValueHeader = () => (
  <PlayerRosterHeader
    tooltip='Projected points over baseline player'
    title='Value'
  />
)

const ValueAdjustedHeader = () => (
  <PlayerRosterHeader
    tooltip='Salary Adjusted Projected points over baseline player'
    title='Adj Value'
  />
)

const StartsHeader = () => (
  <PlayerRosterHeader tooltip='Projected games started' title='Starts' />
)

const PointsPlusHeader = () => (
  <PlayerRosterHeader
    tooltip='Projected starter points you would lose without player'
    title='Pts+'
  />
)

const BenchPlusHeader = () => (
  <PlayerRosterHeader
    tooltip='Projected bench points you would lose without player'
    title='Bench+'
  />
)

const ROSHeader = () => (
  <PlayerRosterHeader
    tooltip='Projected points for the remainder of the season'
    title='ROS'
  />
)

export default class DashboardPlayersTable extends React.Component {
  constructor(props) {
    super(props)
    this.ref = React.createRef()
  }

  render = () => {
    const {
      items = [],
      title,
      poaches,
      claims,
      waiverType,
      reorderWaivers,
      leadColumn = '',
      limit
    } = this.props

    const isWaiver = !!waiverType
    const isPoach = !!poaches
    const isClaim = isWaiver || isPoach

    const SortableItem = SortableElement(({ waiver }) => {
      return (
        <PlayerRoster
          player={waiver.player}
          waiverId={waiver.uid}
          claim={waiver}
          reorder
        />
      )
    })

    const SortableList = SortableContainer(({ items }) => {
      return (
        <div>
          {items.map((waiver, index) => (
            <SortableItem key={index} index={index} waiver={waiver} />
          ))}
        </div>
      )
    })

    if (isPoach) {
      poaches.forEach((poach, index) => {
        items.push(
          <PlayerRoster key={index} claim={poach} poach player={poach.player} />
        )
      })
    }

    let body
    if (isWaiver) {
      body = (
        <div ref={this.ref}>
          <SortableList
            items={claims}
            lockAxis='y'
            helperClass='reordering'
            onSortEnd={({ oldIndex, newIndex }) =>
              reorderWaivers({ oldIndex, newIndex, type: waiverType })
            }
            helperContainer={this.ref.current}
            lockToContainerEdges
            useDragHandle
          />
        </div>
      )
    } else {
      body = <div className='empty'>{items}</div>
    }

    const classNames = ['section', 'dashboard__players-table']
    if (isClaim) classNames.push('waiver')

    const week = Math.max(constants.season.week, 1)

    let caption
    if (limit) {
      const space = limit - items.length
      caption = (
        <div className='section__footer'>
          <div className='section__footer-item'>Rostered: {items.length}</div>
          <div className='section__footer-item'>Space: {space}</div>
        </div>
      )
    }

    return (
      <div className={classNames.join(' ')}>
        <Toolbar>
          <div className='dashboard__section-header-title'>{title}</div>
        </Toolbar>
        <div className='table__container'>
          <div className='table__row table__head'>
            {isWaiver && <div className='player__item-action table__cell' />}
            <div className='player__item-name table__cell sticky__column'>
              {leadColumn}
            </div>
            {isClaim && (
              <div className='player__item-name table__cell'>Release</div>
            )}
            {isWaiver && <div className='metric table__cell'>Bid</div>}
            {!isWaiver && <div className='metric table__cell'>Salary</div>}
            <div className='table__cell metric'>
              <RecommendedSalaryHeader />
            </div>
            <div className='table__cell metric'>
              <ValueHeader />
            </div>
            <div className='table__cell metric'>
              <ValueAdjustedHeader />
            </div>
            {constants.season.week > 0 && (
              <div className='table__cell metric'>
                <ROSHeader />
              </div>
            )}
            {constants.season.week > 0 && (
              <div className='table__cell metric'>Week {week}</div>
            )}
            <div className='table__cell metric'>
              <StartsHeader />
            </div>
            <div className='table__cell metric'>
              <PointsPlusHeader />
            </div>
            <div className='table__cell metric'>
              <BenchPlusHeader />
            </div>
          </div>
          {body}
        </div>
        {!!caption && caption}
      </div>
    )
  }
}

DashboardPlayersTable.propTypes = {
  items: PropTypes.array,
  title: PropTypes.string,
  poaches: PropTypes.array,
  claims: PropTypes.array,
  waiverType: PropTypes.string,
  reorderWaivers: PropTypes.func,
  leadColumn: PropTypes.string,
  limit: PropTypes.number
}
