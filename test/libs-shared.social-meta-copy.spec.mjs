/* global describe it */
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import * as chai from 'chai'

import { page_routes } from '#libs-shared/page-routes.mjs'
import * as waitlist_questions from '#libs-shared/manager-waitlist-questions.mjs'
import {
  default_description,
  default_title,
  private_robots,
  site_tagline
} from '#libs-shared/social-sharing.mjs'

const expect = chai.expect
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..')

// A source-scan gate over the site's descriptive copy. It reads the modules the
// copy lives in rather than executing the app, so it needs no database and no
// harness. Each detection below is proven able to fail by a negative control;
// a green run over a scanner that cannot match is not evidence.

// Tokens that announce a recruiting claim. The operator decided the league
// does not advertise that a seat is open anywhere — default_description used
// to end "One seat is open for 2026.", and the waitlist routes used to say
// "open seat" — so neither the sitewide default copy nor any route's copy or
// card alt may carry one.
const recruiting_tokens = ['one seat', 'open seat', 'seat is open']

export const find_recruiting_token = (text) =>
  recruiting_tokens.find((token) => text.toLowerCase().includes(token))

// A route a crawler will index must carry real copy rather than an empty
// string, so the route table cannot silently grow a bare route.
export const is_indexable_route_with_copy = (route) => {
  if (route.robots === private_robots) return true
  return Boolean(
    route.title &&
      route.title.trim() &&
      route.description &&
      route.description.trim()
  )
}

// A hardcoded season count in landing copy is the staleness bug this whole
// module exists to prevent: the landing derives its counts from the copy
// module, so a literal ordinal or numeral beside "season" means someone wrote
// the count by hand again.
const hardcoded_season_count =
  /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|\d+)\s+seasons?\b/i

describe('LIBS-SHARED social meta copy', function () {
  it('does not advertise a recruiting claim in any copy', function () {
    const copy = [default_description, default_title]
      .concat(
        page_routes.map((route) => [route.description, route.og_image_alt])
      )
      .flat()
      .filter(Boolean)
    for (const text of copy) {
      expect(find_recruiting_token(text), text).to.equal(undefined)
    }
  })

  it('agrees with the README tagline', function () {
    const readme = readFileSync(path.join(repo_root, 'README.md'), 'utf8')
    expect(readme, 'README must embed the site tagline').to.include(
      site_tagline
    )
  })

  it('gives every indexable route real copy', function () {
    const bare = page_routes
      .filter((route) => !is_indexable_route_with_copy(route))
      .map((route) => route.pattern)
    expect(
      bare,
      'indexable routes with empty title or description'
    ).to.deep.equal([])
  })

  it('gives every card a known path and an alt, and neither without the other', function () {
    for (const route of page_routes) {
      expect(
        Boolean(route.og_image),
        `${route.pattern} og_image presence`
      ).to.equal(Boolean(route.og_image_alt))
      if (!route.og_image) continue
      expect(route.og_image, route.pattern).to.match(
        /^\/static\/images\/social\/[a-z-]+\.png$/
      )
      expect(route.og_image_alt.trim(), `${route.pattern} og_image_alt`).to.be
        .ok
    }
  })

  // The questionnaire is the surface a prospective manager actually reads, so
  // it is where a recruiting claim does the most work — and it sat outside this
  // gate until its help text was found still saying "One seat is confirmed
  // open" after every route had been cleaned.
  //
  // Reads the module's EXPORTED VALUES rather than its source. A source scan
  // would have to exclude comments by hand, and a comment is exactly where the
  // policy gets written down — page-routes.mjs already carries "the league does
  // not advertise that a seat is open", which any source scan would report as a
  // violation of itself. Walking the exports also picks up commitment_terms,
  // what_we_look_for and the affirmation label, none of which are label/help
  // keys, so nothing user-facing in the file is out of reach.
  it('does not advertise a recruiting claim in the waitlist questionnaire', function () {
    const collect_strings = (value) => {
      if (typeof value === 'string') return [value]
      if (Array.isArray(value)) return value.flatMap(collect_strings)
      if (value && typeof value === 'object') {
        return Object.values(value).flatMap(collect_strings)
      }
      return []
    }

    const copy = collect_strings(waitlist_questions)
    expect(copy.length, 'no questionnaire copy was read').to.be.greaterThan(20)

    for (const text of copy) {
      expect(find_recruiting_token(text), text).to.equal(undefined)
    }
  })

  it('keeps the landing season count derived rather than hardcoded', function () {
    for (const file of [
      'app/views/pages/landing/landing.js',
      'app/views/pages/landing/landing-content.js'
    ]) {
      const source = readFileSync(path.join(repo_root, file), 'utf8')
      expect(source, `${file} hardcodes a season count`).to.not.match(
        hardcoded_season_count
      )
    }
    const landing = readFileSync(
      path.join(repo_root, 'app/views/pages/landing/landing.js'),
      'utf8'
    )
    expect(landing, 'landing.js must use the shared season phrase').to.include(
      'league_season_phrase'
    )
  })

  it('negative control: the recruiting scanner flags a planted claim', function () {
    expect(find_recruiting_token('One seat is open for 2026.')).to.equal(
      'one seat'
    )
  })

  it('negative control: the route-copy check flags a bare route', function () {
    expect(
      is_indexable_route_with_copy({ title: '', description: 'x' })
    ).to.equal(false)
  })

  it('negative control: the season-count check flags a hardcoded count', function () {
    expect('six seasons since 2020'.match(hardcoded_season_count)).to.be.ok
  })
})
