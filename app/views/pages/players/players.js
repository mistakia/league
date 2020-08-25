import React from 'react'
import { AutoSizer, List } from 'react-virtualized'
import GetAppIcon from '@material-ui/icons/GetApp'
import IconButton from '@material-ui/core/IconButton'

import SearchFilter from '@components/search-filter'
import StatusFilter from '@components/status-filter'
import PositionFilter from '@components/position-filter'
import ExperienceFilter from '@components/experience-filter'
import AgeFilter from '@components/age-filter'
import PageLayout from '@layouts/page'
import PlayerHeader from '@components/player-header'
import PlayerRow from '@components/player-row'
import PlayersViewMenu from '@components/players-view-menu'
import StatMenu from '@components/stat-menu'
import StatPassingMenu from '@components/stat-passing-menu'
import AvailabilityFilter from '@components/availability-filter'
import StatYearsFilter from '@components/stat-years-filter'
import StatWeeksFilter from '@components/stat-weeks-filter'
import StatDaysFilter from '@components/stat-days-filter'
import StatQuartersFilter from '@components/stat-quarters-filter'
import StatDownsFilter from '@components/stat-downs-filter'
import StatQualifierFilter from '@components/stat-qualifier-filter'
import CollegeFilter from '@components/college-filter'
import CollegeDivisionFilter from '@components/college-division-filter'
import NFLTeamsFilter from '@components/nfl-teams-filter'
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
import Icon from '@components/icon'
import { csv } from '@core/export'
import { constants } from '@common'

import './players.styl'

const ROW_HEIGHT = 30

export default class PlayersPage extends React.Component {
  list = React.createRef()

  constructor (props) {
    super(props)

    this.state = { expanded: false }
  }

  handleClick = (event) => {
    this.setState({ expanded: !this.state.expanded })
  }

