import React from 'react'
import PropTypes from 'prop-types'
import Switch from '@mui/material/Switch'

export default class WatchlistFilter extends React.Component {
  handleChange = () => {
    this.props.toggle()
  }

  render() {
    const { watchlistOnly } = this.props

    return (
      <div className='player__filter switch'>
        <div className='player__filter-label'>Watchlist</div>
        <Switch
          size='small'
          checked={watchlistOnly}
          onChange={this.handleChange}
        />
      </div>
    )
  }
}

WatchlistFilter.propTypes = {
  watchlistOnly: PropTypes.bool,
  toggle: PropTypes.func
}
