-- View organization: favorites and tags for user_data_views
-- Applied: 2026-05-11
-- yarn db:exec db/adhoc/2026-05-11-data-view-favorites-and-tags.sql
-- yarn export:schema

CREATE TABLE user_data_view_favorites (
  user_id    bigint NOT NULL,
  view_id    varchar(36) NOT NULL,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, view_id)
);
CREATE INDEX user_data_view_favorites_user_id_idx ON user_data_view_favorites (user_id);

CREATE TABLE user_data_view_tags (
  user_id    bigint NOT NULL,
  view_id    varchar(36) NOT NULL,
  tag_name   varchar(64) NOT NULL,
  source     varchar(8)  NOT NULL CHECK (source IN ('user', 'llm')),
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, view_id, tag_name)
);
CREATE INDEX user_data_view_tags_user_id_idx ON user_data_view_tags (user_id);
CREATE INDEX user_data_view_tags_user_source_idx ON user_data_view_tags (user_id, source);

ALTER TABLE user_data_views
  ADD COLUMN llm_tags_generated_at timestamptz NULL;

-- rollback:
-- ALTER TABLE user_data_views DROP COLUMN llm_tags_generated_at;
-- DROP TABLE user_data_view_tags;
-- DROP TABLE user_data_view_favorites;
