import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import dayjs from 'dayjs'

import './selected-player-content.styl'

export default function SelectedPlayerContent({
  pid,
  content_items,
  load_player_content
}) {
  useEffect(() => {
    if (pid) load_player_content(pid)
  }, [pid, load_player_content])

  // Nothing is rendered when there is nothing to render -- not an empty headed
  // section. The upstream is a supplementary feed on a public endpoint league
  // does not control, so "no items" is an ordinary state (unconfigured,
  // unreachable, or simply a player nobody wrote about) and a heading over
  // blank space would read as breakage.
  if (!content_items.size) return null

  return (
    <div className='selected__player-content'>
      {content_items.map((item, index) => (
        <a
          key={index}
          className='player-content__item'
          href={item.get('url')}
          target='_blank'
          rel='noreferrer noopener'
        >
          <div className='player-content__title'>{item.get('title')}</div>
          <div className='player-content__meta'>
            {item.get('domain') && (
              <span className='player-content__domain'>
                {item.get('domain')}
              </span>
            )}
            {item.get('published_at') && (
              <span className='player-content__date'>
                {dayjs(item.get('published_at')).format('MMM D')}
              </span>
            )}
          </div>
        </a>
      ))}
    </div>
  )
}

SelectedPlayerContent.propTypes = {
  pid: PropTypes.string,
  content_items: ImmutablePropTypes.list,
  load_player_content: PropTypes.func
}
