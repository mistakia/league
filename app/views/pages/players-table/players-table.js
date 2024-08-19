import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import { useLocation, NavLink } from 'react-router-dom'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Table from 'react-table/index.js'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import generate_view_id from 'react-table/src/utils/generate-view-id.js'

import PageLayout from '@layouts/page'
import Loading from '@components/loading'
import { Team } from '@core/teams'
import { get_string_from_object } from '@libs-shared'
import { shorten_url } from '@core/utils'

import './players-table.styl'

const fetch_more = () => {}

export default function PlayersTablePage({
  players,
  player_fields,
  isPending,
  isLoggedIn,
  selected_players_table_view,
  players_table_views,
  players_table_view_changed,
  set_selected_players_table_view,
  delete_players_table_view,
  selected_player_pid,
  teamId,
  leagueId,
  highlight_team_ids,
  teams,
  players_percentiles,
  user_id,
  save_players_table_view,
  load_players_table_views
}) {
  const location = useLocation()

  useEffect(() => {
    load_players_table_views()
  }, [load_players_table_views])

  useEffect(() => {
    const search_params = new URLSearchParams(location.search)
    const columns = JSON.parse(search_params.get('columns') || 'null') || []
    const sort = JSON.parse(search_params.get('sort') || 'null') || []
    const where = JSON.parse(search_params.get('where') || 'null') || []
    const prefix_columns =
      JSON.parse(search_params.get('prefix_columns') || 'null') || []
    const splits = JSON.parse(search_params.get('splits') || 'null') || []
    const view_name = search_params.get('view_name') || ''
    const view_search_column_id =
      search_params.get('view_search_column_id') || ''
    const view_description = search_params.get('view_description') || ''

    const has_table_state =
      columns.length || where.length || (prefix_columns.length && sort.length)

    if (has_table_state) {
      players_table_view_changed(
        {
          // generate a new view_id to make sure it doesn't conflict with a saved view
          view_id: generate_view_id(),
          view_name,
          view_search_column_id,
          view_description,
          table_state: {
            columns,
            sort,
            where,
            prefix_columns,
            splits
          },
          saved_table_state: {
            columns,
            sort,
            where,
            prefix_columns,
            splits
          }
        },
        {
          view_state_changed: true
        }
      )
    } else {
      players_table_view_changed(selected_players_table_view, {
        view_state_changed: true
      })
    }
  }, [location, players_table_view_changed]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    for (const column of selected_players_table_view.table_state.columns) {
      const column_id = typeof column === 'string' ? column : column.column_id
      const player_field = player_fields[column_id]
      if (player_field.load) {
        player_field.load()
      }
    }
  }, [
    player_fields,
    selected_players_table_view.view_id,
    selected_players_table_view.table_state.columns
  ])

  for (const player of players) {
    const is_rostered = Boolean(player.tid)

    const class_params = {
      fa: isLoggedIn && !is_rostered,
      selected: selected_player_pid === player.pid,
      rostered: teamId && player.tid === teamId
    }

    if (highlight_team_ids.includes(player.tid)) {
      const team = teams.get(player.tid, new Team())
      class_params[`draft-order-${team.get('do')}`] = true
    }
    player.className = get_string_from_object(class_params)
  }

  const new_prefix_columns = ['player_name']
  if (isLoggedIn && leagueId) {
    new_prefix_columns.push('player_league_roster_status')
  }

  const on_view_change = (players_table_view, view_change_params = {}) => {
    if (view_change_params.is_new_view) {
      players_table_view.user_id = user_id
    }
    players_table_view_changed(players_table_view, view_change_params)
  }

  const body = isPending ? (
    <Loading loading />
  ) : (
    <div className='players__table'>
      <div className='players__table-help'>
        <InfoOutlinedIcon />
        <span>
          Visit the <NavLink to='/guides/players-table'>guide</NavLink> to learn
          how to use the players table.
        </span>
      </div>
      <Table
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        data={players}
        on_view_change={on_view_change}
        on_save_view={save_players_table_view}
        table_state={selected_players_table_view.table_state}
        saved_table_state={selected_players_table_view.saved_table_state}
        all_columns={player_fields}
        selected_view={selected_players_table_view}
        select_view={set_selected_players_table_view}
        fetch_more={fetch_more} // TODO
        total_rows_fetched={players.size}
        total_row_count={players.size} // TODO get from server
        is_fetching_more={selected_players_table_view.is_fetching} // TODO
        is_loading={selected_players_table_view.is_fetching}
        is_selected_view_editable={
          isLoggedIn && selected_players_table_view.user_id === user_id
        }
        views={players_table_views}
        delete_view={delete_players_table_view}
        disable_rank_aggregation
        percentiles={players_percentiles}
        disable_edit_view={!isLoggedIn} // TODO check if user has permission to edit
        enable_duplicate_column_ids
        new_view_prefix_columns={new_prefix_columns}
        shorten_url={shorten_url}
      />
    </div>
  )

  return <PageLayout {...{ body }} />
}

PlayersTablePage.propTypes = {
  players: PropTypes.array,
  isPending: PropTypes.bool,
  isLoggedIn: PropTypes.bool,
  player_fields: PropTypes.object,
  selected_players_table_view: PropTypes.object,
  players_table_views: PropTypes.array,
  players_table_view_changed: PropTypes.func,
  set_selected_players_table_view: PropTypes.func,
  delete_players_table_view: PropTypes.func,
  selected_player_pid: PropTypes.string,
  teamId: PropTypes.number,
  leagueId: PropTypes.number,
  highlight_team_ids: ImmutablePropTypes.list,
  teams: ImmutablePropTypes.map,
  players_percentiles: PropTypes.object,
  user_id: PropTypes.number,
  save_players_table_view: PropTypes.func,
  load_players_table_views: PropTypes.func
}
