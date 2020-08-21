import React from 'react'
import moment from 'moment'
import Alert from '@material-ui/lab/Alert'
import { SortableContainer, SortableElement } from 'react-sortable-hoc'

import PlayerRosterHeader from '@components/player-roster-header'
import PlayerRoster from '@components/player-roster'
import PageLayout from '@layouts/page'
import { constants } from '@common'

import './dashboard.styl'

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

export default function () {
  const {
    players, picks, league, waivers, reorderWaivers, poaches, teamId
  } = this.props
  const { positions } = constants

  const warnings = []

  const groups = {}
  for (const position of positions) {
    if (!groups[position]) groups[position] = []
    groups[position] = players.active
      .filter(p => p.pos1 === position)
      .sort((a, b) => b.getIn(['lineups', 'starts'], 0) - a.getIn(['lineups', 'starts'], 0))
  }

  const activeItems = []
  for (const position in groups) {
    const players = groups[position]
    for (const player of players) {
      if (!player.player) continue
      activeItems.push(<PlayerRoster key={player.player} player={player} />)
    }
  }

  const practiceItems = []
  for (const player of players.practice) {
    if (!player.player) continue
    practiceItems.push(<PlayerRoster key={player.player} player={player} />)

    const poach = poaches.find(p => p.player.player === player.player)
    if (poach) {
      const processingTime = moment(poach.submitted, 'X').add('48', 'hours')
      warnings.push(
        <Alert key={player.player} severity='warning'>{player.name} has a poaching claim that will be processed {processingTime.fromNow()} on {processingTime.format('dddd, h:mm a')}.</Alert>
      )
    }
  }

  const pickItems = []
  for (const pick of picks) {
    const pickNum = (pick.pick % league.nteams) || league.nteams
    const pickStr = `${pick.round}.${('0' + pickNum).slice(-2)}`
    pickItems.push(
      <div key={pick.uid} className='player__item'>
        <div className='player__item-name'>{pick.year}</div>
        <div className='player__item-metric'>{pick.pick && pickStr}</div>
        <div className='player__item-metric'>{pick.round}</div>
        <div className='player__item-metric'>{pick.pick}</div>
      </div>
    )
  }

  const poachItems = []
  for (const poach of poaches) {
    if (poach.tid !== teamId) continue
    poachItems.push(
      <PlayerRoster
        key={poach.player.player}
        claim={poach}
        player={poach.player}
      />
    )
  }

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

  const poachWaiverSection = (
    <div className='dashboard__section'>
      <div className='dashboard__section-header'>
        <div className='dashboard__section-header-title'>Poaching Waiver Claims</div>
        <div className='dashboard__section-body-header'>
          <div className='player__item-position' />
          <div className='player__item-name'>Name</div>
          <div className='player__item-name'>Drop</div>
          <div className='player__item-metric'>Bid</div>
          <ValueHeader />
          <StartsHeader />
          <PointsPlusHeader />
          <BenchPlusHeader />
          <div className='player__item-action' />
          <div className='player__item-action' />
        </div>
      </div>
      <div className='dashboard__section-body empty'>
        <SortableList
          items={waivers.poach}
          lockAxis='y'
          helperClass='reordering'
          onSortEnd={({ oldIndex, newIndex }) => reorderWaivers({ oldIndex, newIndex, type: 'poach' })}
          lockToContainerEdges
          useDragHandle
        />
      </div>
    </div>
  )

  const freeAgencyActiveWaiverSection = (
    <div className='dashboard__section'>
      <div className='dashboard__section-header'>
        <div className='dashboard__section-header-title'>Free Agency Waiver Claims - Active Roster</div>
        <div className='dashboard__section-body-header'>
          <div className='player__item-position' />
          <div className='player__item-name'>Name</div>
          <div className='player__item-name'>Drop</div>
          <div className='player__item-metric'>Bid</div>
          <ValueHeader />
          <StartsHeader />
          <PointsPlusHeader />
          <BenchPlusHeader />
          <div className='player__item-action' />
          <div className='player__item-action' />
        </div>
      </div>
      <div className='dashboard__section-body empty'>
        <SortableList
          items={waivers.active}
          lockAxis='y'
          helperClass='reordering'
          onSortEnd={({ oldIndex, newIndex }) => reorderWaivers({ oldIndex, newIndex, type: 'active' })}
          lockToContainerEdges
          useDragHandle
        />
      </div>
    </div>
  )

  const freeAgencyPracticeWaiverSection = (
    <div className='dashboard__section'>
      <div className='dashboard__section-header'>
        <div className='dashboard__section-header-title'>Free Agency Waiver Claims - Practice Squad</div>
        <div className='dashboard__section-body-header'>
          <div className='player__item-position' />
          <div className='player__item-name'>Name</div>
          <div className='player__item-name'>Drop</div>
          <div className='player__item-metric'>Bid</div>
          <ValueHeader />
          <StartsHeader />
          <PointsPlusHeader />
          <BenchPlusHeader />
          <div className='player__item-action' />
          <div className='player__item-action' />
        </div>
      </div>
      <div className='dashboard__section-body empty'>
        <SortableList
          items={waivers.practice}
          lockAxis='y'
          helperClass='reordering'
          onSortEnd={({ oldIndex, newIndex }) => reorderWaivers({ oldIndex, newIndex, type: 'practice' })}
          lockToContainerEdges
          useDragHandle
        />
      </div>
    </div>
  )

  const teamPoachSection = (
    <div className='dashboard__section'>
      <div className='dashboard__section-header'>
        <div className='dashboard__section-header-title'>Poaching Claims</div>
        <div className='dashboard__section-body-header'>
          <div className='player__item-position' />
          <div className='player__item-name'>Name</div>
          <div className='player__item-name'>Drop</div>
          <div className='player__item-metric'>Bid</div>
          <ValueHeader />
          <StartsHeader />
          <PointsPlusHeader />
          <BenchPlusHeader />
          <div className='player__item-action' />
        </div>
      </div>
      <div className='dashboard__section-body empty'>
        {poachItems}
      </div>
    </div>
  )

  const body = (
    <div className='dashboard'>
      {warnings.length ? warnings : null}
      {waivers.poach.size ? poachWaiverSection : null}
      {waivers.active.size ? freeAgencyActiveWaiverSection : null}
      {waivers.practice.size ? freeAgencyPracticeWaiverSection : null}
      {poachItems.length ? teamPoachSection : null}
      <div className='dashboard__section'>
        <div className='dashboard__section-header'>
          <div className='dashboard__section-header-title'>Active Roster</div>
          <div className='dashboard__section-body-header'>
            <div className='player__item-position' />
            <div className='player__item-name'>Name</div>
            <ValueHeader />
            <StartsHeader />
            <PointsPlusHeader />
            <BenchPlusHeader />
            <div className='player__item-action' />
          </div>
        </div>
        <div className='dashboard__section-body empty'>
          {activeItems}
        </div>
      </div>
      <div className='dashboard__section'>
        <div className='dashboard__section-header'>
          <div className='dashboard__section-header-title'>Practice Squad</div>
          <div className='dashboard__section-body-header'>
            <div className='player__item-position' />
            <div className='player__item-name'>Name</div>
            <ValueHeader />
            <StartsHeader />
            <PointsPlusHeader />
            <BenchPlusHeader />
            <div className='player__item-action' />
          </div>
        </div>
        <div className='dashboard__section-body empty'>
          {practiceItems}
        </div>
      </div>
      <div className='dashboard__section'>
        <div className='dashboard__section-header'>
          <div className='dashboard__section-header-title'>Draft Picks</div>
          <div className='dashboard__section-body-header'>
            <div className='player__item-name'>Year</div>
            <div className='player__item-metric'>Pick</div>
            <div className='player__item-metric'>Round</div>
            <div className='player__item-metric'>Pick #</div>
          </div>
        </div>
        <div className='dashboard__section-body empty'>
          {pickItems}
        </div>
      </div>
    </div>
  )

  return (
    <PageLayout body={body} scroll />
  )
}
