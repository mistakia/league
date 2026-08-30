/* global describe it */
// Negative controls for the response-validation ratchet.
//
// Every other spec in this suite is an INDIRECT control for it: with the
// validator mounted, a response that stops matching its schema fails whatever
// test produced it. What that cannot show is the ratchet still WORKING -- a
// validator that quietly stops matching requests, or a hold-out that swallows
// everything, both look exactly like a clean tree. These four assert the
// mechanism itself, and they run on every invocation rather than behind a flag.
//
// They build their own express app over a two-operation synthetic spec, so they
// need no database and no fixtures. The synthetic spec deliberately gives ONE
// component schema to TWO operations, because that sharing is the whole reason
// the hold-out is keyed per operation.

import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'
import express from 'express'
import * as OpenApiValidator from 'express-openapi-validator'

import server from '#api'
import {
  is_response_validation_enabled,
  get_response_validation_report
} from '#api/swagger/response-validation.mjs'

const expect = chai.expect
chai.use(chai_http)

const shared_schema = {
  type: 'object',
  required: ['widget_id', 'widget_name'],
  properties: {
    widget_id: { type: 'integer' },
    widget_name: { type: 'string' }
  }
}

const synthetic_spec = {
  openapi: '3.0.0',
  info: { title: 'response validation controls', version: '1.0.0' },
  servers: [{ url: '/api' }],
  components: { schemas: { Widget: shared_schema } },
  paths: {
    '/widgets': {
      get: {
        responses: {
          200: {
            description: 'ok',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Widget' }
                }
              }
            }
          }
        }
      },
      post: {
        responses: {
          200: {
            description: 'ok',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Widget' }
              }
            }
          }
        }
      }
    }
  }
}

// Mirrors api/swagger/response-validation.mjs's wiring, over the synthetic spec
// and an explicit hold-out, so a control can name exactly what it holds out.
const build_app = ({ holdout = [] } = {}) => {
  const held_out = new Set(
    holdout.map((entry) => `${entry.operation} ${entry.status}`)
  )
  const held_hits = []

  const app = express()
  app.use(
    OpenApiValidator.middleware({
      apiSpec: synthetic_spec,
      validateRequests: false,
      validateSecurity: false,
      ignoreUndocumented: true,
      validateResponses: {
        onError: (error, body, req) => {
          const operation = `${req.method.toUpperCase()} ${req.openapi.openApiRoute}`
          const key = `${operation} ${req.res.statusCode}`
          if (!held_out.has(key)) throw error
          held_hits.push(key)
        }
      }
    })
  )

  // Both operations return the SAME defect: `widget_name` is an integer where
  // the shared schema requires a string.
  app.get('/api/widgets', (req, res) => {
    res.status(200).json([{ widget_id: 1, widget_name: 7 }])
  })
  app.post('/api/widgets', (req, res) => {
    res.status(200).json({ widget_id: 1, widget_name: 7 })
  })

  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message })
  })

  return { app, held_hits }
}

describe('response validation ratchet', function () {
  it('goes RED on a response that does not match its schema', async () => {
    const { app } = build_app()
    const response = await chai_request.execute(app).get('/api/widgets')
    expect(response.status).to.equal(500)
    expect(response.body.error).to.include('widget_name')
  })

  it('a hold-out entry swallows its own failure and passes the body through', async () => {
    const { app, held_hits } = build_app({
      holdout: [{ operation: 'GET /api/widgets', status: 200 }]
    })
    const response = await chai_request.execute(app).get('/api/widgets')
    expect(response.status).to.equal(200)
    // The ORIGINAL body, unmodified -- a hold-out must not rewrite a response.
    expect(response.body).to.deep.equal([{ widget_id: 1, widget_name: 7 }])
    expect(held_hits).to.deep.equal(['GET /api/widgets 200'])
  })

  // The `WaiverClaim` trap, reproduced. A route-keyed hold-out would suppress
  // both operations here, since they share one path AND one component schema.
  it('a hold-out on one operation does NOT suppress the other operation sharing its schema', async () => {
    const { app } = build_app({
      holdout: [{ operation: 'GET /api/widgets', status: 200 }]
    })
    const held = await chai_request.execute(app).get('/api/widgets')
    expect(held.status).to.equal(200)

    const not_held = await chai_request.execute(app).post('/api/widgets')
    expect(not_held.status).to.equal(500)
    expect(not_held.body.error).to.include('widget_name')
  })

  // The blindness detector, on the REAL app rather than the synthetic one. If
  // the validator ever stops reaching requests -- a mount-order change, a
  // basePath drift -- nothing is observed, every hold-out entry reads as merely
  // NOT EXERCISED, and the suite goes green with the ratchet dead. Driving one
  // documented route and watching the observed set grow is what separates that
  // from a genuinely clean run, and it does not depend on spec order.
  it('the real app is validating: a documented route registers an observed pair', async () => {
    expect(is_response_validation_enabled()).to.equal(true)
    const before = get_response_validation_report().observed_pair_count
    await chai_request.execute(server).get('/api/sources')
    const after = get_response_validation_report()
    expect(after.observed_pair_count).to.be.greaterThan(0)
    expect(after.observed_pair_count).to.be.at.least(before)

    // The teardown check no longer fails a run that observed zero pairs while
    // serving zero requests, because such a run cannot judge reachability
    // either way -- that is what stopped every single-spec run reporting a
    // spurious failure. The whole skip rests on this counter incrementing
    // independently of whether the validator could place the request, so it
    // gets its own assertion. If it ever stops counting, the teardown falls
    // silent on a genuinely blind FULL run, and the case above is the only
    // thing left holding that.
    expect(
      after.request_count,
      'request_count is the subset-vs-blindness discriminator; at zero the ' +
        'teardown check skips, so a counter that stops counting disables it'
    ).to.be.greaterThan(0)
  })
})
