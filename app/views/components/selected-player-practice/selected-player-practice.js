import React from 'react'

const Row = ({ data }) => (
  <div className='row__group'>
    <div className='row__group-body'>
      <div className='player__row-metric'>{data.week}</div>
      <div className='player__row-metric'>{data.status || '-'}</div>
      <div className='player__row-metric'>{data.inj || '-'}</div>
      <div className='player__row-metric'>{data.m || '-'}</div>
      <div className='player__row-metric'>{data.t || '-'}</div>
      <div className='player__row-metric'>{data.w || '-'}</div>
      <div className='player__row-metric'>{data.th || '-'}</div>
      <div className='player__row-metric'>{data.f || '-'}</div>
      <div className='player__row-metric'>{data.s || '-'}</div>
      <div className='player__row-metric'>{data.su || '-'}</div>
    </div>
  </div>
)

export default class SelectedPlayerPractice extends React.Component {
  render = () => {
    console.log(this.props.player.toJS())
    const rows = []
    for (const [index, p] of this.props.player.practice.entries()) {
      rows.push(<Row key={index} data={p} />)
    }

    return (
      <div className='selected__section'>
        <div className='selected__section-header'>
          <div className='row__group-head'>
            Practice Reports
          </div>
        </div>
        <div className='selected__section-header'>
          <div className='row__group'>
            <div className='row__group-body'>
              <div className='player__row-metric'>Wk</div>
              <div className='player__row-metric'>St</div>
              <div className='player__row-metric'>Inj</div>
              <div className='player__row-metric'>M</div>
              <div className='player__row-metric'>Tu</div>
              <div className='player__row-metric'>W</div>
              <div className='player__row-metric'>Th</div>
              <div className='player__row-metric'>F</div>
              <div className='player__row-metric'>Sa</div>
              <div className='player__row-metric'>Su</div>
            </div>
          </div>
        </div>
        <div className='empty'>
          {rows}
        </div>
      </div>
    )
  }
}
