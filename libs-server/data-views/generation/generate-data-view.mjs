// The emit contract for a generated `table_state`, and the shape instructions
// that go with it.
//
// League does not call a model. Generation is an agentic container session: the
// harness is the model client and league supplies callable tools — catalog
// search, the strict resolver, row preview, the SQL sandbox. What lives here is
// the half of the retired single-shot design that was never about talking to a
// provider: the schema an emission is validated against, and the param
// spellings the agent needs in order to write one.
//
// WHOLE `table_state`, NOT A PATCH LANGUAGE. The edit case sends the current
// state in and gets a complete one back. A patch language would be a second
// schema to author, validate, version and prompt for, with nothing else in the
// system reusing it, and the undo it would buy already exists in local history.
//
// THE INSTRUCTIONS ARE NOT A TRUST BOUNDARY. They carry repo-derived catalog
// content and the caller's own instruction and table_state — no third-party
// untrusted content — so the caller and the adversary are the same party, and a
// caller who wants to read `users` can simply ask. The boundary is the resolver.
// Prompt-level defenses are deliberately absent. Two residuals to keep in mind
// downstream: the audit table stores raw instruction text, which is a stored-
// injection surface for any future agent that reads it, and LLM-authored labels
// reach the SPA safely only because React escapes by default — nothing on that
// path may use `dangerouslySetInnerHTML`.

import { ROW_AXES } from './resolve-generated-table-state.mjs'

/**
 * The JSON schema an emission is validated against. Structural only: whether the
 * ids inside are real is the resolver's question, and asking the schema to
 * carry a 597-value enum would blow the prompt and still not cover params.
 */
export const generated_table_state_schema = {
  type: 'object',
  // explanation and inexpressible_reason are REQUIRED, not optional, and that
  // is the difference between an audit that measures something and one that
  // records a bare false. Left optional, the model filled neither: three live
  // runs produced two `expressible: false` answers with no reason at all, and
  // the reason is the entire design input the SQL tier is meant to be built
  // from. An empty string is the answer for the field that does not apply.
  required: ['expressible', 'explanation', 'inexpressible_reason'],
  additionalProperties: false,
  properties: {
    expressible: {
      type: 'boolean',
      description:
        'false when the request cannot be expressed with the given columns and params'
    },
    inexpressible_reason: {
      type: 'string',
      description:
        'when expressible is false, what the catalog was missing; otherwise an empty string'
    },
    explanation: {
      type: 'string',
      description: 'one sentence describing the view, shown to the user'
    },
    table_state: {
      type: 'object',
      additionalProperties: false,
      // Measured against the 189 described production views: every one carries
      // row_grain and prefix_columns, and the schema permitted neither, so no
      // generated view could ever have the shape a real one has. `limit` was
      // the mirror defect -- permitted, reached for by the model, and used by
      // zero real views -- so it is gone rather than left as a field whose only
      // effect is to truncate an answer nobody asked to truncate.
      required: ['row_grain', 'prefix_columns', 'columns'],
      properties: {
        // Which entity a row is. Everything else in the view is read against
        // it, so it is not inferable after the fact from the column list.
        row_grain: {
          type: 'array',
          items: { type: 'string', enum: ['player', 'team'] }
        },
        // Identity columns, pinned to the left. Bare column ids, no params.
        prefix_columns: {
          type: 'array',
          items: { type: 'string' }
        },
        columns: {
          type: 'array',
          items: {
            type: 'object',
            required: ['column_id'],
            additionalProperties: false,
            properties: {
              column_id: { type: 'string' },
              params: { type: 'object' }
            }
          }
        },
        where: {
          type: 'array',
          items: {
            type: 'object',
            required: ['column_id', 'operator'],
            additionalProperties: false,
            properties: {
              column_id: { type: 'string' },
              operator: { type: 'string' },
              value: {},
              params: { type: 'object' }
            }
          }
        },
        sort: {
          type: 'array',
          items: {
            type: 'object',
            required: ['column_id'],
            additionalProperties: false,
            properties: {
              column_id: { type: 'string' },
              desc: { type: 'boolean' },
              params: { type: 'object' }
            }
          }
        },
        row_axes: {
          type: 'array',
          items: { type: 'string', enum: ROW_AXES }
        }
      }
    }
  }
}

