import React from 'react'
import Autocomplete from '@material-ui/lab/Autocomplete'
import TextField from '@material-ui/core/TextField'
import Chip from '@material-ui/core/Chip'

import TradeSelectPlayer from '@components/trade-select-player'
import TradeSelectPick from '@components/trade-select-pick'

import './trade-select-items.styl'

const getPickLabel = (pick) => {
  let str = `${pick.year} Draft Pick ${pick.round}`
  if (pick.pick) {
    str += ` #${pick.pick}`
  }
  return str
}

export default class TradeSelectItems extends React.Component {
  render = () => {
    const {
      onChange,
      disabled,
      selectedPlayers = [],
      selectedPicks = [],
      players = [],
      picks = [],
      title = 'Select players and picks to trade'
    } = this.props

    const options = []
    players.forEach(player => {
      options.push({ id: player.player, label: player.name, type: 'player' })
    })
    picks.forEach(pick => {
      options.push({ id: pick.uid, label: getPickLabel(pick), type: 'pick' })
    })

    const value = []
    selectedPlayers.forEach(player => {
      value.push({ id: player.player, label: player.name, type: 'player' })
    })
    selectedPicks.forEach(pickId => {
      const pick = picks.find(p => p.uid === pickId)
      value.push({ id: pickId, label: getPickLabel(pick), type: 'pick' })
    })

    const renderOption = (option, state) => {
      if (option.type === 'pick') {
        return <TradeSelectPick pickId={option.id} />
      } else {
        return <TradeSelectPlayer playerId={option.id} />
      }
    }

    const getOptionSelected = (option, value) => option.id === value.id

    const renderTags = (value, getTagProps) => value.map((option, index) => (
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
