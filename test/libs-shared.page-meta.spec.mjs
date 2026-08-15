/* global describe it */
import * as chai from 'chai'

import { match_page_route, page_routes } from '#libs-shared/page-routes.mjs'
import {
  clear_placeholders,
  page_meta_league_id,
  render_template,
  resolve_page_meta,
  sanitize_meta_text
} from '#libs-shared/page-meta.mjs'
import {
  indexable_robots,
  private_robots,
  site_name
} from '#libs-shared/social-sharing.mjs'

const expect = chai.expect
const origin = 'https://xo.football'

describe('LIBS-SHARED page meta', function () {
  describe('match_page_route', function () {
    it('matches the home path', function () {
      const match = match_page_route('/')
      expect(match).to.exist
      expect(match.route.pattern).to.equal('/')
    })

    it('prefers an exact pattern over a param pattern', function () {
      expect(match_page_route('/data-views').route.pattern).to.equal(
        '/data-views'
      )
      expect(match_page_route('/data-views/abc123').route.pattern).to.equal(
        '/data-views/:view_id'
      )
    })

    it('extracts params', function () {
      const match = match_page_route('/leagues/1/standings')
      expect(match.route.pattern).to.equal('/leagues/:lid/standings')
      expect(match.params.lid).to.equal('1')
    })

    it('strips query strings and fragments', function () {
      const match = match_page_route('/leagues/1/teams/4?year=2026#roster')
      expect(match.route.pattern).to.equal('/leagues/:lid/teams/:tid')
      expect(match.params.tid).to.equal('4')
    })

    it('matches a wildcard tail at any depth', function () {
      const match = match_page_route('/leagues/1/matchups/2026/5/12')
      expect(match.route.pattern).to.equal('/leagues/:lid/matchups/*')
      expect(match.params.lid).to.equal('1')
    })

    it('does not match a longer path against a shorter pattern', function () {
      expect(match_page_route('/data-views/abc/extra')).to.equal(null)
    })

    it('returns null for an unknown path', function () {
      expect(match_page_route('/no-such-page')).to.equal(null)
    })
  })

  describe('resolve_page_meta', function () {
    it('fills every template key for every declared route', function () {
      const required_keys = [
        'PAGE_TITLE',
        'META_DESCRIPTION',
        'META_ROBOTS',
        'CANONICAL_URL',
        'OG_TITLE',
        'OG_DESCRIPTION',
        'OG_TYPE',
        'OG_URL',
        'OG_IMAGE',
        'OG_IMAGE_ALT',
        'SITE_NAME',
        'TWITTER_CARD',
        'TWITTER_TITLE',
        'TWITTER_DESCRIPTION',
        'TWITTER_IMAGE'
      ]

      for (const route of page_routes) {
        // Substitute something plausible for each param so the pattern resolves.
        const url_path = route.pattern
          .replace(/:[a-z_]+/g, '1')
          .replace(/\*/g, 'x')
        const meta = resolve_page_meta({ url_path, origin })

        for (const key of required_keys) {
          expect(meta[key], `${route.pattern} -> ${key}`).to.be.a('string')
          expect(meta[key], `${route.pattern} -> ${key}`).to.not.equal('')
        }
      }
    })

    it('appends the site name once', function () {
      expect(
        resolve_page_meta({ url_path: '/plays', origin }).PAGE_TITLE
      ).to.equal(`Plays - ${site_name}`)
      // The home title already names the site and must not gain a second copy.
      const home_title = resolve_page_meta({ url_path: '/', origin }).PAGE_TITLE
      expect(home_title.match(new RegExp(site_name, 'g')).length).to.equal(1)
    })

    it('marks an unknown path noindex rather than serving home copy as canonical', function () {
      const meta = resolve_page_meta({ url_path: '/nope', origin })
      expect(meta.META_ROBOTS).to.equal(private_robots)
      expect(meta.CANONICAL_URL).to.equal('https://xo.football/nope')
    })

    it('keeps authenticated routes out of an index and public ones in', function () {
      expect(
        resolve_page_meta({ url_path: '/login', origin }).META_ROBOTS
      ).to.equal(private_robots)
      expect(
        resolve_page_meta({ url_path: '/lineups', origin }).META_ROBOTS
      ).to.equal(private_robots)
      expect(
        resolve_page_meta({ url_path: '/constitution', origin }).META_ROBOTS
      ).to.equal(indexable_robots)
    })

    it('honors a fixed canonical for a route that redirects', function () {
      const meta = resolve_page_meta({ url_path: '/about', origin })
      expect(meta.CANONICAL_URL).to.equal('https://xo.football/')
    })

    it('names the league when one is supplied', function () {
      const meta = resolve_page_meta({
        url_path: '/leagues/1/standings',
        origin,
        league_name: 'GENESIS LEAGUE'
      })
      expect(meta.PAGE_TITLE).to.equal(
        `Standings - GENESIS LEAGUE - ${site_name}`
      )
      expect(meta.OG_TITLE).to.equal(meta.PAGE_TITLE)
    })

    it('uses the league name alone for the league home', function () {
      const meta = resolve_page_meta({
        url_path: '/leagues/1',
        origin,
        league_name: 'GENESIS LEAGUE'
      })
      expect(meta.PAGE_TITLE).to.equal(`GENESIS LEAGUE - ${site_name}`)
    })

    it('falls back to the static title when no league name resolves', function () {
      const meta = resolve_page_meta({
        url_path: '/leagues/1/standings',
        origin
      })
      expect(meta.PAGE_TITLE).to.equal(`Standings - ${site_name}`)
    })

    it('reports which league a path depends on', function () {
      expect(page_meta_league_id('/leagues/7/rosters')).to.equal('7')
      expect(page_meta_league_id('/plays')).to.equal(null)
    })
  })

  describe('sanitize_meta_text', function () {
    it('escapes what would close an attribute', function () {
      expect(sanitize_meta_text('a "quoted" <b>name</b> & co')).to.equal(
        'a &quot;quoted&quot; name &amp; co'
      )
    })

    it('truncates past the limit', function () {
      const value = sanitize_meta_text('x'.repeat(300))
      expect(value.length).to.equal(200)
      expect(value.endsWith('...')).to.equal(true)
    })
  })

  describe('render_template', function () {
    it('replaces every occurrence of a placeholder', function () {
      const template =
        '<title>{{PAGE_TITLE}}</title><meta content="{{PAGE_TITLE}}">'
      expect(render_template(template, { PAGE_TITLE: 'Plays' })).to.equal(
        '<title>Plays</title><meta content="Plays">'
      )
    })

    it('treats a replacement dollar sequence as a literal', function () {
      // `$&` in a title would otherwise expand to the matched placeholder.
      const rendered = render_template('<title>{{PAGE_TITLE}}</title>', {
        PAGE_TITLE: 'A $& B'
      })
      expect(rendered).to.equal('<title>A $& B</title>')
    })

    it('leaves no placeholder behind when the whole dict is applied', function () {
      const meta = resolve_page_meta({ url_path: '/constitution', origin })
      const template = Object.keys(meta)
        .map((key) => `<meta content="{{${key}}}">`)
        .join('')
      expect(render_template(template, meta)).to.not.match(/\{\{[A-Z_]+\}\}/)
    })

    it('empties an unfilled placeholder rather than showing it', function () {
      expect(clear_placeholders('<title>{{PAGE_TITLE}}</title>')).to.equal(
        '<title></title>'
      )
    })
  })
})
