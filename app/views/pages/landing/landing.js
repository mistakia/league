import React from 'react'
import PropTypes from 'prop-types'
import { NavLink } from 'react-router-dom'

import PageLayout from '@layouts/page'

import {
  landing_sections,
  primary_action,
  secondary_action
} from './landing-content'
import { site_name, site_tagline } from '#libs-shared/social-sharing.mjs'

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
    <h2 className='landing__section-title'>{title}</h2>
    <p className='landing__section-blurb'>{blurb}</p>
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
          <p className='landing__eyebrow'>{site_name}</p>
          {/* What this is, in the register of a masthead rather than a pitch.
              The reader arriving cold is deciding whether the site is worth
              his afternoon; a slogan argues that and a plain declaration
              demonstrates it. */}
          <h1 className='landing__lede'>
            an open-source fantasy football platform.
          </h1>
          {/* The tagline is the SHARED one, read from the copy module rather
              than typed here. README.md carries the same sentence and
              test/libs-shared.social-meta-copy.spec.mjs holds the two
              together, so the site's own description of itself cannot drift
              from the one on GitHub. */}
          <p className='landing__deck'>{site_tagline}</p>
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
        </header>

        {landing_sections.map((section) => (
          <Section key={section.title} {...section} />
        ))}
      </div>
    </div>
  )

  return <PageLayout body={body} scroll />
}
