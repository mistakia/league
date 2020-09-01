import React from 'react'
import moment from 'moment'
import Alert from '@material-ui/lab/Alert'
import AlertTitle from '@material-ui/lab/AlertTitle'
import { SortableContainer, SortableElement } from 'react-sortable-hoc'
import Container from '@material-ui/core/Container'
import Grid from '@material-ui/core/Grid'

import DashboardTeamSummary from '@components/dashboard-team-summary'
import DashboardTeamValue from '@components/dashboard-team-value'
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

  const reserveIRItems = []
  for (const player of players.ir) {
    if (!player.player) continue
    reserveIRItems.push(<PlayerRoster key={player.player} player={player} />)

    if (!player.status || player.status === 'Active') {
      warnings.push(
        <Alert key={player.player} severity='error'>
          <AlertTitle>{player.name} not eligible for Reserve/IR</AlertTitle>
          You will need to activate or release him before you can make any acquisitions or claims.
        </Alert>
      )
    }
  }

  const reserveCOVItems = []
  for (const player of players.cov) {
    if (!player.player) continue
    reserveCOVItems.push(<PlayerRoster key={player.player} player={player} />)

    if (player.status !== 'Reserve/COVID-19') {
      warnings.push(
        <Alert key={player.player} severity='error'>
          <AlertTitle>{player.name} not eligible for Reserve/COVID-19</AlertTitle>
          You will need to activate or release him before you can make any acquisitions or claims.
        </Alert>
      )
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
  for (const [index, poach] of poaches.entries()) {
    if (poach.tid !== teamId) continue
    poachItems.push(
      <PlayerRoster
        key={index}
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
    <div className='section'>
      <div className='dashboard__section-header-title'>Poaching Waiver Claims</div>
      <div className='dashboard__section-body-header'>
        <div className='player__item-name'>Poach</div>
        <div className='player__item-name'>Release</div>
        <div className='player__item-metric'>Bid</div>
        <ValueHeader />
        <StartsHeader />
        <PointsPlusHeader />
        <BenchPlusHeader />
        <div className='player__item-action' />
        <div className='player__item-action' />
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
    <div className='section'>
      <div className='dashboard__section-header-title'>Free Agency Waiver Claims - Active Roster</div>
      <div className='dashboard__section-body-header'>
        <div className='player__item-name'>Sign</div>
        <div className='player__item-name'>Release</div>
        <div className='player__item-metric'>Bid</div>
        <ValueHeader />
        <StartsHeader />
        <PointsPlusHeader />
        <BenchPlusHeader />
        <div className='player__item-action' />
        <div className='player__item-action' />
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
    <div className='section'>
      <div className='dashboard__section-header-title'>Free Agency Waiver Claims - Practice Squad</div>
      <div className='dashboard__section-body-header'>
        <div className='player__item-name'>Sign</div>
        <div className='player__item-name'>Release</div>
        <div className='player__item-metric'>Bid</div>
        <ValueHeader />
        <StartsHeader />
        <PointsPlusHeader />
        <BenchPlusHeader />
        <div className='player__item-action' />
        <div className='player__item-action' />
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
    <div className='section'>
      <div className='dashboard__section-header-title'>Poaching Claims</div>
      <div className='dashboard__section-body-header'>
        <div className='player__item-name'>Name</div>
        <div className='player__item-name'>Release</div>
        <div className='player__item-metric'>Bid</div>
        <ValueHeader />
        <StartsHeader />
        <PointsPlusHeader />
        <BenchPlusHeader />
        <div className='player__item-action' />
      </div>
      <div className='dashboard__section-body empty'>
        {poachItems}
      </div>
    </div>
  )

  const body = (
    <Container maxWidth='lg' classes={{ root: 'dashboard' }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          {warnings.length ? warnings : null}
          {waivers.poach.size ? poachWaiverSection : null}
          {waivers.active.size ? freeAgencyActiveWaiverSection : null}
          {waivers.practice.size ? freeAgencyPracticeWaiverSection : null}
          {poachItems.length ? teamPoachSection : null}
          <div className='section'>
            <div className='dashboard__section-header-title'>Active Roster</div>
            <div className='dashboard__section-body-header'>
              <div className='player__item-name'>Name</div>
              <div className='player__item-metric'>Salary</div>
              <ValueHeader />
              <StartsHeader />
              <PointsPlusHeader />
              <BenchPlusHeader />
              <div className='player__item-action' />
            </div>
            <div className='dashboard__section-body empty'>
              {activeItems}
            </div>
          </div>
          <div className='section'>
            <div className='dashboard__section-header-title'>Practice Squad</div>
            <div className='dashboard__section-body-header'>
              <div className='player__item-name'>Name</div>
              <div className='player__item-metric'>Salary</div>
              <ValueHeader />
              <StartsHeader />
              <PointsPlusHeader />
              <BenchPlusHeader />
              <div className='player__item-action' />
            </div>
            <div className='dashboard__section-body empty'>
              {practiceItems}
            </div>
          </div>
          <div className='section'>
            <div className='dashboard__section-header-title'>Reserve/IR</div>
            <div className='dashboard__section-body-header'>
              <div className='player__item-name'>Name</div>
              <div className='player__item-metric'>Salary</div>
              <ValueHeader />
              <StartsHeader />
              <PointsPlusHeader />
              <BenchPlusHeader />
              <div className='player__item-action' />
            </div>
            <div className='dashboard__section-body empty'>
              {reserveIRItems}
            </div>
          </div>
          <div className='section'>
            <div className='dashboard__section-header-title'>Reserve/COVID-19</div>
            <div className='dashboard__section-body-header'>
              <div className='player__item-name'>Name</div>
              <div className='player__item-metric'>Salary</div>
              <ValueHeader />
              <StartsHeader />
              <PointsPlusHeader />
              <BenchPlusHeader />
              <div className='player__item-action' />
            </div>
            <div className='dashboard__section-body empty'>
              {reserveCOVItems}
            </div>
          </div>
          <div className='section'>
            <div className='dashboard__section-header-title'>Draft Picks</div>
            <div className='dashboard__section-body-header'>
              <div className='player__item-name'>Year</div>
              <div className='player__item-metric'>Pick</div>
              <div className='player__item-metric'>Round</div>
              <div className='player__item-metric'>Pick #</div>
            </div>
            <div className='dashboard__section-body empty'>
              {pickItems}
            </div>
          </div>
        </Grid>
        <Grid item xs={12} md={4}>
          <DashboardTeamSummary />
          <DashboardTeamValue />
        </Grid>
      </Grid>
    </Container>
  )

  return (
    <PageLayout body={body} scroll />
  )
}
