import React from 'react'

const defense = () => (
  <div className='row__group'>
    <div className='row__group-body'>
      <div className='table__cell metric'>PA</div>
      <div className='table__cell metric'>YA</div>
      <div className='table__cell metric'>SK</div>
      <div className='table__cell metric'>INT</div>
      <div className='table__cell metric'>FF</div>
      <div className='table__cell metric'>FR</div>
      <div className='table__cell metric'>3NO</div>
      <div className='table__cell metric'>4DS</div>
      <div className='table__cell metric'>BLK</div>
      <div className='table__cell metric'>SFT</div>
      <div className='table__cell metric'>2PT</div>
      <div className='table__cell metric'>TD</div>
      <div className='table__cell metric'>PRTD</div>
      <div className='table__cell metric'>KRTD</div>
    </div>
  </div>
)

const kicker = () => (
  <div className='row__group'>
    <div className='row__group-body'>
      <div className='table__cell metric'>XPM</div>
      <div className='table__cell metric'>FGM</div>
      <div className='table__cell metric'>0-19</div>
      <div className='table__cell metric'>20-29</div>
      <div className='table__cell metric'>30-39</div>
      <div className='table__cell metric'>40-49</div>
      <div className='table__cell metric'>50+</div>
    </div>
  </div>
)

const player = () => ([
  (
    <div className='row__group' key={0}>
      <div className='row__group-head'>Passing</div>
      <div className='row__group-body'>
        <div className='table__cell metric'>YDS</div>
        <div className='table__cell metric'>TD</div>
        <div className='table__cell metric'>INT</div>
      </div>
    </div>
  ), (
    <div className='row__group' key={1}>
      <div className='row__group-head'>Rushing</div>
      <div className='row__group-body'>
        <div className='table__cell metric'>CAR</div>
        <div className='table__cell metric'>YDS</div>
        <div className='table__cell metric'>TD</div>
        <div className='table__cell metric'>FUM</div>
      </div>
    </div>
  ), (
    <div className='row__group' key={2}>
      <div className='row__group-head'>Receiving</div>
      <div className='row__group-body'>
        <div className='table__cell metric'>TAR</div>
        <div className='table__cell metric'>REC</div>
        <div className='table__cell metric'>YDS</div>
        <div className='table__cell metric'>TD</div>
      </div>
    </div>
  )
])

export default class PlayerSelectedRowHeader extends React.Component {
  render = () => {
    const { pos } = this.props

    switch (pos) {
      case 'DST':
        return defense()
      case 'K':
        return kicker()
      default:
        return player()
    }
  }
}
