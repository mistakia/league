import React from 'react'
import PropTypes from 'prop-types'

const defense = () => (
  <div className='row__group'>
    <div className='row__group-body'>
      <div className='table__cell'>PA</div>
      <div className='table__cell'>YA</div>
      <div className='table__cell'>SK</div>
      <div className='table__cell'>INT</div>
      <div className='table__cell'>FF</div>
      <div className='table__cell'>FR</div>
      <div className='table__cell'>3NO</div>
      <div className='table__cell'>4DS</div>
      <div className='table__cell'>BLK</div>
      <div className='table__cell'>SFT</div>
      <div className='table__cell'>2PT</div>
      <div className='table__cell'>TD</div>
      <div className='table__cell'>PRTD</div>
      <div className='table__cell'>KRTD</div>
    </div>
  </div>
)

const kicker = () => (
  <div className='row__group'>
    <div className='row__group-body'>
      <div className='table__cell'>XPM</div>
      <div className='table__cell'>FGM</div>
      <div className='table__cell'>0-19</div>
      <div className='table__cell'>20-29</div>
      <div className='table__cell'>30-39</div>
      <div className='table__cell'>40-49</div>
      <div className='table__cell'>50+</div>
    </div>
  </div>
)

const passing_rushing = () => [
  <div className='row__group' key={0}>
    <div className='row__group-head'>Passing</div>
    <div className='row__group-body'>
      <div className='table__cell'>ATT</div>
      <div className='table__cell'>YDS</div>
      <div className='table__cell'>TD</div>
      <div className='table__cell'>INT</div>
    </div>
  </div>,
  <div className='row__group' key={1}>
    <div className='row__group-head'>Rushing</div>
    <div className='row__group-body'>
      <div className='table__cell'>ATT</div>
      <div className='table__cell'>YDS</div>
      <div className='table__cell'>TD</div>
      <div className='table__cell'>FUM</div>
    </div>
  </div>
]

const rushing_receiving = () => [
  <div className='row__group' key={0}>
    <div className='row__group-head'>Rushing</div>
    <div className='row__group-body'>
      <div className='table__cell'>ATT</div>
      <div className='table__cell'>YDS</div>
      <div className='table__cell'>TD</div>
      <div className='table__cell'>FUM</div>
    </div>
  </div>,
  <div className='row__group' key={1}>
    <div className='row__group-head'>Receiving</div>
    <div className='row__group-body'>
      <div className='table__cell'>TAR</div>
      <div className='table__cell'>REC</div>
      <div className='table__cell'>YDS</div>
      <div className='table__cell'>TD</div>
    </div>
  </div>
]

const receiving_rushing = () => [
  <div className='row__group' key={0}>
    <div className='row__group-head'>Receiving</div>
    <div className='row__group-body'>
      <div className='table__cell'>TAR</div>
      <div className='table__cell'>REC</div>
      <div className='table__cell'>YDS</div>
      <div className='table__cell'>TD</div>
    </div>
  </div>,
  <div className='row__group' key={1}>
    <div className='row__group-head'>Rushing</div>
    <div className='row__group-body'>
      <div className='table__cell'>ATT</div>
      <div className='table__cell'>YDS</div>
      <div className='table__cell'>TD</div>
      <div className='table__cell'>FUM</div>
    </div>
  </div>
]

export default class PlayerSelectedRowHeader extends React.Component {
  render = () => {
    const { pos } = this.props

    switch (pos) {
      case 'DST':
        return defense()
      case 'K':
        return kicker()
      case 'QB':
        return passing_rushing()
      case 'RB':
        return rushing_receiving()
      case 'WR':
      case 'TE':
        return receiving_rushing()
      default:
        return null
    }
  }
}

PlayerSelectedRowHeader.propTypes = {
  pos: PropTypes.string
}
