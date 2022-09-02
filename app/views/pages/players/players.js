import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import GetAppIcon from '@mui/icons-material/GetApp'
import IconButton from '@mui/material/IconButton'
import InfiniteScroll from 'react-infinite-scroller'

import SearchFilter from '@components/search-filter'
import StatusFilter from '@components/status-filter'
import TeamFilter from '@components/team-filter'
import PositionFilter from '@components/position-filter'
import ExperienceFilter from '@components/experience-filter'
import WeekFilter from '@components/week-filter'
import AgeFilter from '@components/age-filter'
import WatchlistFilter from '@components/watchlist-filter'
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
import HeaderStatsFantasy from '@components/header-stats-fantasy'
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
import HeaderStatsReceivingOpportunity from '@components/header-stats-receiving-opportunity'
import HeaderStatsReceivingEfficiency from '@components/header-stats-receiving-efficiency'
import Loading from '@components/loading'
import Icon from '@components/icon'
import { csv } from '@core/export'
import { constants } from '@common'

import './players.styl'

export default class PlayersPage extends React.Component {
  constructor(props) {
    super(props)

    this.state = { expanded: false, page: 0, hasMore: true }
  }

  componentDidMount() {
    this.props.loadAllPlayers()
  }

  componentDidUpdate(prevProps) {
    if (!this.scroll) return

    if (
      prevProps.order !== this.props.order ||
      prevProps.orderBy !== this.props.orderBy ||
      prevProps.searchValue !== this.props.searchValue ||
      !prevProps.players.equals(this.props.players)
    ) {
      this.scroll.pageLoaded = 0
      const parentElement = this.scroll.getParentElement(
        this.scroll.scrollComponent
      )
      parentElement.scrollTop = 0
      this.setState({ page: 0, hasMore: true })
    }

    if (this.props.selected) {
      // TODO
      // const index = this.props.players.findIndex(p => p.pid === this.props.selected)
      // this.list.current.scrollToRow(index)
    }
  }

  loadMore(page) {
    const index = page * 25
    const hasMore = this.props.players.size > index
    this.setState({ page, hasMore })
  }

  handleClick = (event) => {
    this.setState({ expanded: !this.state.expanded })
  }

  handleExport = () => {
    const { players, isSeasonView, week } = this.props
    const data = players.map((p) => {
      const item = {
        name: p.name,
        team: p.team,
        pos: p.pos,
        salary: p.getIn(['market_salary', `${week}`], 0).toFixed(1),
        salary_adj: p.get('market_salary_adj', 0).toFixed(1),
        vorp: p.getIn(['vorp', `${week}`], 0).toFixed(1)
      }

      for (const stat of constants.stats) {
        item[stat] = p.getIn(['projection', `${week}`, stat], 0).toFixed(1)
      }

      return item
    })

    csv({
      headers: {
        name: 'Player Name',
        team: 'Team',
        pos: 'Position',
        salary: 'Salary',
        salary_adj: 'Salary Adjusted',
        vorp: 'VORP',
        ...constants.statHeaders
      },
      data: data.toJS(),
      fileName:
        'xo-football-players-' +
        (isSeasonView ? 'SeasonProjections' : 'RestOfSeasonProjections')
    })
  }

