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

import { isSlotActive } from '@libs-shared'

import Position from '@components/position'
import NFLTeam from '@components/nfl-team'
import Button from '@components/button'

import './restricted-free-agency-confirmation.styl'
import { player_tag_types } from '@constants'

export default class RestrictedFreeAgencyConfirmation extends React.Component {
  constructor(props) {
    super(props)

    const { team, player_map } = props

    // Immutable's notSetValue only applies when the key is ABSENT — a key
    // present with an explicit null still returns null, so `get(key, [])` is
    // not a guarantee. Coalesce instead: release_ids is iterated unguarded in
    // render() and get_max_bid().
    this.state = {
      release_ids:
        player_map.get('restricted_free_agency_conditional_releases') || [],
      untag: '',
      bid: player_map.get('bid') ?? 0,
      error: false,
      missing_release: false,
      missing_untag: false
    }

    this._untags = []
    const tagged_players = team.roster.getPlayersByTag(
      player_tag_types.RESTRICTED_FREE_AGENCY
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

    const pid = player_map.get('pid')
    const bid = player_map.get('bid')
    const restricted_free_agency_bid_exists =
      bid !== null && bid !== undefined && Number(bid) >= 0
    this._isUpdate = Boolean(
      tagged_pids.includes(pid) || restricted_free_agency_bid_exists
    )
    this._isOriginalTeam = team.roster.tid === player_map.get('tid')
    // TODO - check roster size limit eligiblity
    this._isEligible =
      this._isUpdate ||
      !this._isOriginalTeam ||
      team.roster.isEligibleForTag({
        tag: player_tag_types.RESTRICTED_FREE_AGENCY
      })
  }

  // What a player currently costs this team against the cap, taken from the
  // roster rather than re-derived from the player map. `Roster` applies the
  // extension and restricted free agency pricing that `availableCap` sums, so
  // reading it here is the only way the two halves of `get_bid_limits` cannot
  // disagree. A player in a practice squad or reserve slot is not charged at
  // all, so releasing them frees nothing.
  get_active_charge = (pid) => {
    const roster_player = this.props.team.roster.get(pid)
    return roster_player && isSlotActive(roster_player.slot)
      ? roster_player.value
      : 0
  }

  // The components of the ceiling, kept separate so the dialog can show the
  // manager the arithmetic instead of a bare number. The total matches what
  // `process-restricted-free-agency-bid` will allow at processing time: the cap
  // left over once everything this bid clears is no longer charged.
  get_bid_limits = () => {
    const { team, player_map, cutlist, cutlist_total_salary } = this.props
    const pid = player_map.get('pid')

    const release_total_salary = this.state.release_ids
      .filter((release_pid) => !cutlist.includes(release_pid))
      .reduce(
        (sum, release_pid) => sum + this.get_active_charge(release_pid),
        0
      )

    const own_player_charge =
      this._isOriginalTeam && !cutlist.includes(pid)
        ? this.get_active_charge(pid)
        : 0

    const available_cap = team.roster.availableCap

    return {
      available_cap,
      cutlist_total_salary,
      release_total_salary,
      own_player_charge,
      max_bid:
        available_cap +
        cutlist_total_salary +
        release_total_salary +
        own_player_charge
    }
  }

  get_max_bid = () => this.get_bid_limits().max_bid

  // A bid on your OWN restricted free agent may not sit more than $10 under the
  // player's market salary -- enforced in the API route, and invisible here until
  // the request came back as an opaque failure. Mirrors the server's own
  // behavior of skipping the rule when no market salary has been generated.
  get_market_salary = () => {
    if (!this._isOriginalTeam) {
      return null
    }

    const market_salary = this.props.player_map.getIn(['market_salary', '0'])
    return market_salary === null || market_salary === undefined
      ? null
      : Number(market_salary)
  }

  get_min_bid = () => {
    const market_salary = this.get_market_salary()
    return market_salary === null
      ? 0
      : Math.max(0, Math.ceil(market_salary - 10))
  }

  handleBid = (event) => {
    const { value } = event.target
    const error = isNaN(value) || value % 1 !== 0 || value < 0
    this.setState({ bid: value, error })
  }

  handleRelease = (event, value) => {
    this.setState({ release_ids: value.map((p) => p.id) })
  }

  handleUntag = (event) => {
    const { value } = event.target
    this.setState({ untag: value, missing_untag: false })
  }

  handleSubmit = () => {
    const { untag, error, bid } = this.state
    const { tid } = this.props.team.roster
    const pid = this.props.player_map.get('pid')
    const player_tid = this.props.player_map.get('tid')

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
        bid: Number(bid),
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
    const { team, player_map } = this.props

    const menu_items = []
    for (const r_player_map of this._untags) {
      const pid = r_player_map.get('pid')
      menu_items.push(
        <MenuItem key={pid} value={pid}>
          {r_player_map.get('name')} ({r_player_map.get('primary_position')})
        </MenuItem>
      )
    }

    const options = []
    const pid = player_map.get('pid')
    team.players.forEach((player_map) => {
      const pid_i = player_map.get('pid')
      if (pid_i === pid) {
        return
      }

      if (player_map.get('tag') === player_tag_types.RESTRICTED_FREE_AGENCY) {
        return
      }

      const pos = player_map.get('primary_position')
      options.push({
        id: pid_i,
        label: player_map.get('name'),
        pos,
        team: player_map.get('team'),
        pname: player_map.get('short_name'),
        // The cap charge, not the raw contract value -- this is the number that
        // moves the max bid when the player is selected, so showing anything
        // else makes the ceiling appear to move by the wrong amount.
        value: this.get_active_charge(pid_i)
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
    this.state.release_ids.forEach((release_pid) => {
      const release_player_map = this.props.team.players.find(
        (player_map) => player_map.get('pid') === release_pid
      )
      // A stored release can name a player who has since left the roster, and an
      // unguarded read here takes the whole page down rather than the one row.
      if (!release_player_map) {
        return
      }

      release_players.push({
        id: release_pid,
        label: release_player_map.get('name'),
        pos: release_player_map.get('primary_position'),
        team: release_player_map.get('team'),
        pname: release_player_map.get('short_name'),
        value: this.get_active_charge(release_pid)
      })
    })

    const {
      available_cap,
      cutlist_total_salary,
      release_total_salary,
      own_player_charge,
      max_bid
    } = this.get_bid_limits()
    const market_salary = this.get_market_salary()
    const min_bid = this.get_min_bid()

    // Both bounds are derived on every render from the same limits, so the
    // message and the number it quotes can never disagree.
    const numeric_bid = Number(this.state.bid)
    const has_numeric_bid = this.state.bid !== '' && !isNaN(numeric_bid)
    const bid_exceeds_max = has_numeric_bid && numeric_bid > max_bid
    const bid_below_min = has_numeric_bid && numeric_bid < min_bid

    const max_bid_parts = [`$${available_cap} cap space`]
    if (cutlist_total_salary) {
      max_bid_parts.push(`$${cutlist_total_salary} cutlist`)
    }
    if (release_total_salary) {
      max_bid_parts.push(`$${release_total_salary} conditional releases`)
    }
    if (own_player_charge) {
      max_bid_parts.push(
        `$${own_player_charge} currently charged for this player`
      )
    }

    return (
      <Dialog open onClose={this.props.onClose}>
        <DialogTitle>Restricted Free Agent Tag</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {`Place Restricted Free Agent bid on ${player_map.get('name')} (${player_map.get('primary_position')})`}
          </DialogContentText>
          <div className='restricted-free-agency__bid-inputs'>
            <TextField
              label='Bid'
              helperText={`Max bid $${max_bid} — ${max_bid_parts.join(' + ')}`}
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
            {bid_exceeds_max && (
              <div className='restricted-free-agency__bid-warning'>
                <strong>Over the cap:</strong> ${numeric_bid} is more than the $
                {max_bid} you can commit to this player, so this bid will fail
                when it is processed. Free up room by adding conditional
                releases below, using the cutlist, or lowering another bid.
              </div>
            )}
            {bid_below_min && (
              <div className='restricted-free-agency__bid-warning'>
                <strong>Below the market salary floor:</strong> a bid on your
                own player may not be more than $10 under their market salary of
                ${market_salary}. The lowest bid this league accepts for them is
                ${min_bid}.
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
  player_map: ImmutablePropTypes.map,
  cutlist_total_salary: PropTypes.number,
  cutlist: ImmutablePropTypes.list,
  add_restricted_free_agency_tag: PropTypes.func,
  update_restricted_free_agency_tag: PropTypes.func
}
