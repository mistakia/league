import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import FormControl from '@mui/material/FormControl'
import MenuItem from '@mui/material/MenuItem'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogTitle from '@mui/material/DialogTitle'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import Chip from '@mui/material/Chip'

import Position from '@components/position'
import NFLTeam from '@components/nfl-team'
import Button from '@components/button'
import { constants } from '@libs-shared'

import './restricted-free-agency-confirmation.styl'

export default class RestrictedFreeAgencyConfirmation extends React.Component {
  constructor(props) {
    super(props)

    const { team, playerMap } = props

    this.state = {
      release_ids: playerMap.get(
        'restricted_free_agency_conditional_releases',
        []
      ),
      untag: '',
      bid: playerMap.get('bid', 0),
      error: false,
      missing_release: false,
      missing_untag: false,
      bid_exceeds_max: false
    }

    this._untags = []
    const tagged_players = team.roster.getPlayersByTag(
      constants.tags.RESTRICTED_FREE_AGENCY
    )
    const tagged_pids = tagged_players.map((p) => p.pid)
    for (const pid of tagged_pids) {
      const player_map = team.players.find(
        (player_map) => player_map.get('pid') === pid
      )
      if (player_map.get('restricted_free_agency_tag_processed')) {
        continue
      }
      this._untags.push(player_map)
    }

    const pid = playerMap.get('pid')
    const bid = playerMap.get('bid')
    const restricted_free_agency_bid_exists =
      bid !== null && bid !== undefined && Number(bid) >= 0
    this._isUpdate = Boolean(
      tagged_pids.includes(pid) || restricted_free_agency_bid_exists
    )
    this._isOriginalTeam = team.roster.tid === playerMap.get('tid')
    // TODO - check roster size limit eligiblity
    this._isEligible =
      this._isUpdate ||
      !this._isOriginalTeam ||
      team.roster.isEligibleForTag({
        tag: constants.tags.RESTRICTED_FREE_AGENCY
      })

    // Check if initial bid exceeds max bid
    const initial_bid = playerMap.get('bid', 0)
    if (initial_bid > 0) {
      const max_bid = this.get_max_bid()
      if (initial_bid > max_bid) {
        this.state.bid_exceeds_max = true
      }
    }
  }

  get_max_bid = () => {
    const available_salary = this.props.team.roster.availableCap
    const { playerMap, cutlist_total_salary } = this.props
    const value = playerMap.get('value', 0)
    const bid = playerMap.get('bid', 0)
    const player_salary = bid || value

    const not_in_cutlist = this.state.release_ids.filter(
      (pid) => !this.props.cutlist.includes(pid)
    )
    const release_total_salary = not_in_cutlist.reduce((sum, pid) => {
      const player_map = this.props.team.players.find(
        (player_map) => player_map.get('pid') === pid
      )
      const value = player_map.get('value', 0)

      return sum + value
    }, 0)

    const salary_space_total =
      available_salary + cutlist_total_salary + release_total_salary
    const on_cutlist = this.props.cutlist.includes(playerMap.get('pid'))
    return (
      salary_space_total +
      (this._isOriginalTeam && !on_cutlist ? player_salary : 0)
    )
  }

  handleBid = (event) => {
    const { value } = event.target
    const max_bid = this.get_max_bid()

    if (isNaN(value) || value % 1 !== 0) {
      this.setState({ error: true, bid_exceeds_max: false })
    } else if (value < 0) {
      this.setState({ error: true, bid_exceeds_max: false })
    } else {
      const bid_exceeds_max = parseInt(value, 10) > max_bid
      this.setState({
        error: false,
        bid_exceeds_max
      })
    }

    this.setState({ bid: value })
  }

  handleRelease = (event, value) => {
    const pids = value.map((p) => p.id)
    this.setState({ release_ids: pids }, () => {
      // Recalculate if bid exceeds max after release changes
      const current_bid = parseInt(this.state.bid, 10)
      if (current_bid > 0) {
        const max_bid = this.get_max_bid()
        const bid_exceeds_max = current_bid > max_bid
        this.setState({ bid_exceeds_max })
      }
    })
  }

  handleUntag = (event) => {
    const { value } = event.target
    this.setState({ untag: value, missing_untag: false })
  }

