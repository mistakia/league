import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

const Row = ({ data }) => (
  <div className='player__selected-row'>
    <div className='row__group-body'>
      <div className='table__cell metric'>{data.week}</div>
      <div className='table__cell metric'>{data.status || '-'}</div>
      <div className='table__cell metric'>{data.inj || '-'}</div>
      <div className='table__cell metric'>{data.m || '-'}</div>
      <div className='table__cell metric'>{data.t || '-'}</div>
      <div className='table__cell metric'>{data.w || '-'}</div>
      <div className='table__cell metric'>{data.th || '-'}</div>
      <div className='table__cell metric'>{data.f || '-'}</div>
      <div className='table__cell metric'>{data.s || '-'}</div>
      <div className='table__cell metric'>{data.su || '-'}</div>
    </div>
  </div>
)

Row.propTypes = {
  data: PropTypes.object
}

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
              <div className='table__cell metric'>Wk</div>
              <div className='table__cell metric'>St</div>
              <div className='table__cell metric'>Inj</div>
              <div className='table__cell metric'>M</div>
              <div className='table__cell metric'>Tu</div>
              <div className='table__cell metric'>W</div>
              <div className='table__cell metric'>Th</div>
              <div className='table__cell metric'>F</div>
              <div className='table__cell metric'>Sa</div>
              <div className='table__cell metric'>Su</div>
            </div>
          </div>
        </div>
        <div className='empty'>{rows}</div>
      </div>
    )
  }
}

SelectedPlayerPractice.propTypes = {
  player: ImmutablePropTypes.record
}
