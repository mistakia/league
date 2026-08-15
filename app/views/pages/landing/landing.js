import React from 'react'
import PropTypes from 'prop-types'
import { NavLink } from 'react-router-dom'

import PageLayout from '@layouts/page'

import { league_format, league_url, questionnaire_url } from './landing-content'

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

// Renders nothing until there is a vetting questionnaire to send someone to.
const CallToAction = () =>
  questionnaire_url ? (
    <a
      className='landing__cta'
      href={questionnaire_url}
      target='_blank'
      rel='noopener noreferrer'
    >
      Answer a few questions about your league history
    </a>
  ) : null

export default function LandingPage() {
  const body = (
    <div className='landing'>
      <header className='landing__hero'>
        <h1>I run a ten-team dynasty league. One seat is open for 2026.</h1>
        <p className='landing__lede'>
          I also built the platform it plays on. Everything I would want to
          check before joining a stranger&apos;s league is public here — the
          rules, the record of every time we changed them, and the league
          itself.
        </p>
        <div className='landing__hero-actions'>
          <CallToAction />
          <NavLink className='landing__secondary-action' to={league_url}>
            Look at the league
          </NavLink>
        </div>
      </header>

      <Section title='The league'>
        <ul className='landing__list'>
          {league_format.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
        <p>
          Rosters, standings, transactions and every team&apos;s history are
          readable without an account, so none of this has to be taken on trust.{' '}
          <NavLink to={league_url}>Go and look.</NavLink>
        </p>
      </Section>

      <Section title='How the season ends'>
        <p>
          The postseason is scored rather than bracketed, which is the part
          worth reading twice. Fourteen weeks of regular season decide six
          places.
        </p>
        <p>
          The two teams with the best all-play win percentage — how you would
          have done against every team every week, not just the one you were
          scheduled against — skip the first round outright. Four more play the
          wildcard in Week 15: the next two by head-to-head record, then the
          highest scorers among whoever is left. That round is a single week,
          and the two highest scoring of those four advance.
        </p>
        <p>
          The championship runs Weeks 16 and 17. Four teams — the two that
          skipped the wildcard and the two that won through it — and the highest
          combined score across both weeks is the champion. Nobody is knocked
          out by a single bad Sunday against one opponent.
        </p>
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
            <h3>Anything decided at random is committed to beforehand</h3>
            <p>
              When the league settles something by chance, it is settled against
              a future Ethereum block. The target block height is announced
              before that block exists and the result is derived from its
              finalized hash, so I cannot pick the outcome and anyone can
              re-check it afterwards.
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
        </div>
      </Section>

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
