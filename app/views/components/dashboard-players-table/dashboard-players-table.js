import React from 'react'
import PropTypes from 'prop-types'
import { SortableContainer, SortableElement } from 'react-sortable-hoc'
import Toolbar from '@material-ui/core/Toolbar'

import { constants } from '@common'
import PlayerRoster from '@components/player-roster'
import PlayerRosterHeader from '@components/player-roster-header'
import PlayerRosterTotal from '@components/player-roster-total'

import './dashboard-players-table.styl'

const MarketSalaryHeader = () => (
  <PlayerRosterHeader
    tooltip='Salary based on projected points over baseline player'
    title='Market Salary'
  />
)

const SalaryDifferenceHeader = () => (
  <PlayerRosterHeader
    tooltip='Difference between a players salary and the market salary'
    title='Diff.'
  />
)

const ValueHeader = () => (
  <PlayerRosterHeader
    tooltip='Projected points over baseline player'
    title='Market Value'
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
    title='Start Points'
  />
)

const BenchPlusHeader = () => (
  <PlayerRosterHeader
    tooltip='Projected bench points you would lose without player'
    title='Bench Points'
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
      isBeforeExtensionDeadline,
      items = [],
      title,
      poaches,
      claims,
      total,
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

    let summary
    if (limit) {
      const space = limit - items.length
      summary = (
        <div className='section__summary'>
          <div className='section__summary-item'>Rostered: {items.length}</div>
          <div className='section__summary-item'>Space: {space}</div>
        </div>
      )
    }

    const baseYear = isBeforeExtensionDeadline
      ? constants.season.year - 1
      : constants.season.year

    return (
      <div className={classNames.join(' ')}>
        <Toolbar>
          <div className='dashboard__section-header-title'>{title}</div>
          {Boolean(summary) && summary}
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
            {!isWaiver && (
              <div className='metric table__cell'>{`${baseYear} Salary`}</div>
            )}
            {!isWaiver && !isPoach && (
              <div className='metric table__cell'>{`${
                baseYear + 1
              } Salary`}</div>
            )}
            {!isWaiver && !isPoach && (
              <div className='table__cell metric'>
                <MarketSalaryHeader />
              </div>
            )}
            <div className='table__cell metric'>
              <SalaryDifferenceHeader />
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
          {Boolean(total && total.length) && (
            <PlayerRosterTotal players={total} />
          )}
          {body}
        </div>
      </div>
    )
  }
}

DashboardPlayersTable.propTypes = {
  isBeforeExtensionDeadline: PropTypes.bool,
  items: PropTypes.array,
  title: PropTypes.string,
  poaches: PropTypes.array,
  claims: PropTypes.array,
  waiverType: PropTypes.string,
  reorderWaivers: PropTypes.func,
  leadColumn: PropTypes.string,
  limit: PropTypes.number,
  total: PropTypes.array
}
