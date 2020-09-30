import React from 'react'

const defense = () => (
  <div className='row__group'>
    <div className='row__group-body'>
      <div className='player__row-metric'>PA</div>
      <div className='player__row-metric'>YA</div>
      <div className='player__row-metric'>SK</div>
      <div className='player__row-metric'>INT</div>
      <div className='player__row-metric'>FF</div>
      <div className='player__row-metric'>FR</div>
      <div className='player__row-metric'>3NO</div>
      <div className='player__row-metric'>4DS</div>
      <div className='player__row-metric'>BLK</div>
      <div className='player__row-metric'>SFT</div>
      <div className='player__row-metric'>2PT</div>
      <div className='player__row-metric'>TD</div>
      <div className='player__row-metric'>PRTD</div>
      <div className='player__row-metric'>KRTD</div>
    </div>
  </div>
)

const kicker = () => (
  <div className='row__group'>
    <div className='row__group-body'>
      <div className='player__row-metric'>XPM</div>
      <div className='player__row-metric'>FGM</div>
      <div className='player__row-metric'>0-19</div>
      <div className='player__row-metric'>20-29</div>
      <div className='player__row-metric'>30-39</div>
      <div className='player__row-metric'>40-49</div>
      <div className='player__row-metric'>50+</div>
    </div>
  </div>
)

const player = () => ([
  (
    <div className='row__group' key={0}>
      <div className='row__group-head'>Passing</div>
      <div className='row__group-body'>
        <div className='player__row-metric'>YDS</div>
        <div className='player__row-metric'>TD</div>
        <div className='player__row-metric'>INT</div>
      </div>
    </div>
  ), (
    <div className='row__group' key={1}>
      <div className='row__group-head'>Rushing</div>
      <div className='row__group-body'>
        <div className='player__row-metric'>CAR</div>
        <div className='player__row-metric'>YDS</div>
        <div className='player__row-metric'>TD</div>
        <div className='player__row-metric'>FUM</div>
      </div>
    </div>
  ), (
    <div className='row__group' key={2}>
      <div className='row__group-head'>Receiving</div>
      <div className='row__group-body'>
        <div className='player__row-metric'>TAR</div>
        <div className='player__row-metric'>REC</div>
        <div className='player__row-metric'>YDS</div>
        <div className='player__row-metric'>TD</div>
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
