import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import { SortableContainer, SortableElement } from 'react-sortable-hoc'
import Toolbar from '@mui/material/Toolbar'

import { constants } from '@common'
import PlayerRoster from '@components/player-roster'
import PlayerRosterHeader from '@components/player-roster-header'
import PlayerRosterTotal from '@components/player-roster-total'

import './dashboard-players-table.styl'

export default class DashboardPlayersTable extends React.Component {
  constructor(props) {
    super(props)
    this.ref = React.createRef()
  }

  render = () => {
    const {
      isBeforeExtensionDeadline,
      items = [],
      cutlist,
      title,
      poaches,
      claims,
      total,
      waiverType,
      reorderWaivers,
      reorderCutlist,
      leadColumn = '',
      space,
      isTransition
    } = this.props

    const { isOffseason, isRegularSeason } = constants
    const isWaiver = Boolean(waiverType)
    const isPoach = Boolean(poaches)
    const isClaim = isWaiver || isPoach
    const showReorder = Boolean(isWaiver || (cutlist && cutlist.size))

    const SortableItem = SortableElement(({ waiver }) => {
      return (
        <PlayerRoster
          pid={waiver.pid}
          waiverId={waiver.uid}
          claim={waiver}
          playerMap={waiver.playerMap}
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
          <PlayerRoster
            key={index}
            claim={poach}
            poachId={poach.uid}
            pid={poach.pid}
            playerMap={poach.playerMap}
          />
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
    } else if (cutlist) {
      const SortableItem = SortableElement(({ playerMap }) => {
        return <PlayerRoster playerMap={playerMap} reorder />
      })

      const SortableCutlist = SortableContainer(({ items }) => {
        return (
          <div>
            {items.map((playerMap, index) => (
              <SortableItem key={index} index={index} playerMap={playerMap} />
            ))}
          </div>
        )
      })

      body = (
        <div ref={this.ref}>
          <SortableCutlist
            items={cutlist}
            lockAxis='y'
            helperClass='reordering'
            onSortEnd={reorderCutlist}
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
    if (cutlist) classNames.push('cutlist')

    const week = Math.max(constants.week, 1)

    let summary
    if (typeof space !== 'undefined') {
      summary = (
        <div className='section__summary'>
          <div className='section__summary-item'>Rostered: {items.length}</div>
          <div className='section__summary-item'>Space: {space}</div>
        </div>
      )
    }

    const baseYear = isBeforeExtensionDeadline
      ? constants.year - 1
      : constants.year

    return (
      <div className={classNames.join(' ')}>
        <Toolbar variant='dense'>
          <div className='dashboard__section-header-title'>{title}</div>
          {Boolean(summary) && summary}
        </Toolbar>
        <div className='table__container'>
          <div className='table__row table__head'>
            {showReorder && <div className='player__item-action table__cell' />}
            <div className='player__item-name table__cell sticky__column'>
              {leadColumn}
            </div>
            {isClaim && (
              <div className='player__item-name table__cell'>Release</div>
            )}
            {Boolean(isTransition) && (
              <div className='table__cell player__item-team'>Team</div>
            )}
            {(isWaiver || isTransition) && (
              <div className='metric table__cell'>Bid</div>
            )}
            {!isWaiver && (
              <div className='metric table__cell'>{`${baseYear} Salary`}</div>
            )}
            {!isWaiver && !isPoach && !isOffseason && (
              <div className='metric table__cell'>{`${
                baseYear + 1
              } Salary`}</div>
            )}
            {!isWaiver && !isPoach && isOffseason && (
              <div className='table__cell metric'>
                <PlayerRosterHeader
                  tooltip='Market Salary adjusted for player availability and salary space'
                  title='Market Salary Adjusted'
                />
              </div>
            )}
            {!isWaiver && !isPoach && isOffseason && (
              <div className='table__cell metric'>
                <PlayerRosterHeader
                  tooltip='Salary based on projected points over baseline player'
                  title='Market Salary'
                />
              </div>
            )}
            {isOffseason && (
              <div className='table__cell metric'>
                <PlayerRosterHeader
                  tooltip='Difference between a players salary and the market salary'
                  title='Market Savings'
                />
              </div>
            )}
            {isRegularSeason && (
              <div className='table__cell metric'>
                <PlayerRosterHeader
                  tooltip='Points produced above baseline starter'
                  title='Pts+'
                />
              </div>
            )}
            {isRegularSeason && (
              <div className='table__cell metric'>
                <PlayerRosterHeader
                  tooltip='Rank among all players in points produced above baseline starter'
                  title='Pts+ Rank'
                />
              </div>
            )}
            {isRegularSeason && (
              <div className='table__cell metric'>
                <PlayerRosterHeader
                  tooltip='Rank among position players in points produced above baseline starter'
                  title='Pts+ Pos Rank'
                />
              </div>
            )}
            <div className='table__cell metric'>
              <PlayerRosterHeader
                tooltip='Projected points over baseline player'
                title='Projected Pts+'
              />
            </div>
            {isOffseason && (
              <div className='table__cell metric'>
                <PlayerRosterHeader
                  tooltip='Salary Adjusted points over baseline player'
                  title='Value'
                />
              </div>
            )}
            {isRegularSeason && (
              <div className='table__cell metric'>Week {week}</div>
            )}
            <div className='table__cell metric'>
              <PlayerRosterHeader
                tooltip='Projected games started'
                title='Projected Starts'
              />
            </div>
            <div className='table__cell metric'>
              <PlayerRosterHeader
                tooltip='Projected starter points you would lose without player'
                title='Start Points'
              />
            </div>
            <div className='table__cell metric'>
              <PlayerRosterHeader
                tooltip='Projected bench points you would lose without player'
                title='Bench Points'
              />
            </div>
          </div>
          {Boolean(total && total.size) && (
            <PlayerRosterTotal
              players={total}
              reorder={showReorder}
              isBeforeExtensionDeadline={isBeforeExtensionDeadline}
            />
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
  title: PropTypes.node,
  poaches: ImmutablePropTypes.list,
  claims: ImmutablePropTypes.list,
  waiverType: PropTypes.string,
  reorderWaivers: PropTypes.func,
  leadColumn: PropTypes.string,
  space: PropTypes.number,
  total: ImmutablePropTypes.list,
  cutlist: ImmutablePropTypes.list,
  reorderCutlist: PropTypes.func,
  isTransition: PropTypes.bool
}
