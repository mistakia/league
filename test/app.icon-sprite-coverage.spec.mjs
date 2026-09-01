/* global describe it */
import * as chai from 'chai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app_dir = path.join(__dirname, '../app')
const index_html = path.join(__dirname, '../app/index.html')

chai.should()

// `<Icon name='x' />` renders `<use xlinkHref="#icon-x" />` against the inline
// sprite at the top of app/index.html. A NAME WITH NO SYMBOL RENDERS NOTHING:
// `<use>` pointing at an absent id is not an error in any browser, so a typo is
// an invisible control rather than a crash, and it looks identical to an icon
// the design simply does not show in that state.
//
// The match anchors on the icon ELEMENT rather than on a bare `name=`
// attribute, and that is the whole difficulty of this scan. A pattern for
// `name='...'` alone also matches an input's name attribute in pages/auth, and
// during the conversion off @mui/icons-material it reported three sprite
// symbols missing that were never icons at all. Anchoring on the syntactic role
// rather than on the token is what makes the count mean something.
//
// The props portion excludes `<` and `>` rather than just `>`, which is load
// bearing for the same reason. With `[^>]*?` and the dotall flag a match runs
// from an opening tag in one place to a `name=` attribute belonging to a
// DIFFERENT element further down the file — this spec's first run reported
// `icon-username` out of the prose above, having crossed an intervening
// element to reach it. Excluding the bracket confines a match to one tag.
// No dotall flag is needed: a negated character class already spans newlines,
// so a multi-line element still matches.

const icon_element_re =
  /<Icon\b[^<>]*?\sname=(?:'([a-z0-9-]+)'|"([a-z0-9-]+)")/g
const symbol_re = /<symbol\s+id="icon-([a-z0-9-]+)"/g

const collect_js_files = (dir) => {
  const found = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) found.push(...collect_js_files(full))
    else if (entry.name.endsWith('.js')) found.push(full)
  }
  return found
}

const read_sprite_ids = (html) =>
  new Set([...html.matchAll(symbol_re)].map((m) => m[1]))

const find_uncovered_names = (files, sprite_ids) => {
  const offenders = []
  let reference_count = 0

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8')
    for (const match of source.matchAll(icon_element_re)) {
      const name = match[1] || match[2]
      reference_count += 1
      if (!sprite_ids.has(name)) {
        offenders.push(`${path.relative(app_dir, file)}: icon-${name}`)
      }
    }
  }

  return { offenders, reference_count }
}

describe('app icon sprite coverage', function () {
  const html = fs.readFileSync(index_html, 'utf8')
  const sprite_ids = read_sprite_ids(html)
  const files = collect_js_files(app_dir)

  it('has a sprite symbol for every icon the app renders', () => {
    const { offenders, reference_count } = find_uncovered_names(
      files,
      sprite_ids
    )

    // A scan that matched nothing would pass this spec while proving nothing,
    // which is the failure mode it exists to prevent. Require that both sides
    // actually found something before trusting the comparison.
    reference_count.should.be.greaterThan(
      0,
      'found no <Icon> call sites at all — the scan is broken, not the app'
    )
    sprite_ids.size.should.be.greaterThan(
      0,
      'found no <symbol> ids at all — the scan is broken, not the sprite'
    )

    offenders.should.deep.equal([])
  })

  it('reports a name the sprite does not carry', () => {
    // The negative control. Without it, a pattern that can never match returns
    // a confident empty list and reads as a clean result.
    const { offenders } = find_uncovered_names(
      [path.join(__dirname, 'fixtures/icon-missing-symbol.js')],
      sprite_ids
    )

    offenders.should.have.lengthOf(1)
    offenders[0].should.contain('icon-not-a-real-glyph')
  })

  it('does not mistake a non-Icon name attribute for an icon', () => {
    // `<input name='username'>` is the shape that made a looser version of this
    // scan report three icons that do not exist.
    const { offenders, reference_count } = find_uncovered_names(
      [path.join(__dirname, 'fixtures/icon-adjacent-name-attribute.js')],
      sprite_ids
    )

    reference_count.should.equal(0)
    offenders.should.deep.equal([])
  })
})
