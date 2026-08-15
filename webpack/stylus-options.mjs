import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import nib from 'nib'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ONE DEFINITION, because the base and production configs BOTH carry a
// stylus-loader rule and the production one wins for a real build.
//
// They were separate lists until 2026-08-15, and the failure that cost is worth
// stating: app/styles/prose-form.styl was added to the base list alone, so the
// production build never imported it and every call to one of its mixins
// expanded to NOTHING. Stylus does not raise on an unknown mixin — it silently
// emits no declarations for it — so the build succeeded, the CSS chunk shipped,
// and the only symptom was three pages rendering with most of their styling
// missing. The deployed rule for the questionnaire's checkbox read
// `{margin:2px 0 0}` and nothing else, which is a 0x0 invisible control: the
// exact defect the mixin exists to prevent, reintroduced by the refactor that
// prevented it.
//
// Anything added here must be mixins and variables only. These files are
// injected into EVERY stylesheet in the app, so a bare rule is emitted once per
// stylesheet.
export const stylus_options = {
  use: [nib()],
  import: [
    'nib',
    path.resolve(__dirname, '../app/styles/variables.styl'),
    // Must follow variables.styl, which it references.
    path.resolve(__dirname, '../app/styles/prose-form.styl')
  ]
}

export default stylus_options
