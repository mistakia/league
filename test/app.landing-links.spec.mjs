/* global describe it */
import * as chai from 'chai'

import { match_page_route } from '#libs-shared/page-routes.mjs'
import { private_robots } from '#libs-shared/social-sharing.mjs'
import {
  landing_sections,
  primary_action,
  secondary_action
} from '../app/views/pages/landing/landing-content.js'

const expect = chai.expect

// The landing page is the site's front door and its only directory of itself,
// so a dead link here is the one dead link on the site nobody can afford — it
// is the first thing a cold reader clicks. Its copy is curated by hand rather
// than projected from page-routes.mjs (that table's descriptions are search
// snippets and read as boilerplate stacked twelve deep), and this gate is what
// that hand-curation costs: every destination is resolved against the real
// route table.
//
// The SECOND check is the less obvious one. A route carrying private_robots is
// deliberately kept out of a search index — /waitlist is the standing example,
// because the league does not advertise that a seat is open — and listing one
// in a public directory of the site would undo that decision from the other
// side, quietly, with nothing in the route table changing.
//
// Reads the content module's EXPORTED VALUES rather than scanning its source,
// so a link written in an unexpected shape cannot slip past a regex.

const internal_destinations = () => {
  const destinations = []
  if (primary_action.to) {
    destinations.push({ label: primary_action.label, to: primary_action.to })
  }
  if (secondary_action.to) {
    destinations.push({
      label: secondary_action.label,
      to: secondary_action.to
    })
  }
  for (const section of landing_sections) {
    for (const link of section.links) {
      if (link.to) destinations.push({ label: link.label, to: link.to })
    }
  }
  return destinations
}

describe('APP landing links', function () {
  it('reads a non-trivial set of destinations', function () {
    // A scan that collects nothing passes every assertion below it. This is
    // the floor that stops a restructured content module from turning the
    // whole gate into a vacuous green.
    expect(internal_destinations().length).to.be.greaterThan(5)
  })

  it('points every internal link at a route that exists', function () {
    const unresolved = internal_destinations()
      .filter((destination) => !match_page_route(destination.to))
      .map((destination) => `${destination.label} -> ${destination.to}`)
    expect(
      unresolved,
      'landing links matching no entry in page-routes.mjs'
    ).to.deep.equal([])
  })

  it('lists no route that is kept out of a search index', function () {
    const private_links = internal_destinations()
      .filter((destination) => {
        const match = match_page_route(destination.to)
        return match && match.route.robots === private_robots
      })
      .map((destination) => `${destination.label} -> ${destination.to}`)
    expect(
      private_links,
      'landing links naming a private_robots route'
    ).to.deep.equal([])
  })

  it('gives every entry a label and a description', function () {
    for (const section of landing_sections) {
      expect(section.title, 'section title').to.be.a('string').and.not.empty
      expect(section.blurb, `${section.title} blurb`).to.be.a('string').and.not
        .empty
      for (const link of section.links) {
        expect(link.label, `${section.title} link label`).to.be.a('string').and
          .not.empty
        expect(link.description, `${link.label} description`).to.be.a('string')
          .and.not.empty
      }
    }
  })

  it('marks an entry with no destination rather than leaving it bare', function () {
    // An entry with neither `to` nor `href` renders as plain text, which is
    // correct for a capability that is not built yet and indistinguishable
    // from a link whose target was dropped by accident. The note is what tells
    // the reader which one he is looking at.
    for (const section of landing_sections) {
      for (const link of section.links) {
        if (link.to || link.href) continue
        expect(
          link.note,
          `${link.label} has no destination and no note`
        ).to.be.a('string').and.not.empty
      }
    }
  })

  it('negative control: the resolver rejects a path no route matches', function () {
    expect(match_page_route('/not-a-real-route-xyz')).to.equal(null)
  })

  it('negative control: the private-route check sees a known private route', function () {
    const match = match_page_route('/waitlist')
    expect(match, '/waitlist must resolve').to.not.equal(null)
    expect(match.route.robots).to.equal(private_robots)
  })
})
