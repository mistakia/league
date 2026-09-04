import React from 'react'
import PropTypes from 'prop-types'
import { NavLink } from 'react-router-dom'

import PageLayout from '@layouts/page'

import {
  league_format,
  league_url,
  questionnaire_path
} from './genesis-league-content'
import {
  league_founding_year,
  league_name,
  league_season_phrase,
  site_name
} from '#libs-shared/social-sharing.mjs'

import './genesis-league.styl'

const Section = ({ title, children }) => (
  <section className='genesis-league__section'>
    <h2 className='genesis-league__section-title'>{title}</h2>
    {children}
  </section>
)

Section.propTypes = {
  title: PropTypes.string,
  children: PropTypes.node
}

export default function GenesisLeaguePage() {
  const body = (
    <div className='genesis-league-surface'>
      <div className='genesis-league'>
        <header className='genesis-league__hero'>
          {/* The league has a name and the site has one, and a reader arriving
              cold knows neither. It goes above the sentence rather than inside
              it, so the sentence can stay the argument. */}
          <p className='genesis-league__eyebrow'>
            {league_name} <span aria-hidden='true'>&middot;</span> {site_name}
          </p>
          {/* A statement of what this is, in the register of a masthead rather
              than a pitch. The reader arriving here is deciding whether a
              league is serious; a slogan argues that and a plain declaration
              demonstrates it. The claims that support it come underneath, as
              facts with dates on them. */}
          <h1 className='genesis-league__lede'>the genesis dynasty league</h1>
          {/* The season count is DERIVED, never typed. It goes in the deck
              rather than the headline, which states what this is and stops —
              but a league's age is the first thing that separates a real one
              from a league founded last week, so the page has to say it.
              test/libs-shared.social-meta-copy.spec.mjs asserts both halves:
              that this file reads league_season_phrase, and that no season
              count is hardcoded anywhere in the pitch copy. */}
          <p className='genesis-league__deck'>
            Founded in {league_founding_year}, now in {league_season_phrase}.
            The constitution, the full transaction record and the platform that
            enforces them are public.
          </p>
          {/* Text links rather than buttons. The page's argument is that
              everything it claims is checkable, and a filled call to action
              is the register of something being sold — which is exactly what
              the Footballguys staff sticky excludes. */}
          <p className='genesis-league__hero-links'>
            <NavLink to={questionnaire_path}>Join the waitlist</NavLink>
            <NavLink to={league_url}>Look at the league</NavLink>
          </p>
        </header>

        <Section title='The league'>
          {league_format.map((group) => (
            <div className='genesis-league__group' key={group.title}>
              <h3 className='genesis-league__group-title'>{group.title}</h3>
              <ul className='genesis-league__list'>
                {group.items.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </Section>

        {/* THE SAME OBJECT AS THE SECTION ABOVE — a mono label in the rail and
            prose beside it. These two were full-measure blocks under
            sentence-long mono headings, which put a second measure on the page
            and left the band rule opening onto no section head at all. As rail
            rows their labels join the one column that runs the length of the
            page: FORMAT, OFFSEASON, POSTSEASON, CONSTITUTION, OPEN SOURCE. */}
        <Section title="What's public">
          <div className='genesis-league__group'>
            <h3 className='genesis-league__group-title'>Constitution</h3>
            <div className='genesis-league__group-body'>
              <p>
                Adopted in {league_founding_year}. Every amendment carries the
                date it was introduced and the date it passed, including those
                drafted and never ratified.
              </p>
              <p className='genesis-league__group-link'>
                <NavLink to='/constitution'>Read the constitution</NavLink>
              </p>
            </div>
          </div>

          <div className='genesis-league__group'>
            <h3 className='genesis-league__group-title'>Open source</h3>
            <div className='genesis-league__group-body'>
              <p>
                I wrote this site for this league and its source is public. What
                the software does with a roster can be inspected before you hold
                one.
              </p>
              <p className='genesis-league__group-link'>
                <a
                  href='https://github.com/mistakia/league'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  Read the source on GitHub
                </a>
              </p>
            </div>
          </div>
        </Section>

        {/* The reader who gets this far has read the whole argument, and the
            hero link is now several screens behind him. */}
        <section className='genesis-league__closing'>
          <NavLink to={questionnaire_path}>Join the waitlist</NavLink>
        </section>
      </div>
    </div>
  )

  return <PageLayout body={body} scroll />
}
