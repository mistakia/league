import Validator from 'fastest-validator'

import { constants } from '#libs-shared'

const v = new Validator({ haltOnFirstError: true })

const year_schema = {
  type: 'number',
  integer: true,
  positive: true,
  min: 1920,
  max: constants.season.year,
  $$root: true
}

export const year_validator = v.compile(year_schema)

const week_schema = {
  type: 'number',
  integer: true,
  positive: true,
  min: 1,
  max: 30,
  $$root: true
}

export const week_validator = v.compile(week_schema)

const seas_type_schema = {
  type: 'string',
  enum: ['PRE', 'REG', 'POST'],
  $$root: true
}

export const seas_type_validator = v.compile(seas_type_schema)