// The shape half of the instructions, and it was the missing half.
//
// A catalog teaches WHICH ids exist and nothing about how a table_state is
// spelled, so the model was emitting bare column lists: across a whole scored
// run it produced no `where` clause at all and left `params` empty on nearly
// every column, against a corpus where 188 of 189 human views filter and every
// one of them parameterises. It also invented param value shapes wholesale --
// `{"type":"TEMPLATED","value":"last_n_years","args":{"n":5}}` where the real
// spelling is a one-element array carrying a `dynamic_type`.
//
// The example is synthetic on purpose. Real saved views are the user's own
// content and this repository is public, so the demonstration is authored here
// from real column ids and the measured param spellings rather than lifted from
// the corpus. Counts below are from the 189 described production views.
export const SHAPE_PROMPT = [
  '# Shape',
  '',
  'A param value is an ARRAY, even for a single value: {"year": [2024]}. Two exceptions:',
  '- `output` is an OBJECT: {"period": "game", "aggregation": "rate", "threshold": null}. Use it whenever the instruction asks for a per-game or per-play rate rather than a total.',
  '- A value that depends on when the view is read is an object inside the array: {"nfl_week_id": [{"dynamic_type": "current_nfl_week"}]}.',
  '',
  'Filters go in `where`, and most views have them — a request naming a position, a threshold, or a season is asking for a filter, not just a column. Operators, most used first: IN, >=, IS NOT NULL, >, =, <, !=, <=.',
  '',
  'A complete example:',
  '',
  JSON.stringify(
    {
      row_grain: ['player'],
      prefix_columns: ['player_name', 'player_position', 'player_nfl_teams'],
      columns: [
        {
          column_id: 'player_receiving_yards_from_plays',
          params: {
            year: [2024],
            output: { period: 'game', aggregation: 'rate', threshold: null }
          }
        },
        { column_id: 'player_games_played', params: { year: [2024] } }
      ],
      where: [
        {
          column_id: 'player_position',
          operator: 'IN',
          value: ['WR'],
          params: {}
        },
        {
          column_id: 'player_games_played',
          operator: '>=',
          value: '8',
          params: { year: [2024] }
        }
      ],
      sort: [{ column_id: 'player_receiving_yards_from_plays', desc: true }],
      row_axes: []
    },
    null,
    2
  )
].join('\n')

// The agent's standing instructions.
//
// NOTHING HERE DISCOURAGES REFUSAL, and that absence is deliberate. Two lines
// ("Always build the view", "Set expressible to false ONLY when nothing in the
// catalog is even close") were added to push a measured 21% false-refusal rate
// down, which treated a missing-retrieval defect as a prompt problem. The agent
// can search the catalog on demand, so the correct behaviour when it is unsure
// is to search and preview, not to force an answer -- and a refusal rate
// measured under pressure reports the pressure rather than the capability.
export const AGENT_INSTRUCTIONS = [
  'You build data view definitions for a fantasy football analytics table.',
  '',
  'Search the column catalog for what the instruction needs, then emit a table_state that answers it.',
  '',
  'Rules:',
  '- Use ONLY column ids the catalog returns, verbatim. Never invent one, and never guess at a plausible-looking id.',
  '- row_grain says whether a row is a player or a team, and every view needs one.',
  '- Put identity columns in prefix_columns: player_name, player_position and player_nfl_teams for a player view, team_code and team_name for a team view.',
  '- Prefer fewer, well-chosen columns over many.',
  '- Parameterise every measure column the instruction constrains — a season, a week, a per-game rate. An unparameterised measure answers a different question from the one asked.',
  '- row_axes splits rows by a dimension and the only two are year and week. Leave it empty for a single-row-per-player view.',
  '- sort on the column the instruction is really asking about, descending unless the instruction implies otherwise.',
  '',
  SHAPE_PROMPT
].join('\n')
