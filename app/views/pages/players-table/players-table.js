import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Table from 'react-table/index.js'

import PageLayout from '@layouts/page'
import Loading from '@components/loading'
import { Team } from '@core/teams'
import { get_string_from_object } from '@libs-shared'

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
  highlight_team_ids,
  teams,
  players_percentiles
}) {
  useEffect(() => {
    players_table_view_changed(selected_players_table_view, {
      view_state_changed: true
    })
  }, [players_table_view_changed]) // eslint-disable-line react-hooks/exhaustive-deps

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
  if (isLoggedIn) {
    new_prefix_columns.push('player_league_roster_status')
  }

  const body = isPending ? (
    <Loading loading />
  ) : (
    <div className='players__table'>
      <Table
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        data={players}
        on_view_change={players_table_view_changed}
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
        views={players_table_views}
        delete_view={delete_players_table_view}
        disable_rank_aggregation
        percentiles={players_percentiles}
        disable_edit_view
        enable_duplicate_column_ids
        new_view_prefix_columns={new_prefix_columns}
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
  highlight_team_ids: ImmutablePropTypes.list,
  teams: ImmutablePropTypes.map,
  players_percentiles: PropTypes.object
}
