import React, { useMemo, useCallback } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import Chip from '@mui/material/Chip'

import TradeSelectPlayer from '@components/trade-select-player'
import TradeSelectPick from '@components/trade-select-pick'
import { Team } from '@core/teams'

import './trade-select-items.styl'

function get_pick_label({ pick, teams }) {
  let label_string = `${pick.year} Draft Pick ${pick.round}`

  if (pick.pick) {
    label_string += ` #${pick.pick}`
  }

  const team = teams.get(pick.otid, new Team())
  label_string += ` (${team.abbrv})`

  return label_string
}

function build_options({ players, picks, teams }) {
  const option_list = []
  const seen_ids = new Set()

  if (players && players.forEach) {
    players.forEach((player_map) => {
      const id = player_map.get('pid')
      if (!seen_ids.has(id)) {
        seen_ids.add(id)
        option_list.push({
          id,
          label: player_map.get('name'),
          type: 'player'
        })
      }
    })
  }

  if (picks && picks.forEach) {
    picks.forEach((pick) => {
      const id = `pick-${pick.uid}`
      if (!seen_ids.has(id)) {
        seen_ids.add(id)
        option_list.push({
          id,
          pickId: pick.uid,
          label: get_pick_label({ pick, teams }),
          type: 'pick'
        })
      }
    })
  }

  return option_list
}

function build_selected_value({ selected_players, selected_picks, teams }) {
  const value_list = []

  if (selected_players && selected_players.forEach) {
    selected_players.forEach((player_map) => {
      value_list.push({
        id: player_map.get('pid'),
        label: player_map.get('name'),
        type: 'player'
      })
    })
  }

  if (selected_picks && selected_picks.forEach) {
    selected_picks.forEach((pick) => {
      value_list.push({
        id: `pick-${pick.uid}`,
        pickId: pick.uid,
        label: get_pick_label({ pick, teams }),
        type: 'pick'
      })
    })
  }

  return value_list
}

function render_option_element(props, option) {
  const { key, ...other_props } = props
  const element =
    option.type === 'pick' ? (
      <TradeSelectPick pickId={option.pickId || option.id} />
    ) : (
      <TradeSelectPlayer pid={option.id} />
    )

  return (
    <div key={option.id} {...other_props}>
      {element}
    </div>
  )
}

function render_selected_tags(tag_values, get_tag_props) {
  return tag_values.map((option, index) => {
    const { key, ...other_props } = get_tag_props({ index })
    return <Chip key={option.id} label={option.label} {...other_props} />
  })
}

function is_option_equal_to_value(option, value) {
  return option.id === value.id
}

export default function TradeSelectItems({
  teams = null,
  onChange = null,
  disabled = false,
  selectedPlayers = null,
  selectedPicks = [],
  players = [],
  picks = null,
  title = 'Select players and picks to trade'
}) {
  const options = useMemo(
    () => build_options({ players, picks, teams }),
    [players, picks, teams]
  )

  const value = useMemo(
    () =>
      build_selected_value({
        selected_players: selectedPlayers,
        selected_picks: selectedPicks,
        teams
      }),
    [selectedPlayers, selectedPicks, teams]
  )

  const handle_change = useCallback(
    (event, new_value) => {
      if (onChange) {
        onChange(event, new_value)
      }
    },
    [onChange]
  )

  const render_input = useCallback(
    (params) => (
      <TextField
        {...params}
        variant='outlined'
        label={title}
        placeholder={title}
      />
    ),
    [title]
  )

  return (
    <Autocomplete
      multiple
      disabled={disabled}
      options={options}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={is_option_equal_to_value}
      renderOption={render_option_element}
      filterSelectedOptions
      value={value}
      onChange={handle_change}
      renderTags={render_selected_tags}
      renderInput={render_input}
    />
  )
}

TradeSelectItems.propTypes = {
  teams: ImmutablePropTypes.map,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
  selectedPlayers: ImmutablePropTypes.list,
  selectedPicks: PropTypes.array,
  players: PropTypes.array,
  picks: ImmutablePropTypes.list,
  title: PropTypes.string
}
