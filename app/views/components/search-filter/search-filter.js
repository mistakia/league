import React from 'react'

import Icon from '@components/icon'

import './search-filter.styl'

export default class SearchFilter extends React.Component {
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
      <div className='search__filter'>
        <input
          className='search__filter-input'
          type='text'
          placeholder='Filter players'
          value={this.state.value}
          onChange={this.handleChange}
        />
        {this.state.value &&
          <div className='search__filter-clear' onClick={this.handleClick}>
            <Icon name='clear' />
          </div>}
      </div>
    )
  }
}
