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
      {/* Plain property access, NOT item.get(). The reducer stores these with
          `new List(items)`, and List does not deep-convert — its members stay
          plain objects, so `item.get` is undefined and calling it throws on
          the first render that has any content. That is the same shape
          `selected-player-markets` uses (`market.source_id`), and it is why
          this component looked fine for as long as the feed was switched off:
          the empty case returns before the map and never touches an item. */}
      {content_items.map((item, index) => (
        <a
          key={index}
          className='player-content__item'
          href={item.url}
          target='_blank'
          rel='noreferrer noopener'
        >
          <div className='player-content__title'>{item.title}</div>
          <div className='player-content__meta'>
            {item.domain && (
              <span className='player-content__domain'>{item.domain}</span>
            )}
            {item.published_at && (
              <span className='player-content__date'>
                {dayjs(item.published_at).format('MMM D')}
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
