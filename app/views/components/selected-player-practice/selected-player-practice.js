import React from 'react'

const Row = ({ data }) => (
  <div className='player__selected-row'>
    <div className='row__group-body'>
      <div className='row__text'>{data.week}</div>
      <div className='row__text'>{data.status || '-'}</div>
      <div className='row__text'>{data.inj || '-'}</div>
      <div className='row__text'>{data.m || '-'}</div>
      <div className='row__text'>{data.t || '-'}</div>
      <div className='row__text'>{data.w || '-'}</div>
      <div className='row__text'>{data.th || '-'}</div>
      <div className='row__text'>{data.f || '-'}</div>
      <div className='row__text'>{data.s || '-'}</div>
      <div className='row__text'>{data.su || '-'}</div>
    </div>
  </div>
)

export default class SelectedPlayerPractice extends React.Component {
  render = () => {
    const rows = []
    for (const [index, p] of this.props.player.practice.entries()) {
      rows.push(<Row key={index} data={p} />)
    }

    return (
      <div className='selected__section'>
        <div className='selected__section-header'>
          <div className='row__group-head'>Practice Reports</div>
        </div>
        <div className='selected__section-header'>
          <div className='row__group'>
            <div className='row__group-body'>
              <div className='row__text'>Wk</div>
              <div className='row__text'>St</div>
              <div className='row__text'>Inj</div>
              <div className='row__text'>M</div>
              <div className='row__text'>Tu</div>
              <div className='row__text'>W</div>
              <div className='row__text'>Th</div>
              <div className='row__text'>F</div>
              <div className='row__text'>Sa</div>
              <div className='row__text'>Su</div>
            </div>
          </div>
        </div>
        <div className='empty'>{rows}</div>
      </div>
    )
  }
}
