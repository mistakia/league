import React from 'react'

import Icon from '@components/icon'

import './players-search.styl'

export default class PlayersSearch extends React.Component {
  constructor (props) {
    super(props)

    this.state = {
      value: this.props.value || ''
    }
  }

  handleClick = () => {
    const value = ''
    this.setState({ value })
    this.props.search(value)
  }

  handleChange = (event) => {
    const { value } = event.target
    this.setState({ value })
    this.props.search(value)
  }

  render = () => {
    return (
      <div className='players__search'>
        <input
          className='players__search-input'
          type='text'
          placeholder='Filter players'
          value={this.state.value}
          onChange={this.handleChange}
        />
        {this.state.value &&
          <div className='players__search-clear' onClick={this.handleClick}>
            <Icon name='clear' />
          </div>}
      </div>
    )
  }
}
