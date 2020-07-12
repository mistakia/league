import React from 'react'
import { AutoSizer, List } from 'react-virtualized'

import SearchFilter from '@components/search-filter'
import PositionFilter from '@components/position-filter'
import ExperienceFilter from '@components/experience-filter'
import AgeFilter from '@components/age-filter'
import PageLayout from '@layouts/page'
import PlayerHeader from '@components/player-header'
import PlayerRow from '@components/player-row'
import PlayersViewMenu from '@components/players-view-menu'
import StatMenu from '@components/stat-menu'
import StatPassingMenu from '@components/stat-passing-menu'
import StatYearsFilter from '@components/stat-years-filter'
import StatWeeksFilter from '@components/stat-weeks-filter'
import StatDaysFilter from '@components/stat-days-filter'
import StatQuartersFilter from '@components/stat-quarters-filter'
import StatDownsFilter from '@components/stat-downs-filter'
import HeaderStatsPassingBasic from '@components/header-stats-passing-basic'
import HeaderStatsPassingEfficiency from '@components/header-stats-passing-efficiency'
import HeaderStatsPassingAdvanced from '@components/header-stats-passing-advanced'
import HeaderStatsPassingAiryards from '@components/header-stats-passing-airyards'
import HeaderStatsPassingPressure from '@components/header-stats-passing-pressure'
import HeaderStatsRushingBasic from '@components/header-stats-rushing-basic'
import HeaderStatsRushingProductivity from '@components/header-stats-rushing-productivity'
import HeaderStatsRushingAfterContact from '@components/header-stats-rushing-after-contact'
import HeaderStatsRushingShare from '@components/header-stats-rushing-share'
import HeaderStatsRushingAdvanced from '@components/header-stats-rushing-advanced'
import HeaderStatsRushingBrokenTackles from '@components/header-stats-rushing-broken-tackles'
import HeaderStatsReceivingBasic from '@components/header-stats-receiving-basic'
import HeaderStatsReceivingOppurtunity from '@components/header-stats-receiving-oppurtunity'
import HeaderStatsReceivingAdvanced from '@components/header-stats-receiving-advanced'
import SelectedPlayer from '@components/selected-player'
import Loading from '@components/loading'

import './players.styl'

const ROW_HEIGHT = 30

export default class PlayersPage extends React.Component {
  list = React.createRef()

  componentDidUpdate = (prevProps) => {
    if (!this.list.current) return

    if (prevProps.order !== this.props.order || prevProps.orderBy !== this.props.orderBy) {
      this.list.current.scrollToPosition(0)
    }

    if (this.props.selected) {
      const index = this.props.players.findIndex(p => p.player === this.props.selected)
      this.list.current.scrollToRow(index)
    }
  }

