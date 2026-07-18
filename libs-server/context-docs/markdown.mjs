import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import yaml from 'js-yaml'

dayjs.extend(utc)
dayjs.extend(timezone)

// Shared markdown primitives for the context-doc generators. Every doc is
// assembled from these so structure, frontmatter, anchors, and date formatting
// stay consistent across the league/rules/schedule/team docs.

export const EASTERN_TIMEZONE = 'America/New_York'

/**
 * Render a date-time (unix seconds) in Eastern Time with an explicit `ET`
 * label so an agent reading the doc never has to guess the zone. Returns a
 * placeholder for unset/invalid values rather than `Invalid Date`.
 */
export function format_date_et(unix, { placeholder = 'TBD' } = {}) {
  if (!unix) {
    return placeholder
  }

  const d = dayjs.unix(unix).tz(EASTERN_TIMEZONE)
  if (!d.isValid()) {
    return placeholder
  }

  return `${d.format('YYYY-MM-DD h:mm A')} ET`
}

/**
 * Build the YAML frontmatter block. `type` and `generated_at` are always
 * emitted; `fields` supplies the doc-specific scalars (including
 * `canonical_url`); `related` supplies the fixed relation vocabulary
 * (`parent`, `children`, `related`) of fetchable absolute URLs, and empty
 * relations are omitted.
 */
export function build_frontmatter({ type, fields = {}, related = {} }) {
  const doc = {
    type,
    generated_at: new Date().toISOString(),
    ...fields
  }

  if (related.parent) {
    doc.parent = related.parent
  }
  if (Array.isArray(related.children) && related.children.length) {
    doc.children = related.children
  }
  if (Array.isArray(related.related) && related.related.length) {
    doc.related = related.related
  }

  const body = yaml.dump(doc, { lineWidth: -1, sortKeys: false })
  return `---\n${body}---\n`
}

/**
 * Build a fetchable absolute context-doc URL. An entity is `<path>.md`
 * (`/leagues/1.md`, `/leagues/1/teams/5.md`); a named sub-view of a league is
 * `<path>/<view>.md` (`/leagues/1/rules.md`). Pass `tid` for a team doc, or
 * `view` for a league sub-view; both unset yields the league index.
 */
export function doc_url(base_url, { lid, tid, view } = {}) {
  if (tid !== undefined && tid !== null) {
    return `${base_url}/leagues/${lid}/teams/${tid}.md`
  }
  if (view) {
    return `${base_url}/leagues/${lid}/${view}.md`
  }
  return `${base_url}/leagues/${lid}.md`
}

/**
 * The public constitution (`/constitution.md`) is the Genesis League's authored
 * governance document, not a generated per-league doc. Only its league gets a
 * constitution cross-link; other leagues on the platform have no published
 * constitution.
 */
export const CONSTITUTION_LEAGUE_ID = 1

export function constitution_url(base_url) {
  return `${base_url}/constitution.md`
}

export function heading(level, text) {
  return `${'#'.repeat(level)} ${text}`
}

/**
 * A titled section: `## Title` followed by the body. Body may be a string or
 * an array of blocks (joined with blank lines). Empty bodies still render the
 * heading so the doc's shape is stable.
 */
export function section(title, body, { level = 2 } = {}) {
  const content = Array.isArray(body) ? body.filter(Boolean).join('\n\n') : body
  return `${heading(level, title)}\n\n${content || '_None._'}`
}

function escape_cell(value) {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

/**
 * Render a GitHub-flavored markdown table. `headers` is an array of column
 * labels; `rows` is an array of row arrays. Returns an empty string when there
 * are no rows so callers can substitute an explicit empty-state message.
 */
export function markdown_table(headers, rows) {
  if (!rows || !rows.length) {
    return ''
  }

  const header_line = `| ${headers.map(escape_cell).join(' | ')} |`
  const divider_line = `| ${headers.map(() => '---').join(' | ')} |`
  const body_lines = rows.map(
    (row) => `| ${row.map(escape_cell).join(' | ')} |`
  )

  return [header_line, divider_line, ...body_lines].join('\n')
}

/**
 * A trailing "Related documents" section of markdown links. `links` is an
 * array of `{ label, url }`; falsy entries are skipped.
 */
export function cross_link_footer(links) {
  const items = (links || [])
    .filter((link) => link && link.url)
    .map((link) => `- [${link.label}](${link.url})`)

  if (!items.length) {
    return ''
  }

  return `${heading(2, 'Related documents')}\n\n${items.join('\n')}`
}
