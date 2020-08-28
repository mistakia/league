import React from 'react'

export default class DashboardTeamSummary extends React.Component {
  render = () => {
    return (
      <div className='dashboard__section-side'>
        <div className='dashboard__section-side-title'>Summary</div>
        <div className='dashboard__section-side-body'>
          <table>
            <tbody>
              <tr>
                <td>Record</td>
                <td>-</td>
                <td>-</td>
              </tr>
              <tr>
                <td>Points</td>
                <td>-</td>
                <td>-</td>
              </tr>
              <tr>
                <td>Proj. Record</td>
                <td>-</td>
                <td>-</td>
              </tr>
              <tr>
                <td>Proj. Points</td>
                <td>-</td>
                <td>-</td>
              </tr>
              <tr>
                <td>Championship Odds</td>
                <td>-</td>
                <td>-</td>
              </tr>
              <tr>
                <td>Playoff Odds</td>
                <td>-</td>
                <td>-</td>
              </tr>
              <tr>
                <td>Division Odds</td>
                <td>-</td>
                <td>-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }
}