  render = () => {
    const {
      players, vbaseline, isSeasonProjectionView, isStatsView, isStatsPassingView,
      isStatsRushingView, isStatsReceivingView, isStatsPassingAdvancedView,
      isStatsPassingPressureView, isPending
    } = this.props

    const Row = ({ index, key, parent, ...params }) => {
      const player = players.get(index).toJS()
      return (
        <PlayerRow key={key} player={player} {...params} />
      )
    }

    const headerSeasonPassing = (
      <div className='player__row-group'>
        <div className='player__row-group-head'>Passing</div>
        <div className='player__row-group-body'>
          <PlayerHeader className='player__row-metric' label='YDS' value='projection.py' />
          <PlayerHeader className='player__row-metric' label='TD' value='projection.tdp' />
          <PlayerHeader className='player__row-metric' label='INT' value='projection.ints' />
        </div>
      </div>
    )

    const headerSeasonRushing = (
      <div className='player__row-group'>
        <div className='player__row-group-head'>Rushing</div>
        <div className='player__row-group-body'>
          <PlayerHeader className='player__row-metric' label='CAR' value='projection.ra' />
          <PlayerHeader className='player__row-metric' label='YDS' value='projection.ry' />
          <PlayerHeader className='player__row-metric' label='TD' value='projection.tdr' />
          <PlayerHeader className='player__row-metric' label='FUM' value='projection.fuml' />
        </div>
      </div>
    )

    const headerSeasonReceiving = (
      <div className='player__row-group'>
        <div className='player__row-group-head'>Receiving</div>
        <div className='player__row-group-body'>
          <PlayerHeader className='player__row-metric' label='TAR' value='projection.trg' />
          <PlayerHeader className='player__row-metric' label='REC' value='projection.rec' />
          <PlayerHeader className='player__row-metric' label='YDS' value='projection.recy' />
          <PlayerHeader className='player__row-metric' label='TD' value='projection.tdrec' />
        </div>
      </div>
    )

    const valueType = `values.${vbaseline}`
    const vorpType = `vorp.${vbaseline}`
    const headerSeasonSummary = (
      <div className='player__row-group'>
        <div className='player__row-group-body'>
          <PlayerHeader
            className='player__row-metric'
            label='Cost'
            value={valueType}
          />
          <PlayerHeader
            className='player__row-metric'
            label='Value'
            value={vorpType}
          />
          <PlayerHeader
            className='player__row-metric'
            label='Proj'
            value='points.total'
          />
        </div>
      </div>
    )

    const head = (
      <div className='players__head'>
        <div className='players__filter'>
          <SearchFilter search={this.props.search} value={this.props.searchValue} />
          <PositionFilter />
          <ExperienceFilter />
          <AgeFilter />
          <PlayersViewMenu />
          {isStatsView && <StatMenu />}
          {isStatsPassingView && <StatPassingMenu />}
          {isStatsView && <StatYearsFilter />}
          {isStatsView && <StatWeeksFilter />}
          {isStatsView && <StatDaysFilter />}
          {isStatsView && <StatQuartersFilter />}
          {isStatsView && <StatDownsFilter />}
        </div>
        <div className='players__header'>
          <div className='player__row-action' />
          <div className='player__row-pos' />
          <div className='player__row-name'>Name</div>
          {isSeasonProjectionView && headerSeasonSummary}
          {isSeasonProjectionView && headerSeasonPassing}
          {isSeasonProjectionView && headerSeasonRushing}
          {isSeasonProjectionView && headerSeasonReceiving}
          {isStatsPassingAdvancedView && <HeaderStatsPassingBasic />}
          {isStatsPassingAdvancedView && <HeaderStatsPassingEfficiency />}
          {isStatsPassingAdvancedView && <HeaderStatsPassingAdvanced />}
          {isStatsPassingAdvancedView && <HeaderStatsPassingAiryards />}
          {isStatsPassingPressureView && <HeaderStatsPassingPressure />}
          {isStatsRushingView && <HeaderStatsRushingBasic />}
          {isStatsRushingView && <HeaderStatsRushingProductivity />}
          {isStatsRushingView && <HeaderStatsRushingAfterContact />}
          {isStatsRushingView && <HeaderStatsRushingShare />}
          {isStatsRushingView && <HeaderStatsRushingAdvanced />}
          {isStatsRushingView && <HeaderStatsRushingBrokenTackles />}
          {isStatsReceivingView && <HeaderStatsReceivingBasic />}
          {isStatsReceivingView && <HeaderStatsReceivingOppurtunity />}
          {isStatsReceivingView && <HeaderStatsReceivingAdvanced />}
        </div>
      </div>
    )

    const body = isPending ? (
      <Loading loading />
    ) : (
      <AutoSizer>
        {({ height, width }) => (
          <List
            ref={this.list}
            className='players'
            width={width}
            height={height}
            rowHeight={ROW_HEIGHT}
            rowCount={players.size}
            rowRenderer={Row}
          />
        )}
      </AutoSizer>
    )

    const overlay = <SelectedPlayer />

    return (
      <PageLayout {...{ body, head, overlay }} />
    )
  }
}