  handleSubmit = () => {
    const { untag, error, bid } = this.state
    const { tid } = this.props.team.roster
    const pid = this.props.playerMap.get('pid')
    const player_tid = this.props.playerMap.get('tid')

    if (!this._isEligible && !untag) {
      return this.setState({ missing_untag: true })
    } else {
      this.setState({ missing_untag: false })
    }

    if (!error) {
      const data = {
        pid,
        release: this.state.release_ids,
        playerTid: player_tid,
        teamId: tid,
        bid: parseInt(bid, 10),
        remove: untag
      }

      if (this._isUpdate) {
        this.props.update_restricted_free_agency_tag(data)
      } else {
        this.props.add_restricted_free_agency_tag(data)
      }

      this.props.onClose()
    }
  }

  render = () => {
    const { team, playerMap } = this.props

    const menu_items = []
    for (const r_player_map of this._untags) {
      const pid = r_player_map.get('pid')
      menu_items.push(
        <MenuItem key={pid} value={pid}>
          {r_player_map.get('name')} ({r_player_map.get('pos')})
        </MenuItem>
      )
    }

    const options = []
    const pid = playerMap.get('pid')
    team.players.forEach((player_map) => {
      const pid_i = player_map.get('pid')
      if (pid_i === pid) {
        return
      }

      if (player_map.get('tag') === constants.tags.RESTRICTED_FREE_AGENCY) {
        return
      }

      const pos = player_map.get('pos')
      options.push({
        id: pid_i,
        label: player_map.get('name'),
        pos,
        team: player_map.get('team'),
        pname: player_map.get('pname'),
        value: player_map.get('value')
      })
    })
    const is_option_equal_to_value = (option, value) => option.id === value.id
    const render_option = (props, option) => {
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
    const render_tags = (value, getTagProps) =>
      value.map((option, index) => (
        // eslint-disable-next-line
        <Chip label={option.label} {...getTagProps({ index })} />
      ))
    const title = 'Select players to conditionally release'
    const render_input = (params) => (
      <TextField
        {...params}
        variant='outlined'
        label={title}
        placeholder={title}
      />
    )
    const release_players = []
    this.state.release_ids.forEach((pid) => {
      const player_map = this.props.team.players.find(
        (player_map) => player_map.get('pid') === pid
      )
      release_players.push({
        id: player_map.get('pid'),
        label: player_map.get('name'),
        pos: player_map.get('pos'),
        team: player_map.get('team'),
        pname: player_map.get('pname'),
        value: player_map.get('value')
      })
    })

    return (
      <Dialog open onClose={this.props.onClose}>
        <DialogTitle>Restricted Free Agent Tag</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`Place Restricted Free Agent bid on ${playerMap.get('name')} (${playerMap.get(
              'pos'
            )})`}
          </DialogContentText>
          <div className='restricted-free-agency__bid-inputs'>
            <TextField
              label='Bid'
              helperText={`Max Bid: ${this.get_max_bid()}`}
              error={this.state.error}
              value={this.state.bid}
              onChange={this.handleBid}
              InputProps={{
                startAdornment: (
                  <InputAdornment position='start'>$</InputAdornment>
                )
              }}
              size='small'
              variant='outlined'
            />
            {this.state.bid_exceeds_max && (
              <div className='restricted-free-agency__bid-warning'>
                <strong>⚠️ WARNING:</strong> Your bid of ${this.state.bid}{' '}
                exceeds the maximum available bid of ${this.get_max_bid()}. You
                may not have sufficient salary cap space to successfully process
                this transaction.
              </div>
            )}
            {!this._isEligible && (
              <FormControl size='small' variant='outlined'>
                <InputLabel id='untag-label'>Remove Tag</InputLabel>
                <Select
                  labelId='untag-label'
                  error={this.state.missing_untag}
                  value={this.state.untag}
                  onChange={this.handleUntag}
                  label='Remove Tag'
                >
                  {menu_items}
                </Select>
              </FormControl>
            )}
            <Autocomplete
              multiple
              options={options}
              getOptionLabel={(x) => x.label}
              isOptionEqualToValue={is_option_equal_to_value}
              renderOption={render_option}
              filterSelectedOptions
              value={release_players}
              onChange={this.handleRelease}
              renderTags={render_tags}
              renderInput={render_input}
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={this.props.onClose} text>
            Cancel
          </Button>
          <Button onClick={this.handleSubmit} text>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    )
  }
}

RestrictedFreeAgencyConfirmation.propTypes = {
  onClose: PropTypes.func,
  team: PropTypes.object,
  playerMap: ImmutablePropTypes.map,
  cutlist_total_salary: PropTypes.number,
  cutlist: ImmutablePropTypes.list,
  add_restricted_free_agency_tag: PropTypes.func,
  update_restricted_free_agency_tag: PropTypes.func
}
