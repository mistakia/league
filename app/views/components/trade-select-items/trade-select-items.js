import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import Chip from '@mui/material/Chip'

import TradeSelectPlayer from '@components/trade-select-player'
import TradeSelectPick from '@components/trade-select-pick'
import { Team } from '@core/teams'

import './trade-select-items.styl'

const getPickLabel = (pick, teams) => {
  let str = `${pick.year} Draft Pick ${pick.round}`
  if (pick.pick) {
    str += ` #${pick.pick}`
  }

  const team = teams.get(pick.otid, new Team())
  str += ` (${team.abbrv})`

  return str
}

export default class TradeSelectItems extends React.Component {
  render = () => {
    const {
      teams,
      onChange,
      disabled,
      selectedPlayers = [],
      selectedPicks = [],
      players = [],
      picks = [],
      title = 'Select players and picks to trade'
    } = this.props

    const options = []
    players.forEach((player_map) => {
      options.push({
        id: player_map.get('pid'),
        label: player_map.get('name'),
        type: 'player'
      })
    })
    picks.forEach((pick) => {
      options.push({
        id: pick.uid,
        label: getPickLabel(pick, teams),
        type: 'pick'
      })
    })

    const value = []
    selectedPlayers.forEach((player_map) => {
      value.push({
        id: player_map.get('pid'),
        label: player_map.get('name'),
        type: 'player'
      })
    })
    selectedPicks.forEach((pick) => {
      value.push({
        id: pick.uid,
        label: getPickLabel(pick, teams),
        type: 'pick'
      })
    })

    const renderOption = (props, option) => {
      const el =
        option.type === 'pick' ? (
          <TradeSelectPick pickId={option.id} />
        ) : (
          <TradeSelectPlayer pid={option.id} />
        )

      return <div {...props}>{el}</div>
    }

    const getOptionSelected = (option, value) => option.id === value.id

    const renderTags = (value, getTagProps) =>
      value.map((option, index) => (
        // eslint-disable-next-line
        <Chip label={option.label} {...getTagProps({ index })} />
      ))

    const renderInput = (params) => (
      <TextField
        {...params}
        variant='outlined'
        label={title}
        placeholder={title}
      />
    )

    return (
      <Autocomplete
        multiple
        disabled={disabled}
        options={options}
        getOptionLabel={(x) => x.label}
        isOptionEqualToValue={getOptionSelected}
        renderOption={renderOption}
        filterSelectedOptions
        value={value}
        onChange={onChange}
        renderTags={renderTags}
        renderInput={renderInput}
      />
    )
  }
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
