// Barrel for the context-doc generators and their shared markdown helpers. A
// small set of known doc types, imported directly by the routes — no dispatch
// registry. `generate_league_rosters_csv` renders the machine-readable sibling
// of the rosters page from the same loader.

export { default as generate_docs_index } from './generate-docs-index.mjs'
export { default as generate_league_context } from './generate-league-context.mjs'
export { default as generate_league_rules } from './generate-league-rules.mjs'
export { default as generate_league_schedule } from './generate-league-schedule.mjs'
export { default as generate_league_rosters } from './generate-league-rosters.mjs'
export { default as generate_league_rosters_csv } from './generate-league-rosters-csv.mjs'
export { default as generate_team_context } from './generate-team-context.mjs'

export { ContextDocError } from './errors.mjs'

export {
  build_frontmatter,
  heading,
  section,
  markdown_table,
  cross_link_footer,
  format_date_et,
  doc_url
} from './markdown.mjs'