  handleExport = () => {
    const { players, vbaseline, isSeasonProjectionView } = this.props
    const type = isSeasonProjectionView ? '0' : 'ros'
    const data = players.map(p => {
      const item = {
        name: p.name,
        team: p.team,
        pos: p.pos1,
        salary: p.getIn(['values', type, vbaseline], 0).toFixed(1),
        inflation: p.getIn(['values', isSeasonProjectionView ? 'inflationSeason' : 'inflation', vbaseline]).toFixed(1),
        vorp: p.getIn(['vorp', type, vbaseline], 0).toFixed(1)
      }

      for (const stat of constants.stats) {
        item[stat] = p.getIn(['projection', type, stat], 0).toFixed(1)
      }

      return item
    })

    csv({
      headers: {
        name: 'Player Name',
        team: 'Team',
        pos: 'Position',
        salary: 'Salary',
        inflation: 'Inflation',
        vorp: 'VORP',
        ...constants.statHeaders
      },
      data: data.toJS(),
      fileName: 'TeflonLeague-' + (isSeasonProjectionView ? 'SeasonProjections' : 'RestOfSeasonProjections')
    })
  }

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
      isStatsPassingPressureView, isPending, showQualifier, isLoggedIn, isRestOfSeasonView
    } = this.props

    const Row = ({ index, key, parent, ...params }) => {
      const player = players.get(index)
      return (
        <PlayerRow key={key} player={player} {...params} />
      )
    }

    const headerSeasonPassing = (week) => (
      <div className='player__row-group'>
        <div className='player__row-group-head'>Passing</div>
        <div className='player__row-group-body'>
          <PlayerHeader className='player__row-metric' label='YDS' value={`projection.${week}.py`} />
          <PlayerHeader className='player__row-metric' label='TD' value={`projection.${week}.tdp`} />
          <PlayerHeader className='player__row-metric' label='INT' value={`projection.${week}.ints`} />
        </div>
      </div>
    )

    const headerSeasonRushing = (week) => (
      <div className='player__row-group'>
        <div className='player__row-group-head'>Rushing</div>
        <div className='player__row-group-body'>
          <PlayerHeader className='player__row-metric' label='CAR' value={`projection.${week}.ra`} />
          <PlayerHeader className='player__row-metric' label='YDS' value={`projection.${week}.ry`} />
          <PlayerHeader className='player__row-metric' label='TD' value={`projection.${week}.tdr`} />
          <PlayerHeader className='player__row-metric' label='FUM' value={`projection.${week}.fuml`} />
        </div>
      </div>
    )

    const headerSeasonReceiving = (week) => (
      <div className='player__row-group'>
        <div className='player__row-group-head'>Receiving</div>
        <div className='player__row-group-body'>
          <PlayerHeader className='player__row-metric' label='TAR' value={`projection.${week}.trg`} />
          <PlayerHeader className='player__row-metric' label='REC' value={`projection.${week}.rec`} />
          <PlayerHeader className='player__row-metric' label='YDS' value={`projection.${week}.recy`} />
          <PlayerHeader className='player__row-metric' label='TD' value={`projection.${week}.tdrec`} />
        </div>
      </div>
    )

    const headerSeasonSummary = (week) => (
      <div className='player__row-group'>
        <div className='player__row-group-body'>
          <PlayerHeader
            className='player__row-metric'
            label='Salary'
            value={`values.${week}.${vbaseline}`}
          />
          <PlayerHeader
            className='player__row-metric'
            label='Value'
            value={`vorp.${week}.${vbaseline}`}
          />
          <PlayerHeader
            className='player__row-metric'
            label='Proj'
            value={`points.${week}.total`}
          />
        </div>
      </div>
    )

    const classNames = ['players__filter']
    if (this.state.expanded) classNames.push('expanded')

    const head = (
      <div className='players__head'>
        <div className={classNames.join(' ')}>
          <SearchFilter search={this.props.search} value={this.props.searchValue} />
          <PositionFilter />
          <AvailabilityFilter />
          <PlayersViewMenu />
          {isStatsView && <StatMenu />}
          {isStatsPassingView && <StatPassingMenu />}
          {isStatsView && <StatYearsFilter />}
          {isStatsView && <StatWeeksFilter />}
          {isStatsView && <StatDaysFilter />}
          {isStatsView && <StatQuartersFilter />}
          {isStatsView && <StatDownsFilter />}
          {(isStatsView && showQualifier) && <StatQualifierFilter />}
          <div className='players__head-expand' onClick={this.handleClick}>
            <Icon className='players__head-icon' name='arrow-down' />
          </div>
          <div className='players__head-actions'>
            {!!(isSeasonProjectionView || isRestOfSeasonView) &&
              <IconButton onClick={this.handleExport} disabled={isPending}>
                <GetAppIcon />
              </IconButton>}
          </div>
        </div>
        {this.state.expanded &&
          <div className='players__filter'>
            <ExperienceFilter />
            <AgeFilter />
            <NFLTeamsFilter />
            <CollegeFilter />
            <CollegeDivisionFilter />
            <StatusFilter />
          </div>}
        <div className='players__header'>
          <div className='player__row-action' />
          <div className='player__row-pos' />
          <div className='player__row-name'>Name</div>
          {isLoggedIn && <div className='player__row-action' />}
          {isLoggedIn && <div className='player__row-availability' />}
          {isSeasonProjectionView && headerSeasonSummary('0')}
          {isSeasonProjectionView && headerSeasonPassing('0')}
          {isSeasonProjectionView && headerSeasonRushing('0')}
          {isSeasonProjectionView && headerSeasonReceiving('0')}
          {isRestOfSeasonView && headerSeasonSummary('ros')}
          {isRestOfSeasonView && headerSeasonPassing('ros')}
          {isRestOfSeasonView && headerSeasonRushing('ros')}
          {isRestOfSeasonView && headerSeasonReceiving('ros')}
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
