import React from 'react'
import dayjs from 'dayjs'

import './draft-schedule.styl'

export default class DraftSchedule extends React.Component {
  render = () => {
    const { league, picks } = this.props
    const m = dayjs.unix(league.ddate)
    const startDate = m.date()
    const draftMonth = m.month()

    const tbl = []
    const calendar = (m) => {
      const firstDay = m.startOf('month').day()
      const month = m.month()
      const daysInMonth = m.daysInMonth()
      const daysInPreviousMonth = dayjs(m).subtract(1, 'month').daysInMonth()
      const picksInPreviousMonth = daysInPreviousMonth - startDate + 1

      tbl.push(
        <div key={`${month}`} className='draft__schedule-title'>
          {m.format('MMMM')}
        </div>
      )

      let date = 1
      for (let i = 0; i < 6; i++) {
        const cells = []
        for (let j = 0; j < 7; j++) {
          if (i === 0 && j < firstDay) {
            const cell = <div key={j} className='draft__schedule-cell' />
            cells.push(cell)
          } else if (date > daysInMonth) {
            if (i === 5 && j === 0) break
            const cell = <div key={j} className='draft__schedule-cell' />
            cells.push(cell)
          } else {
            const classNames = ['draft__schedule-cell']
            if (date === dayjs().date() && month === dayjs().month())
              classNames.push('today')
            if (month === draftMonth) {
              if (date === startDate) classNames.push('start')
              for (const pick of picks) {
                const pickDate = pick.pick + startDate - 1
                if (pickDate === date) classNames.push('pick')
              }
            } else {
              for (const pick of picks) {
                const pickDate = pick.pick - picksInPreviousMonth
                if (pickDate === date) classNames.push('pick')
              }
            }
            const cell = (
              <div key={j} className={classNames.join(' ')}>
                {date}
              </div>
            )
            cells.push(cell)
            date++
          }
        }
        const row = (
          <div key={`${month}${i}`} className='draft__schedule-row'>
            {cells}
          </div>
        )
        tbl.push(row)
      }
    }

    calendar(m)
    calendar(m.add(1, 'month'))

    return (
      <div className='draft__schedule'>
        {tbl}
        <div className='draft__key'>
          <div className='draft__key-today'>Today</div>
          <div className='draft__key-start'>Start</div>
          <div className='draft__key-pick'>Pick</div>
        </div>
      </div>
    )
  }
}
