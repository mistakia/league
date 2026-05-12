# libs-server/view-organization

Server-side helpers for the view organization feature: favorites and user/LLM-authored tags on `user_data_views`.

## Modules

- `load-view-organization.mjs` — Load favorites + tags for a user. Applies orphan filter: keeps only rows where `view_id` exists in the user's live `user_data_views` OR is a system view (see `libs-shared/view-organization/system-data-view-ids.mjs`). Returns `{ favorites: [view_id], tags_by_view_id: { [view_id]: [{ name, source }] } }`.
- `add-user-tag.mjs` — Sanitize and upsert a user tag. Sanitization: trim → reject empty → lowercase → reject non-printable-ASCII → enforce 64-char cap. Source-collision rule: promotes existing `source='llm'` row to `source='user'`.
- `remove-user-tag.mjs` — Delete only `source='user'` rows; LLM tags are preserved.
- `toggle-favorite.mjs` — Idempotent insert or delete for `user_data_view_favorites`.

## DB Tables

- `user_data_view_favorites (user_id, view_id, created_at)` — PK `(user_id, view_id)`.
- `user_data_view_tags (user_id, view_id, tag_name, source, created_at)` — PK `(user_id, view_id, tag_name)`. `source` is `'user'` or `'llm'`.

## API Routes

Defined in `api/routes/data-views.mjs`:
- `GET /data-views/organization` — returns load-view-organization result
- `POST /data-views/:view_id/favorite` — insert favorite (idempotent)
- `DELETE /data-views/:view_id/favorite` — remove favorite
- `POST /data-views/:view_id/tags` — add user tag
- `DELETE /data-views/:view_id/tags/:tag_name` — remove user tag (source='user' only)

## Source-collision Rules

- **User over LLM:** when a user tags a view with the same name as an existing LLM tag, the row is promoted to `source='user'`. User intent always wins.
- **LLM over nothing:** the LLM job uses `ON CONFLICT DO NOTHING` so existing `source='user'` rows are preserved.
- **User delete:** removes only `source='user'` rows; LLM tags persist until the next LLM job run.

## See Also

- `libs-shared/view-organization/system-data-view-ids.mjs` — system view ID constants
- `libs-shared/view-organization/auto-tag-vocabulary.mjs` — closed set of auto-tagger output strings
- `app/core/data-views/derive-auto-tags.js` — deterministic 4-axis auto-tagger (client-side, render-time only)