  render = () => {
    const {
      players,
      isSeasonView,
      isStatsView,
      isStatsPassingView,
      isWeekView,
      isStatsRushingView,
      isStatsReceivingView,
      isStatsPassingAdvancedView,
      week,
      isStatsPassingPressureView,
      isPending,
      showQualifier,
      isLoggedIn,
      isRestOfSeasonView
    } = this.props

    const rowItems = []
    const index = this.state.page * 25
    players
      .slice(0, index)
      .forEach((playerMap, idx) =>
        rowItems.push(
          <PlayerRow
            key={playerMap.get('pid')}
            playerMap={playerMap}
            index={idx}
          />
        )
      )

    const headerSeasonPassing = (
      <div className='player__row-group'>
        <div className='player__row-group-head'>Passing</div>
        <div className='player__row-group-body'>
          <PlayerHeader
            className='table__cell metric'
            label='YDS'
            value={`projection.${week}.py`}
          />
          <PlayerHeader
            className='table__cell metric'
            label='TD'
            value={`projection.${week}.tdp`}
          />
          <PlayerHeader
            className='table__cell metric'
            label='INT'
            value={`projection.${week}.ints`}
          />
        </div>
      </div>
    )

    const headerSeasonRushing = (
      <div className='player__row-group'>
        <div className='player__row-group-head'>Rushing</div>
        <div className='player__row-group-body'>
          <PlayerHeader
            className='table__cell metric'
            label='CAR'
            value={`projection.${week}.ra`}
          />
          <PlayerHeader
            className='table__cell metric'
            label='YDS'
            value={`projection.${week}.ry`}
          />
          <PlayerHeader
            className='table__cell metric'
            label='TD'
            value={`projection.${week}.tdr`}
          />
          <PlayerHeader
            className='table__cell metric'
            label='FUM'
            value={`projection.${week}.fuml`}
          />
        </div>
      </div>
    )

    const headerSeasonReceiving = (
      <div className='player__row-group'>
        <div className='player__row-group-head'>Receiving</div>
        <div className='player__row-group-body'>
          <PlayerHeader
            className='table__cell metric'
            label='TAR'
            value={`projection.${week}.trg`}
          />
          <PlayerHeader
            className='table__cell metric'
            label='REC'
            value={`projection.${week}.rec`}
          />
          <PlayerHeader
            className='table__cell metric'
            label='YDS'
            value={`projection.${week}.recy`}
          />
          <PlayerHeader
            className='table__cell metric'
            label='TD'
            value={`projection.${week}.tdrec`}
          />
        </div>
      </div>
    )

    const headerSalary = week === 0 && (
      <>
        <PlayerHeader
          className='table__cell metric'
          label='Salary'
          value='value'
        />
        {constants.isOffseason && (
          <PlayerHeader
            className='table__cell metric'
            label='Value'
            value={`vorp_adj.${week}`}
          />
        )}
        {constants.isOffseason && (
          <PlayerHeader
            className='table__cell metric'
            label='Market'
            value={`market_salary.${week}`}
          />
        )}
        {constants.isOffseason && (
          <PlayerHeader
            className='table__cell metric'
            label='Market Adjusted'
            value={'market_salary_adj'}
          />
        )}
      </>
    )

    const headerSeasonSummary = (
      <div className='player__row-group'>
        <div className='player__row-group-body'>
          {isLoggedIn && headerSalary}
          <PlayerHeader
            className='table__cell metric'
            label='Pts Over Replace.'
            value={`vorp.${week}`}
          />
          <PlayerHeader
            className='table__cell metric'
            label='Proj'
            value={`points.${week}.total`}
          />
        </div>
      </div>
    )

    const classNames = ['players__filters']
    if (this.state.expanded) classNames.push('expanded')

    const projectionView = isRestOfSeasonView || isSeasonView || isWeekView

    const head = (
      <div className='players__head'>
        <div className={classNames.join(' ')}>
          <div className='players__filters-row'>
            <SearchFilter
              search={this.props.search}
              value={this.props.searchValue}
            />
            {isLoggedIn && <WatchlistFilter />}
            <PlayersViewMenu />
            <PositionFilter />
            {isLoggedIn && <AvailabilityFilter />}
            {isWeekView && <WeekFilter />}
            {isStatsView && <StatMenu />}
            {isStatsPassingView && <StatPassingMenu />}
            {isStatsView && <StatYearsFilter />}
            {isStatsView && <StatWeeksFilter />}
            {isStatsView && <StatDaysFilter />}
            {isStatsView && <StatQuartersFilter />}
            {isStatsView && <StatDownsFilter />}
            {isStatsView && showQualifier && <StatQualifierFilter />}
            <div className='players__head-expand' onClick={this.handleClick}>
              <Icon className='players__head-icon' name='arrow-down' />
            </div>
            <div className='players__head-actions'>
              {Boolean(isSeasonView || isRestOfSeasonView) && (
                <IconButton onClick={this.handleExport} disabled={isPending}>
                  <GetAppIcon />
                </IconButton>
              )}
            </div>
          </div>
          {this.state.expanded && (
            <div className='players__filters-row'>
              <ExperienceFilter />
              <AgeFilter />
              <NFLTeamsFilter />
              <CollegeFilter />
              <CollegeDivisionFilter />
              <StatusFilter />
              {isLoggedIn && <TeamFilter />}
            </div>
          )}
        </div>
      </div>
    )

    const body = isPending ? (
      <Loading loading />
    ) : (
      <div className='players__table'>
        <div className='players__header'>
          <div className='player__row-lead'>
            <div className='player__row-index' />
            <div className='player__row-action watchlist' />
            <div className='player__row-pos' />
            <div className='player__row-name'>Name</div>
            {isLoggedIn && <div className='player__row-tag' />}
            {isLoggedIn && <div className='player__row-action actions' />}
            {constants.week > 0 && (
              <div className='player__row-opponent'>Opp</div>
            )}
            {isLoggedIn && <div className='player__row-availability' />}
          </div>
          {projectionView && headerSeasonSummary}
          {projectionView && headerSeasonPassing}
          {projectionView && headerSeasonRushing}
          {projectionView && headerSeasonReceiving}
          {isStatsView && <HeaderStatsFantasy />}
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
          {isStatsReceivingView && <HeaderStatsReceivingOpportunity />}
          {isStatsReceivingView && <HeaderStatsReceivingEfficiency />}
        </div>
        <InfiniteScroll
          ref={(scroll) => {
            this.scroll = scroll
          }}
          pageStart={0}
          loadMore={this.loadMore.bind(this)}
          hasMore={this.state.hasMore}
          loader={<Loading loading key={0} />}
          useWindow={false}
        >
          {rowItems}
        </InfiniteScroll>
      </div>
    )

    return <PageLayout {...{ body, head }} />
  }
}

PlayersPage.propTypes = {
  order: PropTypes.string,
  orderBy: PropTypes.string,
  players: ImmutablePropTypes.list,
  selected: PropTypes.string,
  week: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  isSeasonView: PropTypes.bool,
  isStatsView: PropTypes.bool,
  isStatsPassingView: PropTypes.bool,
  isWeekView: PropTypes.bool,
  isStatsRushingView: PropTypes.bool,
  isStatsReceivingView: PropTypes.bool,
  isStatsPassingAdvancedView: PropTypes.bool,
  isStatsPassingPressureView: PropTypes.bool,
  isPending: PropTypes.bool,
  showQualifier: PropTypes.bool,
  isLoggedIn: PropTypes.bool,
  isRestOfSeasonView: PropTypes.bool,
  search: PropTypes.func,
  searchValue: PropTypes.string,
  loadAllPlayers: PropTypes.func
}
