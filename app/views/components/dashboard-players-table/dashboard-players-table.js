import React from 'react'
import { SortableContainer, SortableElement } from 'react-sortable-hoc'
import Paper from '@material-ui/core/Paper'
import Toolbar from '@material-ui/core/Toolbar'

import PlayerRoster from '@components/player-roster'
import PlayerRosterHeader from '@components/player-roster-header'

import './dashboard-players-table.styl'

const ValueHeader = () => (
  <PlayerRosterHeader
    tooltip='Projected points over baseline player'
    title='Value'
  />
)

const StartsHeader = () => (
  <PlayerRosterHeader
    tooltip='Projected games started'
    title='Starts'
  />
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

export default class DashboardPlayersTable extends React.Component {
  constructor (props) {
    super(props)
    this.ref = React.createRef()
  }

  render = () => {
    const { items, title, claim, claims, reorderType, reorderWaivers, leadColumn = 'Name' } = this.props

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

    let body
    if (reorderType) {
      body = (
        <div ref={this.ref}>
          <SortableList
            items={claims}
            lockAxis='y'
            helperClass='reordering'
            onSortEnd={({ oldIndex, newIndex }) => reorderWaivers({ oldIndex, newIndex, type: reorderType })}
            helperContainer={this.ref.current}
            lockToContainerEdges
            useDragHandle
          />
        </div>
      )
    } else {
      body = (
        <div className='empty'>
          {items}
        </div>
      )
    }

    const classNames = ['dashboard__players-table']
    if (claim) classNames.push('waiver')

    return (
      <Paper classes={{ root: classNames.join(' ') }}>
        <Toolbar>
          <div className='dashboard__section-header-title'>{title}</div>
        </Toolbar>
        <div className='table__container'>
          <div className='table__row table__head'>
            {claim && <div className='player__item-action table__cell' />}
            <div className='player__item-name table__cell sticky__column'>
              {leadColumn}
            </div>
            {claim &&
              <div className='player__item-name table__cell'>Release</div>}
            {claim &&
              <div className='metric table__cell'>Bid</div>}
            {!claim &&
              <div className='metric table__cell'>Salary</div>}
            <div className='table__cell'><ValueHeader /></div>
            <div className='table__cell'><StartsHeader /></div>
            <div className='table__cell'><PointsPlusHeader /></div>
            <div className='table__cell'><BenchPlusHeader /></div>
          </div>
          {body}
        </div>
      </Paper>
    )
  }
}
