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

const view_name_schema = {
  $$root: true,
  type: 'string',
  min: 1,
  max: 30
}
export const view_name_validator = v.compile(view_name_schema)

const view_description_schema = {
  $$root: true,
  type: 'string',
  min: 1,
  max: 400
}
export const view_description_validator = v.compile(view_description_schema)

const sort_schema = {
  type: 'array',
  items: {
    type: 'object',
    props: {
      column_id: { type: 'string' },
      desc: { type: 'boolean' }
    }
  },
  $$root: true,
  optional: true
}
export const sort_validator = v.compile(sort_schema)

const columns_schema = {
  type: 'array',
  items: [
    {
      type: 'object',
      props: {
        column_id: { type: 'string' },
        params: { type: 'object', optional: true }
      }
    },
    {
      type: 'string'
    }
  ]
}
export const columns_validator = v.compile(columns_schema)

const where_operator_schema = {
  type: 'string',
  enum: [
    '=',
    '!=',
    '>',
    '>=',
    '<',
    '<=',
    'ILIKE',
    'NOT ILIKE',
    'LIKE',
    'NOT LIKE',
    'IS NULL',
    'IS NOT NULL',
    'IN',
    'NOT IN'
  ]
}

const where_schema = {
  type: 'array',
  items: {
    type: 'object',
    props: {
      column_id: { type: 'string' },
      operator: where_operator_schema,
      value: [
        {
          type: 'string',
          pattern:
            '^(?!.*(?:DELETE|DROP|TRUNCATE|ALTER|UPDATE|INSERT|MERGE|EXEC|;|--|\'|"|=|<|>)).*$',
          min: 0,
          max: 50,
          match: /^[a-zA-Z0-9.]+$/
        },
        { type: 'number' },
        {
          type: 'array',
          items: {
            type: 'string',
            pattern:
              '^(?!.*(?:DELETE|DROP|TRUNCATE|ALTER|UPDATE|INSERT|MERGE|EXEC|;|--|\'|"|=|<|>)).*$',
            min: 0,
            max: 50,
            match: /^[a-zA-Z0-9.]+$/
          }
        },
        { type: 'array', items: { type: 'number' } }
      ],
      params: { type: 'object', optional: true }
    }
  },
  $$root: true,
  optional: true
}

export const where_validator = v.compile(where_schema)

const offset_schema = {
  type: 'number',
  min: 0,
  optional: true,
  integer: true,
  $$root: true
}
export const offset_validator = v.compile(offset_schema)

const splits_schema = {
  type: 'array',
  items: {
    type: 'string'
  },
  $$root: true,
  optional: true
}

const table_state_schema = {
  offset: offset_schema,
  sort: sort_schema,
  columns: columns_schema,
  where: where_schema,
  splits: splits_schema
}
export const table_state_validator = v.compile(table_state_schema)

const short_url_schema = {
  type: 'string',
  format: 'url',
  minLength: 1,
  maxLength: 40480,
  $$root: true
}

export const short_url_validator = v.compile(short_url_schema)

const username_schema = {
  username: {
    type: 'string',
    min: 3,
    max: 20,
    pattern: /^[a-zA-Z0-9_]+$/,
    messages: {
      stringPattern:
        "The '{field}' field must contain only alphanumeric characters and underscores"
    }
  }
}

export const username_validator = v.compile(username_schema)

const email_schema = {
  email: {
    type: 'string',
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    messages: {
      stringPattern: 'Invalid email address'
    }
  }
}

export const email_validator = v.compile(email_schema)
