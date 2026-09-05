import React from 'react'
import PropTypes from 'prop-types'
import { NavLink } from 'react-router-dom'

import PageLayout from '@layouts/page'

import RouteDiagram from './route-diagram'
import {
  hero_deck,
  landing_sections,
  primary_action,
  secondary_action
} from './landing-content'
import { site_name } from '#libs-shared/social-sharing.mjs'

import './landing.styl'

// One row of the site graph. An entry with no `to` and no `href` is a
// destination that does not exist yet — it renders as plain text carrying its
// note, rather than as a link to nowhere. That is the only shape difference on
// the page, and it is the honest one.
const SectionLink = ({ label, description, to, href, note }) => {
  const label_content = to ? (
    <NavLink to={to}>{label}</NavLink>
  ) : href ? (
    <a href={href} target='_blank' rel='noopener noreferrer'>
      {label}
    </a>
  ) : (
    <span className='landing__link-label--inert'>{label}</span>
  )

  return (
    <li className='landing__link'>
      <p className='landing__link-label'>
        {label_content}
        {note && <span className='landing__link-note'>{note}</span>}
      </p>
      <p className='landing__link-description'>{description}</p>
    </li>
  )
}

SectionLink.propTypes = {
  label: PropTypes.string,
  description: PropTypes.string,
  to: PropTypes.string,
  href: PropTypes.string,
  note: PropTypes.string
}

const Section = ({ title, blurb, links }) => (
  <section className='landing__section'>
    {/* The heading and its blurb share one rail row, so the heading sits in
        the label column above the entry labels and the blurb sits in the prose
        column above their descriptions — the section head is then the first
        row of the same worksheet rather than a caption floating over it. */}
    <div className='landing__section-head'>
      <h2 className='landing__section-title'>{title}</h2>
      <p className='landing__section-blurb'>{blurb}</p>
    </div>
    <ul className='landing__links'>
      {links.map((link) => (
        <SectionLink key={link.label} {...link} />
      ))}
    </ul>
  </section>
)

Section.propTypes = {
  title: PropTypes.string,
  blurb: PropTypes.string,
  links: PropTypes.array
}

export default function LandingPage() {
  const body = (
    <div className='landing-surface'>
      <div className='landing'>
        <header className='landing__hero'>
          <div className='landing__hero-text'>
            <p className='landing__eyebrow'>{site_name}</p>
            {/* What this is, in the register of a masthead rather than a pitch.
              The reader arriving cold is deciding whether the site is worth
              his afternoon; a slogan argues that and a plain declaration
              demonstrates it. */}
            <h1 className='landing__lede'>
              an open-source fantasy football platform.
            </h1>
            {/* NOT `site_tagline`, deliberately. That sentence is written to
              stand alone — it is the meta description, the README's opening
              line and the GitHub repo description — so it names the platform
              in its first clause, which under this h1 is the headline said
              twice. It keeps all three of those jobs; the deck says what the
              headline cannot. */}
            <p className='landing__deck'>{hero_deck}</p>
            {/* Text links, not buttons. A filled button is a conversion
              affordance and this page is not selling anything — the two
              destinations here are the first two entries of the directory
              below, promoted to the top for a reader who does not want to
              read the rest. */}
            <p className='landing__hero-links'>
              <NavLink to={primary_action.to}>{primary_action.label}</NavLink>
              <a
                href={secondary_action.href}
                target='_blank'
                rel='noopener noreferrer'
              >
                {secondary_action.label}
              </a>
            </p>
          </div>
          {/* Beside the text, not under it. AFTER it in the DOM so a screen
              reader and a phone both reach the copy first — the phone layout
              puts the mark above with column-reverse rather than by moving it
              here. */}
          <RouteDiagram />
        </header>

        {landing_sections.map((section) => (
          <Section key={section.title} {...section} />
        ))}

        {/* The bottom edge, and nothing else. The page ended on its last
            description with no rule under it, so the directory ran out rather
            than finishing — the Genesis page closes on the masthead's own
            weight and this one did not. It carries no copy on purpose: a
            footer of links here would repeat the directory it closes. */}
        <div className='landing__end' aria-hidden='true' />
      </div>
    </div>
  )

  return <PageLayout body={body} scroll />
}
