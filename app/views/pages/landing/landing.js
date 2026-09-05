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

// The yard number painted beside the section's own ten-yard line. Counting DOWN
// from midfield toward the goal line the page closes on makes reading the
// directory a drive, and it is also what keeps the sequence legal when a
// section is added: the fifth is the 10 rather than a number no field has.
//
// A REAL ELEMENT AND NOT A ::before, because a CSS counter would put the digits
// in generated content, which several screen readers announce — so every
// section head would be read out as a number nobody can act on. Here it carries
// aria-hidden and says nothing.
const yard_line = (index) => 50 - index * 10

const Section = ({ title, blurb, links, yard }) => (
  <section className='landing__section'>
    {/* The heading and its blurb share one rail row, so the heading sits in
        the label column above the entry labels and the blurb sits in the prose
        column above their descriptions — the section head is then the first
        row of the same worksheet rather than a caption floating over it. */}
    <div className='landing__section-head'>
      <h2 className='landing__section-title'>{title}</h2>
      <p className='landing__section-blurb'>{blurb}</p>
    </div>
    <span className='landing__yard' aria-hidden='true'>
      {yard}
    </span>
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
  links: PropTypes.array,
  yard: PropTypes.number
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
          {/* Above the text, and AFTER it in the DOM so a screen reader reaches
              the copy first — the layout puts the mark above with
              column-reverse rather than by moving it here. */}
          <RouteDiagram />
        </header>

        {landing_sections.map((section, index) => (
          <Section key={section.title} {...section} yard={yard_line(index)} />
        ))}

        {/* THE BOTTOM END ZONE. The rule is the second goal line, and what is
            painted below it is what a team paints in its own end zone: its
            name, across the width, in the field's paint face. Until it was
            there the space under the closing rule was just the page's bottom
            padding — the reader could see the directory had ended but nothing
            said the field had.

            Still no footer. This is the site's name, which the masthead
            already carries at the top of the same page, so it repeats a
            wordmark rather than adding one — and a footer of links here would
            repeat the directory it is closing. It is aria-hidden for the same
            reason: the name is already in the heading above, and a screen
            reader reaching it twice learns nothing the second time. */}
        <div className='landing__end' aria-hidden='true'>
          <span className='landing__end-mark'>{site_name}</span>
        </div>
      </div>
    </div>
  )

  return <PageLayout body={body} scroll />
}
