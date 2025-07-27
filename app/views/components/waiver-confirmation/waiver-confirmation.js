import React, { useState } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogTitle from '@mui/material/DialogTitle'
import Autocomplete from '@mui/material/Autocomplete'
import Chip from '@mui/material/Chip'

import Position from '@components/position'
import NFLTeam from '@components/nfl-team'
import Button from '@components/button'
import { Roster, constants } from '@libs-shared'

import './waiver-confirmation.styl'

export default function WaiverConfirmation({
  waiver,
  league,
  player_map,
  roster,
  rosterPlayers,
  team,
  update,
  claim,
  onClose,
  status
}) {
  const get_release_options = (isActiveRoster) => {
    const releases = []
    const players = isActiveRoster
      ? rosterPlayers.active
      : rosterPlayers.practice

    for (const releasePlayerMap of players) {
      const r = new Roster({ roster: roster.toJS(), league })
      const slot = releasePlayerMap.get('slot')
      if (slot === constants.slots.PSP || slot === constants.slots.PSDP)
        continue
      r.removePlayer(releasePlayerMap.get('pid'))
      if (isActiveRoster) {
        if (r.hasOpenBenchSlot(releasePlayerMap.get('pos')))
          releases.push(releasePlayerMap)
      } else {
        if (r.hasOpenPracticeSquadSlot()) releases.push(releasePlayerMap)
      }
    }

    return releases
  }

  const has_bench_space = (isActiveRoster) =>
    isActiveRoster
      ? ros.hasOpenBenchSlot(player_map.get('pos'))
      : ros.hasOpenPracticeSquadSlot()
  const ros = new Roster({ roster: roster.toJS(), league })

  const [waiver_max_bid, set_waiver_max_bid] = useState(
    constants.season.isRegularSeason ? team.faab : ros.availableCap
  )
  const [isEligible, set_isEligible] = useState(
    waiver
      ? has_bench_space(waiver.type === constants.waivers.FREE_AGENCY)
      : false
  )
  const [release_options, set_release_options] = useState(
    waiver
      ? get_release_options(waiver.type === constants.waivers.FREE_AGENCY)
      : []
  )
  const [waiver_release, set_waiver_release] = useState(
    waiver ? waiver.release.toJS() : []
  )
  const [waiver_type, set_waiver_type] = useState(waiver ? waiver.type : '')
  const [waiver_bid, set_waiver_bid] = useState(waiver ? waiver.bid : 0)
  const [waiver_error, set_waiver_error] = useState(false)
  const [missing_type, set_missing_type] = useState(false)
  const [missing_release, set_missing_release] = useState(false)

  const setType = (type) => {
    const isActiveRoster = type === constants.waivers.FREE_AGENCY
    const eligible = has_bench_space(isActiveRoster)
    set_isEligible(eligible)
    set_missing_release(!eligible)
    set_release_options(get_release_options(isActiveRoster))
  }

  const handleRelease = (event, value) => {
    const release = value.map((p) => p.id)
    set_waiver_release(release)
    set_missing_release(!isEligible && !release.length)
    if (!constants.season.isRegularSeason) {
      const r = new Roster({ roster: roster.toJS(), league })
      release.forEach((pid) => r.removePlayer(pid))
      set_waiver_max_bid(r.availableCap)
    }
  }

  const handleType = (event) => {
    const { value } = event.target
    set_waiver_type(value)
    set_waiver_release([])
    set_missing_type(false)
    if (!constants.season.isRegularSeason) set_waiver_max_bid(ros.availableCap)
    setType(value)
  }

  const handleBid = (event) => {
    const { value } = event.target

    if (isNaN(value) || value % 1 !== 0) {
      set_waiver_error(true)
    } else if (value < 0 || value > team.faab) {
      set_waiver_error(true)
    } else {
      set_waiver_error(false)
    }

    set_waiver_bid(value)
  }

  const handleSubmit = () => {
    const pid = player_map.get('pid')

    if (!waiver_type) {
      return set_missing_type(true)
    } else {
      set_missing_type(false)
    }

    if (!isEligible && !waiver_release.length) {
      return set_missing_release(true)
    } else {
      set_missing_release(false)
    }

    if (!waiver_error) {
      if (waiver) {
        update({
          waiverId: waiver.uid,
          release: waiver_release,
          bid: waiver_bid
        })
      } else {
        claim({
          bid: waiver_bid,
          release: waiver_release,
          type: waiver_type,
          pid
        })
      }
      onClose()
    }
  }

  const options = []
  for (const releasePlayerMap of release_options) {
    options.push({
      id: releasePlayerMap.get('pid'),
      label: releasePlayerMap.get('name'),
      pos: releasePlayerMap.get('pos'),
      team: releasePlayerMap.get('team'),
      pname: releasePlayerMap.get('pname'),
      value: releasePlayerMap.get('value')
    })
  }

  const releasePlayers = []
  waiver_release.forEach((pid) => {
    const releasePlayerMap = release_options.find((p) => p.get('pid') === pid)
    if (!releasePlayerMap) return

    releasePlayers.push({
      id: releasePlayerMap.get('pid'),
      label: releasePlayerMap.get('name'),
      pos: releasePlayerMap.get('pos'),
      team: releasePlayerMap.get('team'),
      pname: releasePlayerMap.get('pname'),
      value: releasePlayerMap.get('value')
    })
  })

  const typeItems = []
  if (
    (waiver && waiver.type === constants.waivers.FREE_AGENCY_PRACTICE) ||
    status.waiver.practice
  ) {
    typeItems.push(
      <MenuItem key='practice' value={constants.waivers.FREE_AGENCY_PRACTICE}>
        Practice Squad
      </MenuItem>
    )
  }

  if (
    (waiver && waiver.type === constants.waivers.FREE_AGENCY) ||
    status.waiver.active
  ) {
    typeItems.push(
      <MenuItem key='active' value={constants.waivers.FREE_AGENCY}>
        Active Roster
      </MenuItem>
    )
  }

  const getOptionSelected = (option, value) => option.id === value.id
  const renderOption = (props, option) => {
    return (
      <div {...props}>
        <div className='release__select-player'>
          <div className='release__select-player-value'>${option.value}</div>
          <div className='player__name-position'>
            <Position pos={option.pos} />
          </div>
          <div className='player__name-main'>
            <span>{option.pname}</span>
            <NFLTeam team={option.team} />
          </div>
        </div>
      </div>
    )
  }
  const renderTags = (value, getTagProps) =>
    value.map((option, index) => (
      // eslint-disable-next-line
      <Chip label={option.label} {...getTagProps({ index })} />
    ))
  const title = 'Conditionally release'
  const renderInput = (params) => (
    <TextField
      {...params}
      error={missing_release}
      variant='outlined'
      label={title}
      placeholder={title}
    />
  )

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Waiver Claim</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {`Add ${player_map.get('name')} (${player_map.get('pos')})`}
        </DialogContentText>
        <div className='confirmation__inputs'>
          {waiver_type === constants.waivers.FREE_AGENCY && (
            <TextField
              label='Bid'
              helperText={`Max Bid: ${waiver_max_bid}`}
              error={waiver_error}
              value={waiver_bid}
              onChange={handleBid}
              InputProps={{
                startAdornment: (
                  <InputAdornment position='start'>$</InputAdornment>
                )
              }}
              size='small'
              variant='outlined'
            />
          )}
          <FormControl size='small' variant='outlined'>
            <InputLabel id='type-label'>Type</InputLabel>
            <Select
              labelId='type-label'
              error={missing_type}
              value={waiver_type}
              disabled={Boolean(waiver)}
              onChange={handleType}
              label='Type'
            >
              {typeItems}
            </Select>
          </FormControl>
          {waiver_type && (
            <Autocomplete
              multiple
              options={options}
              getOptionLabel={(x) => x.label}
              getOptionSelected={getOptionSelected}
              renderOption={renderOption}
              filterSelectedOptions
              value={releasePlayers}
              onChange={handleRelease}
              renderTags={renderTags}
              renderInput={renderInput}
            />
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} text>
          Cancel
        </Button>
        <Button onClick={handleSubmit} text>
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  )
}

WaiverConfirmation.propTypes = {
  player_map: ImmutablePropTypes.map,
  rosterPlayers: PropTypes.object,
  waiver: PropTypes.object,
  roster: ImmutablePropTypes.record,
  team: ImmutablePropTypes.record,
  league: PropTypes.object,
  status: PropTypes.object,
  onClose: PropTypes.func,
  claim: PropTypes.func,
  update: PropTypes.func
}
