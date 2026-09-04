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
          <h1 className='genesis-league__lede'>a home dynasty league.</h1>
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
          {/* The waitlist is the primary action and the league link is proof,
              so they are not peers: one filled button, one quiet one. */}
          <div className='genesis-league__hero-actions'>
            <NavLink className='genesis-league__cta' to={questionnaire_path}>
              Join the waitlist
            </NavLink>
            <NavLink
              className='genesis-league__cta genesis-league__cta--secondary'
              to={league_url}
            >
              Look at the league
            </NavLink>
          </div>
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

        <section className='genesis-league__section'>
          <div className='genesis-league__trust'>
            <div className='genesis-league__trust-item'>
              <h3>The constitution and every amendment to it</h3>
              <p>
                Adopted in {league_founding_year}. Each amendment is recorded
                with the date it was introduced and the date it passed,
                including those that were drafted and never ratified.
              </p>
              <NavLink to='/constitution'>Read the constitution</NavLink>
            </div>

            <div className='genesis-league__trust-item'>
              <h3>The platform is open source</h3>
              <p>
                I wrote this site for this league and its source is public. The
                transaction rules, the cap arithmetic and the scoring are all
                readable, so what the software does with a roster can be
                inspected before you hold one.
              </p>
              <a
                href='https://github.com/mistakia/league'
                target='_blank'
                rel='noopener noreferrer'
              >
                Read the source on GitHub
              </a>
            </div>
          </div>
        </section>

        {/* The reader who gets this far has read the whole argument, and the
            hero button is now several screens behind him. */}
        <section className='genesis-league__closing'>
          <NavLink className='genesis-league__cta' to={questionnaire_path}>
            Join the waitlist
          </NavLink>
        </section>
      </div>
    </div>
  )

  return <PageLayout body={body} scroll />
}
