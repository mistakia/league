import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import InfiniteScroll from 'react-infinite-scroller'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import Button from '@mui/material/Button'
import dayjs from 'dayjs'

import SearchFilter from '@components/search-filter'
import StatusFilter from '@components/status-filter'
import HighlightTeam from '@components/highlight-team'
import TeamFilter from '@components/team-filter'
import PositionFilter from '@components/position-filter'
import DraftRoundFilter from '@components/draft-round-filter'
import ExperienceFilter from '@components/experience-filter'
import WeekFilter from '@components/week-filter'
// import AgeFilter from '@components/age-filter' TODO — fix
import WatchlistFilter from '@components/watchlist-filter'
import PageLayout from '@layouts/page'
import PlayerHeader from '@components/player-header'
import PlayerRow from '@components/player-row'
import PlayersViewMenu from '@components/players-view-menu'
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
import Loading from '@components/loading'
import { csv } from '@core/export'

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
    const { players, player_fields, selected_players_view } = this.props

    const headers = {
      name: 'Player Name',
      team: 'Team',
      pos: 'Position'
    }

    const field_infos = []
    for (const field of selected_players_view.fields) {
      const field_info = player_fields[field]
      field_infos.push(field_info)

      headers[field_info.key] = field_info.name
    }

    const data = players.map((playerMap) => {
      const item = {
        name: playerMap.get('name'),
        team: playerMap.get('team'),
        pos: playerMap.get('pos')
      }

      for (const field_info of field_infos) {
        item[field_info.key] = playerMap.getIn(field_info.key_path)
      }

      return item
    })

    const view_name = selected_players_view.name
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase()

    const timestamp = dayjs().format('YYYY-MM-DD-H[h]-m[m]')

    csv({
      headers,
      data: data.toJS(),
      fileName: `xo-football-${view_name}-export-${timestamp}`
    })
  }

  render = () => {
    const {
      players,
      isPending,
      isLoggedIn,
      selected_view_grouped_fields,
      show_week_filter,
      show_play_filters,
      show_qualifier_filter
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
            player_row_index={idx}
          />
        )
      )

    const header_items = []
    selected_view_grouped_fields.forEach((group, index) => {
      const group_items = []
      group.fields.forEach((field_info, index) => {
        group_items.push(
          <PlayerHeader
            key={index}
            className={field_info.className || 'table__cell metric'}
            label={field_info.label}
            value={field_info.key}
          />
        )
      })

      header_items.push(
        <div className='player__row-group' key={index}>
          <div className='player__row-group-head'>{group.category}</div>
          <div className='player__row-group-body'>{group_items}</div>
        </div>
      )
    })

    const classNames = ['players__filters']
    if (this.state.expanded) classNames.push('expanded')

    const head = (
      <div className='players__head'>
        <div className={classNames.join(' ')}>
          <div className='players__filters-row'>
            <PlayersViewMenu />
            <SearchFilter
              search={this.props.search}
              value={this.props.searchValue}
            />
            <PositionFilter />
            {isLoggedIn && <AvailabilityFilter />}
            {show_week_filter && <WeekFilter />}
            <Button
              variant='outlined'
              onClick={this.handleExport}
              disabled={isPending}
              className='players__view-export'
            >
              Export CSV
            </Button>
            <Button
              endIcon={<KeyboardArrowDownIcon />}
              onClick={this.handleClick}
              className='players__head-expand'
            >
              {this.state.expanded ? 'Hide' : 'Filters'}
            </Button>
          </div>
          {this.state.expanded && (
            <div className='players__filters-expanded-container'>
              {Boolean(show_play_filters) && (
                <div className='players__filters-row'>
                  <StatYearsFilter />
                  <StatWeeksFilter />
                  <StatDaysFilter />
                  <StatQuartersFilter />
                  <StatDownsFilter />
                  {show_qualifier_filter && <StatQualifierFilter />}
                </div>
              )}
              <div className='players__filters-row'>
                <ExperienceFilter />
                {/* <AgeFilter /> */}
                <DraftRoundFilter />
                <NFLTeamsFilter />
                <CollegeFilter />
                <CollegeDivisionFilter />
                <StatusFilter />
                <TeamFilter />
                <HighlightTeam />
                {isLoggedIn && <WatchlistFilter />}
              </div>
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
            <div className='player__row-name player__header'>Name</div>
            {isLoggedIn && <div className='player__row-tag' />}
            {isLoggedIn && <div className='player__row-action actions' />}
            {isLoggedIn && <div className='player__row-availability' />}
          </div>
          {header_items}
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
  isPending: PropTypes.bool,
  isLoggedIn: PropTypes.bool,
  search: PropTypes.func,
  searchValue: PropTypes.string,
  loadAllPlayers: PropTypes.func,
  selected_view_grouped_fields: PropTypes.array,
  show_week_filter: PropTypes.bool,
  show_play_filters: PropTypes.bool,
  show_qualifier_filter: PropTypes.bool,
  player_fields: PropTypes.object,
  selected_players_view: PropTypes.object
}
