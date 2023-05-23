import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

const Row = ({ data }) => (
  <div className='player__selected-row'>
    <div className='row__group-body'>
      <div className='table__cell metric'>{data.year}</div>
      <div className='table__cell metric'>{data.week}</div>
      <div className='table__cell text'>{data.status || '-'}</div>
      <div className='table__cell text'>{data.inj || '-'}</div>
      <div className='table__cell'>
        <div className='table__cell-text'>{data.m || '-'}</div>
      </div>
      <div className='table__cell'>
        <div className='table__cell-text'>{data.t || '-'}</div>
      </div>
      <div className='table__cell'>
        <div className='table__cell-text'>{data.w || '-'}</div>
      </div>
      <div className='table__cell'>
        <div className='table__cell-text'>{data.th || '-'}</div>
      </div>
      <div className='table__cell'>
        <div className='table__cell-text'>{data.f || '-'}</div>
      </div>
      <div className='table__cell'>
        <div className='table__cell-text'>{data.s || '-'}</div>
      </div>
      <div className='table__cell'>
        <div className='table__cell-text'>{data.su || '-'}</div>
      </div>
    </div>
  </div>
)

Row.propTypes = {
  data: PropTypes.object
}

export default class SelectedPlayerPractice extends React.Component {
  componentDidMount() {
    const pid = this.props.playerMap.get('pid')
    this.props.load(pid)
  }

  render = () => {
    const rows = []
    this.props.practices.forEach((practice, index) => {
      rows.push(<Row key={index} data={practice} />)
    })

    return (
      <div className='selected__section'>
        <div className='selected__table-header sticky__column'>
          <div className='row__group-head'>Practice Reports</div>
        </div>
        <div className='selected__table-header'>
          <div className='row__group'>
            <div className='row__group-body'>
              <div className='table__cell metric'>Year</div>
              <div className='table__cell metric'>Week</div>
              <div className='table__cell text'>Status</div>
              <div className='table__cell text'>Injury</div>
              <div className='table__cell'>Mon</div>
              <div className='table__cell'>Tue</div>
              <div className='table__cell'>Wed</div>
              <div className='table__cell'>Thu</div>
              <div className='table__cell'>Fri</div>
              <div className='table__cell'>Sat</div>
              <div className='table__cell'>Sun</div>
            </div>
          </div>
        </div>
        <div className='empty'>{rows}</div>
      </div>
    )
  }
}

SelectedPlayerPractice.propTypes = {
  playerMap: ImmutablePropTypes.map,
  load: PropTypes.func,
  practices: ImmutablePropTypes.list
}
