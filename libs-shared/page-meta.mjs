import {
  absolute_url,
  default_description,
  default_image_alt,
  default_image_path,
  default_title,
  format_page_title,
  league_surface_image_alt,
  league_surface_image_path,
  private_robots,
  site_name,
  twitter_card_type
} from './social-sharing.mjs'
import {
  match_page_route,
  route_og_type,
  route_robots
} from './page-routes.mjs'

const max_title_length = 120
const max_description_length = 200

// Meta values land inside HTML attributes, so anything that could close one has
// to go. Markdown link syntax is stripped rather than escaped because these are
// prose, not documents.
export const sanitize_meta_text = (
  text,
  max_length = max_description_length
) => {
  if (!text) return ''

  let value = String(text)
    .replace(/<[^>]*>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

  if (value.length > max_length) {
    value = `${value.slice(0, max_length - 3).trimEnd()}...`
  }

  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// The flat dict both renderers work from. Every key is always present — a
// missing one renders as an empty attribute rather than falling back, which is
// how a page ends up with a blank title.
const build_meta_data = ({
  title,
  description,
  robots,
  og_type,
  canonical_url,
  origin,
  image = default_image_path,
  image_alt = default_image_alt
}) => {
  const page_title = sanitize_meta_text(
    format_page_title(title),
    max_title_length
  )
  const page_description = sanitize_meta_text(description)
  const image_url = absolute_url(origin, image)

  return {
    PAGE_TITLE: page_title,
    META_DESCRIPTION: page_description,
    META_ROBOTS: robots,
    CANONICAL_URL: canonical_url,
    OG_TITLE: page_title,
    OG_DESCRIPTION: page_description,
    OG_TYPE: og_type,
    OG_URL: canonical_url,
    OG_IMAGE: image_url,
    OG_IMAGE_ALT: sanitize_meta_text(image_alt),
    SITE_NAME: site_name,
    TWITTER_CARD: twitter_card_type,
    TWITTER_TITLE: page_title,
    TWITTER_DESCRIPTION: page_description,
    TWITTER_IMAGE: image_url
  }
}

// Resolves a path to its meta dict. `league_name` is optional and supplied by
// whichever side can resolve it — the API from the database, the SPA from the
// redux store — so the two produce the same title for the same page.
//
// An unmatched path gets the site defaults and is marked noindex: it is either
// a typo or a route the table has not been told about, and neither belongs in
// a search index under the home page's copy.
export const resolve_page_meta = ({ url_path, origin, league_name }) => {
  const path_only = (url_path || '/').split(/[?#]/)[0] || '/'
  const match = match_page_route(url_path)

  if (!match) {
    return build_meta_data({
      title: default_title,
      description: default_description,
      robots: private_robots,
      og_type: 'website',
      canonical_url: absolute_url(origin, path_only),
      origin
    })
  }

  const { route, params } = match

  let title = route.title
  if (params.lid && league_name) {
    title =
      route.pattern === '/leagues/:lid'
        ? league_name
        : `${route.title} - ${league_name}`
  }

  // The league family shares one card — the shape of a front office rather than
  // any league's real numbers — so any route that resolves a league gets it
  // unless the route carries its own.
  let image = route.og_image
  let image_alt = route.og_image_alt
  if (params.lid && !image) {
    image = league_surface_image_path
    image_alt = league_surface_image_alt
  }

  return build_meta_data({
    title,
    description: route.description,
    robots: route_robots(route),
    og_type: route_og_type(route),
    canonical_url: absolute_url(origin, route.canonical_path || path_only),
    origin,
    image,
    image_alt
  })
}

// True when the path's title depends on a league name the caller must resolve.
export const page_meta_league_id = (url_path) => {
  const match = match_page_route(url_path)
  return match && match.params.lid ? match.params.lid : null
}

const placeholder_pattern = (key) => new RegExp(`\\{\\{${key}\\}\\}`, 'g')

// Fills the `{{KEY}}` tokens the built index.html carries. Lives here rather
// than beside the middleware so it can be specced without pulling in the
// database module.
export const render_template = (template, meta_data) => {
  let rendered = template

  for (const [key, value] of Object.entries(meta_data)) {
    // The function form of replace keeps `$&` and friends in a title literal
    // rather than treating them as replacement patterns.
    rendered = rendered.replace(placeholder_pattern(key), () => value || '')
  }

  return rendered
}

// Empties any placeholder left unfilled. A half-substituted head is worse than
// an empty one — a visitor would see `{{PAGE_TITLE}}` in their tab.
export const clear_placeholders = (template) =>
  template.replace(/\{\{[A-Z_]+\}\}/g, '')
