import { useEffect } from 'react'
import PropTypes from 'prop-types'
import { useLocation } from 'react-router-dom'

import { BASE_URL } from '@core/constants'
import { resolve_page_meta } from '#libs-shared/page-meta.mjs'

// The API fills the `<head>` for the initial page load, which is what a crawler
// reads. This keeps it correct afterwards: client-side navigation never touches
// the server, so without it every route after the first keeps the first one's
// title in the browser tab and in a bookmark.
//
// Both sides call the same resolve_page_meta, so a tab title and a link preview
// cannot disagree about the same path.

const set_meta_content = (selector, value) => {
  const element = document.head.querySelector(selector)
  if (element) element.setAttribute('content', value)
}

const set_link_href = (selector, value) => {
  const element = document.head.querySelector(selector)
  if (element) element.setAttribute('href', value)
}

export const apply_document_meta = (meta_data) => {
  document.title = meta_data.PAGE_TITLE

  set_meta_content('meta[name="description"]', meta_data.META_DESCRIPTION)
  set_meta_content('meta[name="robots"]', meta_data.META_ROBOTS)
  set_link_href('link[rel="canonical"]', meta_data.CANONICAL_URL)

  set_meta_content('meta[property="og:title"]', meta_data.OG_TITLE)
  set_meta_content('meta[property="og:description"]', meta_data.OG_DESCRIPTION)
  set_meta_content('meta[property="og:type"]', meta_data.OG_TYPE)
  set_meta_content('meta[property="og:url"]', meta_data.OG_URL)
  set_meta_content('meta[property="og:image"]', meta_data.OG_IMAGE)
  set_meta_content('meta[property="og:image:alt"]', meta_data.OG_IMAGE_ALT)

  set_meta_content('meta[name="twitter:title"]', meta_data.TWITTER_TITLE)
  // The twitter pair has to move with the og pair. og:image became per-route
  // above, and leaving these behind makes the two describe different images
  // after an in-app navigation — which is the exact drift this module exists
  // to prevent. Note index.html binds twitter:image:alt to OG_IMAGE_ALT.
  set_meta_content('meta[name="twitter:image"]', meta_data.TWITTER_IMAGE)
  set_meta_content('meta[name="twitter:image:alt"]', meta_data.OG_IMAGE_ALT)
  set_meta_content(
    'meta[name="twitter:description"]',
    meta_data.TWITTER_DESCRIPTION
  )
}

export default function PageHead({ league_name }) {
  const location = useLocation()

  useEffect(() => {
    const meta_data = resolve_page_meta({
      url_path: location.pathname,
      origin: BASE_URL,
      league_name
    })
    apply_document_meta(meta_data)
  }, [location.pathname, league_name])

  return null
}

PageHead.propTypes = {
  league_name: PropTypes.string
}
