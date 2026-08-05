import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

const Row = ({ data }) => (
  <div className='player__selected-row'>
    <div className='row__group-body'>
      <div className='refactor table__cell metric'>{data.season_year}</div>
      <div className='table__cell metric'>{data.season_type || '-'}</div>
      <div className='table__cell metric'>{data.week}</div>
      <div className='table__cell text'>{data.status || '-'}</div>
      <div className='table__cell text'>{data.injury_type || '-'}</div>
      <div className='table__cell'>
        <div className='table__cell-text'>
          {data.monday_practice_status || '-'}
        </div>
      </div>
      <div className='table__cell'>
        <div className='table__cell-text'>
          {data.tuesday_practice_status || '-'}
        </div>
      </div>
      <div className='table__cell'>
        <div className='table__cell-text'>
          {data.wednesday_practice_status || '-'}
        </div>
      </div>
      <div className='table__cell'>
        <div className='table__cell-text'>
          {data.thursday_practice_status || '-'}
        </div>
      </div>
      <div className='table__cell'>
        <div className='table__cell-text'>
          {data.friday_practice_status || '-'}
        </div>
      </div>
      <div className='table__cell'>
        <div className='table__cell-text'>
          {data.saturday_practice_status || '-'}
        </div>
      </div>
      <div className='table__cell'>
        <div className='table__cell-text'>
          {data.sunday_practice_status || '-'}
        </div>
      </div>
    </div>
  </div>
)

Row.propTypes = {
  data: PropTypes.object
}

export default function SelectedPlayerPractice({
  player_map,
  load,
  practices
}) {
  const pid = player_map.get('pid')
  useEffect(() => {
    if (pid) {
      load(pid)
    }
  }, [pid, load])

  const rows = []
  practices.forEach((practice, index) => {
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
            <div className='table__cell metric'>Type</div>
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

SelectedPlayerPractice.propTypes = {
  player_map: ImmutablePropTypes.map,
  load: PropTypes.func,
  practices: ImmutablePropTypes.list
}
