// Copy and defaults for page metadata. Isomorphic on purpose: the API fills
// the served HTML from these values and the SPA re-applies them on client-side
// navigation, so a tab title and a link preview cannot disagree.

export const site_name = 'xo.football'

export const default_title =
  'xo.football — a dynasty league and the platform it runs on'

export const default_description =
  'A ten-team dynasty league with a published constitution, verifiable random draws, and a custom-built platform. One seat is open for 2026.'

export const default_image_path = '/static/images/landing/social-card.png'

export const default_image_alt =
  'Chart of team market value across the league from 2020 to 2026'

export const twitter_card_type = 'summary_large_image'

export const default_og_type = 'website'

export const indexable_robots = 'index, follow'

// Anything behind a login, anything a crawler cannot render, and anything whose
// content is another page's. Kept as one constant so a route only has to decide
// whether it is public, not remember the spelling.
export const private_robots = 'noindex, nofollow'

// Appends the site name once. Without the guard the home page title, which
// already names the site, would render as "xo.football — ... - xo.football".
export const format_page_title = (title) => {
  if (!title) return default_title
  if (title.includes(site_name)) return title
  return `${title} - ${site_name}`
}

export const absolute_url = (origin, path_or_url) => {
  if (!path_or_url) return origin
  if (path_or_url.startsWith('http://') || path_or_url.startsWith('https://')) {
    return path_or_url
  }
  return `${origin.replace(/\/$/, '')}${path_or_url}`
}
