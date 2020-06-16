import React from 'react'

import PageLayout from '@layouts/page'

import './standings.styl'

export default function () {
  const body = (
    <div className='standings'>
      <div className='dashboard__section'>
        <div className='dashboard__section-header'>
          <div className='dashboard__section-header-title'>Overall</div>
          <div className='dashboard__section-body-header'>
            <div className='player__item-position'></div>
            <div className='player__item-name'>Team</div>
            <div className='player__item-metric'>Rec</div>
            <div className='player__item-metric'>PF</div>
            <div className='player__item-metric'>PA</div>
            <div className='player__item-metric'>PF/G</div>
            <div className='player__item-metric'>PA/G</div>
            <div className='player__item-metric'>Wa</div>
            <div className='player__item-metric'>PP</div>
            <div className='player__item-metric'>PP%</div>
            <div className='player__item-metric'>P Odds</div>
            {/* Projected points per week */}
            {/* Projected points */}
          </div>
        </div>
        <div className='dashboard__section-body'>
        </div>
      </div>
      <div className='dashboard__section'>
        <div className='dashboard__section-header'>
          <div className='dashboard__section-header-title'>Division I</div>
          <div className='dashboard__section-body-header'>
            <div className='player__item-position'></div>
            <div className='player__item-name'>Team</div>
            <div className='player__item-metric'>Rec</div>
            <div className='player__item-metric'>PF</div>
            <div className='player__item-metric'>PA</div>
            <div className='player__item-metric'>PF/G</div>
            <div className='player__item-metric'>PA/G</div>
            <div className='player__item-metric'>Wa</div>
            <div className='player__item-metric'>PP</div>
            <div className='player__item-metric'>PP%</div>
            <div className='player__item-metric'>P Odds</div>
            {/* Projected points per week */}
            {/* Projected points */}
          </div>
        </div>
        <div className='dashboard__section-body'>
        </div>
      </div>
      <div className='dashboard__section'>
        <div className='dashboard__section-header'>
          <div className='dashboard__section-header-title'>Division II</div>
          <div className='dashboard__section-body-header'>
            <div className='player__item-position'></div>
            <div className='player__item-name'>Team</div>
            <div className='player__item-metric'>Rec</div>
            <div className='player__item-metric'>PF</div>
            <div className='player__item-metric'>PA</div>
            <div className='player__item-metric'>PF/G</div>
            <div className='player__item-metric'>PA/G</div>
            <div className='player__item-metric'>Wa</div>
            <div className='player__item-metric'>PP</div>
            <div className='player__item-metric'>PP%</div>
            <div className='player__item-metric'>P Odds</div>
            {/* Projected points per week */}
            {/* Projected points */}
          </div>
        </div>
        <div className='dashboard__section-body'>
        </div>
      </div>
      <div className='dashboard__section'>
        <div className='dashboard__section-header'>
          <div className='dashboard__section-header-title'>Division III</div>
          <div className='dashboard__section-body-header'>
            <div className='player__item-position'></div>
            <div className='player__item-name'>Team</div>
            <div className='player__item-metric'>Rec</div>
            <div className='player__item-metric'>PF</div>
            <div className='player__item-metric'>PA</div>
            <div className='player__item-metric'>PF/G</div>
            <div className='player__item-metric'>PA/G</div>
            <div className='player__item-metric'>Wa</div>
            <div className='player__item-metric'>PP</div>
            <div className='player__item-metric'>PP%</div>
            <div className='player__item-metric'>P Odds</div>
            {/* Projected points per week */}
            {/* Projected points */}
          </div>
        </div>
        <div className='dashboard__section-body'>
        </div>
      </div>
      <div className='dashboard__section'>
        <div className='dashboard__section-header'>
          <div className='dashboard__section-header-title'>Division IV</div>
          <div className='dashboard__section-body-header'>
            <div className='player__item-position'></div>
            <div className='player__item-name'>Team</div>
            <div className='player__item-metric'>Rec</div>
            <div className='player__item-metric'>PF</div>
            <div className='player__item-metric'>PA</div>
            <div className='player__item-metric'>PF/G</div>
            <div className='player__item-metric'>PA/G</div>
            <div className='player__item-metric'>Wa</div>
            <div className='player__item-metric'>PP</div>
            <div className='player__item-metric'>PP%</div>
            <div className='player__item-metric'>P Odds</div>
            {/* Projected points per week */}
            {/* Projected points */}
          </div>
        </div>
        <div className='dashboard__section-body'>
        </div>
      </div>
    </div>
  )

  return (
    <PageLayout body={body} scroll />
  )
}
