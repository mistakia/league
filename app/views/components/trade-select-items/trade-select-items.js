import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Autocomplete from '@material-ui/lab/Autocomplete'
import TextField from '@material-ui/core/TextField'
import Chip from '@material-ui/core/Chip'

import { constants } from '@common'
import TradeSelectPlayer from '@components/trade-select-player'
import TradeSelectPick from '@components/trade-select-pick'

import './trade-select-items.styl'

const getPickLabel = (pick, teams) => {
  let str = `${pick.year} Draft Pick ${pick.round}`
  if (pick.pick) {
    str += ` #${pick.pick}`
  }

  const team = teams.get(pick.otid)
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
    players.forEach((player) => {
      const isOnPracticeSquad =
        player.slot === constants.slots.PS || player.slot === constants.slots.PSP
      const type = isOnPracticeSquad ? 'Practice Squad' : 'Active'
      options.push({ id: player.player, label: player.name, type })
    })
    picks.forEach((pick) => {
      options.push({
        id: pick.uid,
        label: getPickLabel(pick, teams),
        type: 'Draft Picks'
      })
    })

    const value = []
    selectedPlayers.forEach((player) => {
      // const isOnPracticeSquad =
        player.slot === constants.slots.PS || player.slot === constants.slots.PSP
      // const type = isOnPracticeSquad ? 'Practice Squad' : 'Active'
      value.push({ id: player.player, label: player.name, type: 'Active' })
    })
    selectedPicks.forEach((pick) => {
      value.push({
        id: pick.uid,
        label: getPickLabel(pick, teams),
        type: 'Draft Picks'
      })
    })

    const renderOption = (option, state) => {
      if (option.type === 'Draft Picks') {
        return <TradeSelectPick pickId={option.id} />
      } else {
        return <TradeSelectPlayer playerId={option.id} />
      }
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

    const sorted = options.sort((a, b) => -a.type.localeCompare(b.type))

    return (
      <Autocomplete
        multiple
        disabled={disabled}
        options={sorted}
        groupBy={(option) => option.type}
        getOptionLabel={(x) => x.label}
        getOptionSelected={getOptionSelected}
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
  selectedPlayers: PropTypes.array,
  selectedPicks: PropTypes.array,
  players: PropTypes.array,
  picks: ImmutablePropTypes.list,
  title: PropTypes.string
}
