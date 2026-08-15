import React from 'react'
import PropTypes from 'prop-types'
import { NavLink } from 'react-router-dom'

import { DISCORD_URL } from '@core/constants'
import PageLayout from '@layouts/page'

import {
  league_documents,
  league_format,
  manager_expectations,
  questionnaire_url
} from './landing-content'

import './landing.styl'

const contact_url = questionnaire_url || DISCORD_URL
const contact_label = questionnaire_url
  ? 'Answer a few questions about your league history'
  : 'Message me on Discord'

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

const CallToAction = () => (
  <a
    className='landing__cta'
    href={contact_url}
    target='_blank'
    rel='noopener noreferrer'
  >
    {contact_label}
  </a>
)

export default function LandingPage() {
  const published_documents = league_documents.filter((doc) => doc.url)

  const body = (
    <div className='landing'>
      <header className='landing__hero'>
        <h1>I run a ten-team dynasty league. One seat is open for 2026.</h1>
        <p className='landing__lede'>
          I also built the platform it plays on. Everything I would want to
          check before joining a stranger&apos;s league is public here — the
          rules, the record of every time we changed them, and how the league
          settles anything decided at random.
        </p>
        <div className='landing__hero-actions'>
          <CallToAction />
          <NavLink className='landing__secondary-action' to='/data-views'>
            Look around the platform first
          </NavLink>
        </div>
      </header>

      <Section title='The league'>
        <ul className='landing__list'>
          {league_format.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </Section>

      <Section title='Why you can check my work'>
        <div className='landing__trust'>
          <div className='landing__trust-item'>
            <h3>The rules are published, and so is every change to them</h3>
            <p>
              The constitution was adopted in 2020 and has been amended
              thirty-seven times since, by recorded vote. Every amendment is
              listed with the date it was introduced and the date it passed,
              including the two that were drafted and never ratified. Read it
              before you talk to me.
            </p>
            <NavLink to='/constitution'>Read the constitution</NavLink>
          </div>

          <div className='landing__trust-item'>
            <h3>Random draws are committed to before they happen</h3>
            <p>
              Anything the league decides at random — division draws, draft
              order — is settled against a future Ethereum block. I announce the
              target block height before that block exists, then derive the
              result from its finalized hash, so I cannot pick the outcome and
              anyone can re-check it afterwards.
            </p>
          </div>

          <div className='landing__trust-item'>
            <h3>I built the platform, and the source is public</h3>
            <p>
              This site is not a rented league host. I wrote it for our league
              and it is open source, so the transaction rules, the cap math and
              the scoring are all readable rather than something you take my
              word for.
            </p>
            <a
              href='https://github.com/mistakia/league'
              target='_blank'
              rel='noopener noreferrer'
            >
              Read the source on GitHub
            </a>
          </div>

          <div className='landing__trust-item'>
            <h3>Team value is computed, not asserted</h3>
            <p>
              Roster value comes from public market data on a documented method
              and is recomputed nightly, back to the league&apos;s first day.
              That matters if you are taking over an existing roster: you can
              see what you are inheriting and how it got there.
            </p>
          </div>
        </div>
      </Section>

      <Section title='What the platform actually shows'>
        <figure className='landing__figure'>
          <img
            src='/static/images/landing/league-team-value-history.png'
            alt='Chart of team market value across the league from 2020 to 2026'
          />
          <figcaption>
            Every team&apos;s market value since the league started in 2020,
            updated nightly.
          </figcaption>
        </figure>
        <figure className='landing__figure'>
          <img
            src='/static/images/landing/league-positional-value.png'
            alt='Bar chart of projected points by position for each team in the league'
          />
          <figcaption>
            Projected points by position for every roster, including draft
            picks.
          </figcaption>
        </figure>
      </Section>

      <Section title='What I ask of a manager'>
        <ul className='landing__list'>
          {manager_expectations.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
        <p className='landing__note'>
          There are annual dues and a refundable deposit sized to the roster you
          take on, so a rebuilding team costs less to enter than a contender. I
          would rather work through that in a conversation than post numbers at
          a stranger, so nothing about money happens until we have both decided
          we are interested.
        </p>
      </Section>

      {published_documents.length > 0 && (
        <Section title='Read for yourself'>
          <ul className='landing__documents'>
            {published_documents.map((doc) => (
              <li key={doc.title}>
                <NavLink to={doc.url}>{doc.title}</NavLink>
                <span>{doc.description}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <footer className='landing__footer'>
        <p>
          I am not selling anything and there is nothing here to sign up for.
          This is one league with one open seat, and software I wrote for us
          that I am happy for you to poke at.
        </p>
        <CallToAction />
      </footer>
    </div>
  )

  return <PageLayout body={body} scroll />
}
