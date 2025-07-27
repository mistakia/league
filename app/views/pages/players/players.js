import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import InfiniteScroll from 'react-infinite-scroller'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import Button from '@mui/material/Button'
import dayjs from 'dayjs'
import ClearIcon from '@mui/icons-material/Clear'

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
import StatYardlineFilter from '@components/stat-yardline-filter'
import StatDownsFilter from '@components/stat-downs-filter'
import StatQualifierFilter from '@components/stat-qualifier-filter'
import CollegeFilter from '@components/college-filter'
import CollegeDivisionFilter from '@components/college-division-filter'
import NFLTeamsFilter from '@components/nfl-teams-filter'
import Loading from '@components/loading'
import { csv } from '@core/export'

import './players.styl'

export default function PlayersPage({
  players,
  player_fields,
  selected_players_page_view,
  isPending,
  is_logged_in,
  selected_view_grouped_fields,
  show_week_filter,
  show_play_filters,
  show_qualifier_filter,
  reset_player_filter_options,
  search,
  searchValue,
  order,
  orderBy,
  is_player_filter_options_changed,
  load_rosters,
  load_all_players,
  init_charted_plays
}) {
  const { lid } = useParams()
  const navigate = useNavigate()
  const [expanded, set_expanded] = useState(false)
  const [page, set_page] = useState(0)
  const [has_more, set_has_more] = useState(true)

  let scroll_ref

  useEffect(() => {
    load_all_players()
    init_charted_plays()
  }, [load_all_players, init_charted_plays])

  useEffect(() => {
    for (const field_key of selected_players_page_view.fields) {
      const player_field = player_fields[field_key]
      if (player_field.load) {
        player_field.load()
      }
    }
  }, [
    player_fields,
    selected_players_page_view.fields,
    selected_players_page_view.key
  ])

  useEffect(() => {
    if (isNaN(lid)) {
      return navigate('/', { replace: true })
    }

    if (lid !== '0') {
      load_rosters(lid)
    }
  }, [lid, load_rosters, navigate])

  useEffect(() => {
    set_page(0)
    set_has_more(true)

    if (!scroll_ref) return

    scroll_ref.pageLoaded = 0
    const parentElement = scroll_ref.getParentElement(
      scroll_ref.scrollComponent
    )
    parentElement.scrollTop = 0
  }, [
    scroll_ref,
    selected_players_page_view.key,
    order,
    orderBy,
    searchValue,
    players.size
  ])
  // TODO instead of players.size use players.equal() for comparison

  const loadMore = (p) => {
    if (p === page) return
    const index = p * 25
    const has_more = players.size > index
    set_page(p)
    set_has_more(has_more)
  }

  const handleClick = (event) => set_expanded(!expanded)

  const handleExport = () => {
    const headers = {
      name: 'Player Name',
      team: 'Team',
      pos: 'Position'
    }

    const field_infos = []
    for (const field of selected_players_page_view.fields) {
      const field_info = player_fields[field]
      field_infos.push(field_info)

      headers[field_info.key] = field_info.csv_header
    }

    const data = players.map((player_map) => {
      const item = {
        name: player_map.get('name'),
        team: player_map.get('team'),
        pos: player_map.get('pos')
      }

      for (const field_info of field_infos) {
        item[field_info.key] = player_map.getIn(field_info.key_path)
      }

      return item
    })

    const view_name = selected_players_page_view.name
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase()

    const timestamp = dayjs().format('YYYY-MM-DD-H[h]-m[m]')

    csv({
      headers,
      data: data.toJS(),
      fileName: `xo-football-${view_name}-export-${timestamp}`
    })
  }

  const rowItems = []
  const index = page * 25
  players
    .slice(0, index)
    .forEach((player_map, idx) =>
      rowItems.push(
        <PlayerRow
          key={player_map.get('pid')}
          player_map={player_map}
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
          className={field_info.header_className || 'table__cell metric'}
          label={field_info.column_header}
          value={field_info.key}
        />
      )
    })

    header_items.push(
      <div className='row__group' key={index}>
        <div className='row__group-head'>{group.category}</div>
        <div className='row__group-body'>{group_items}</div>
      </div>
    )
  })

  const classNames = ['players__filters']
  if (expanded) classNames.push('expanded')

  const head = (
    <div className='players__head'>
      <div className={classNames.join(' ')}>
        <div className='players__filters-row'>
          <PlayersViewMenu />
          <SearchFilter search={search} value={searchValue} />
          <PositionFilter />
          {is_logged_in && <AvailabilityFilter />}
          {show_week_filter && <WeekFilter />}
          <Button
            variant='outlined'
            onClick={handleExport}
            disabled={isPending}
            className='players__view-export'
          >
            Export CSV
          </Button>
          {is_player_filter_options_changed && (
            <Button
              variant='text'
              startIcon={<ClearIcon />}
              onClick={reset_player_filter_options}
            >
              Reset Filters
            </Button>
          )}
          <Button
            endIcon={<KeyboardArrowDownIcon />}
            onClick={handleClick}
            className='players__head-expand'
          >
            {expanded ? 'Hide' : 'Filters'}
          </Button>
        </div>
        {expanded && (
          <div className='players__filters-expanded-container'>
            {Boolean(show_play_filters) && (
              <div className='players__filters-row'>
                <StatYearsFilter />
                <StatWeeksFilter />
                <StatDaysFilter />
                <StatQuartersFilter />
                <StatDownsFilter />
                <StatYardlineFilter />
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
              {is_logged_in && <TeamFilter />}
              {is_logged_in && <HighlightTeam />}
              {is_logged_in && <WatchlistFilter />}
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
          {is_logged_in && <div className='player__row-tag' />}
          {is_logged_in && <div className='player__row-action actions' />}
          {is_logged_in && <div className='player__row-availability' />}
        </div>
        {header_items}
      </div>
      <InfiniteScroll
        ref={(ref) => {
          scroll_ref = ref
        }}
        pageStart={0}
        loadMore={loadMore}
        hasMore={has_more}
        loader={<Loading loading key={0} />}
        useWindow={false}
      >
        {rowItems}
      </InfiniteScroll>
    </div>
  )

  return <PageLayout {...{ body, head }} />
}

PlayersPage.propTypes = {
  order: PropTypes.string,
  orderBy: PropTypes.string,
  players: ImmutablePropTypes.list,
  isPending: PropTypes.bool,
  is_logged_in: PropTypes.bool,
  search: PropTypes.func,
  searchValue: PropTypes.string,
  selected_view_grouped_fields: PropTypes.array,
  show_week_filter: PropTypes.bool,
  show_play_filters: PropTypes.bool,
  show_qualifier_filter: PropTypes.bool,
  player_fields: PropTypes.object,
  selected_players_page_view: PropTypes.object,
  reset_player_filter_options: PropTypes.func,
  is_player_filter_options_changed: PropTypes.bool,
  load_rosters: PropTypes.func,
  load_all_players: PropTypes.func,
  init_charted_plays: PropTypes.func
}
