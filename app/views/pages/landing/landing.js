import React from 'react'
import PropTypes from 'prop-types'
import { NavLink } from 'react-router-dom'

import PageLayout from '@layouts/page'

import {
  league_format,
  league_url,
  questionnaire_path
} from './landing-content'
import {
  league_founding_year,
  league_last_season_count,
  league_season_phrase,
  league_team_count,
  league_this_season_ordinal
} from '@libs-shared/social-sharing.mjs'

import './landing.styl'

const Section = ({ title, children }) => (
  <section className='landing__section'>
    <h2 className='landing__section-title'>{title}</h2>
    {children}
  </section>
)

Section.propTypes = {
  title: PropTypes.string,
  children: PropTypes.node
}

export default function LandingPage() {
  const body = (
    <div className='landing'>
      <header className='landing__hero'>
        <p className='landing__lede'>
          A {league_team_count}-team dynasty league going into{' '}
          {league_season_phrase}. I built the platform it runs on, and
          everything it does is public.
        </p>
        {/* The waitlist is the primary action and the league link is proof,
            so they are not peers: one filled button, one quiet one. */}
        <div className='landing__hero-actions'>
          <NavLink className='landing__cta' to={questionnaire_path}>
            Join the waitlist
          </NavLink>
          <NavLink
            className='landing__cta landing__cta--secondary'
            to={league_url}
          >
            Look at the league
          </NavLink>
        </div>
      </header>

      <Section title='The league'>
        {league_format.map((group) => (
          <div className='landing__group' key={group.title}>
            <h3 className='landing__group-title'>{group.title}</h3>
            <ul className='landing__list'>
              {group.items.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      <section className='landing__section'>
        <div className='landing__trust'>
          <div className='landing__trust-item'>
            <h3>{league_last_season_count} seasons with the same people</h3>
            <p>
              The league has played {league_last_season_count} seasons since{' '}
              {league_founding_year} and is about to play its{' '}
              {league_this_season_ordinal}. Twelve managers hold the{' '}
              {league_team_count} teams, and every one of them has been here
              since the first year. Three people have left in that time, and
              nobody new has been seated since the league was founded.
            </p>
          </div>

          <div className='landing__trust-item'>
            <h3>The rules and every change to them</h3>
            <p>
              The constitution was adopted in 2020. Each amendment is listed
              with the date it was introduced and the date it passed, including
              the ones that were drafted and never ratified.
            </p>
            <NavLink to='/constitution'>Read the constitution</NavLink>
          </div>

          <div className='landing__trust-item'>
            <h3>The schedule is drawn, not set by me</h3>
            <p>
              Which five teams you play twice is decided by the hash of an
              Ethereum block that had not been mined when the draw was
              announced. Nobody can grind the outcome, me included, and anyone
              can run it again and get the same schedule.
            </p>
          </div>

          <div className='landing__trust-item'>
            <h3>The source is public</h3>
            <p>
              I wrote this site for our league and it is open source. The
              transaction rules, the cap math and the scoring are all readable,
              so you can see what the software does with a roster before you
              have one.
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
    </div>
  )

  return <PageLayout body={body} scroll />
}
