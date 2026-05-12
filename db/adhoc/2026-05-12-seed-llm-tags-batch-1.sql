-- LLM-generated descriptor tags, batch 1 of N
-- Source: interactive Claude session 2026-05-12 (replaces script-based generation pending thread-metadata-style LLM setup).
-- Prompt template lives in scripts/generate-data-view-llm-tags.mjs (preserved for future automation).
-- All tags excluded from libs-shared/view-organization/auto-tag-vocabulary.mjs.

INSERT INTO user_data_view_tags (user_id, view_id, tag_name, source) VALUES
  -- 1st and 10 Tendencies by week
  (1, '34005dc2-1100-402b-a8d9-fc7592bd9b44', 'game-situation', 'llm'),
  (1, '34005dc2-1100-402b-a8d9-fc7592bd9b44', 'down-and-distance', 'llm'),
  (1, '34005dc2-1100-402b-a8d9-fc7592bd9b44', 'weekly-split', 'llm'),
  -- 1st Quarter & Game passing split by week
  (1, 'b124f225-3e71-4f55-92ae-ae1ece5e2896', 'first-quarter', 'llm'),
  (1, 'b124f225-3e71-4f55-92ae-ae1ece5e2896', 'weekly-split', 'llm'),
  (1, 'b124f225-3e71-4f55-92ae-ae1ece5e2896', 'passing', 'llm'),
  -- 1st Quarter & Game Receiving split by week
  (1, 'a604b0eb-fcf8-4df3-9e12-1cd9f082b592', 'first-quarter', 'llm'),
  (1, 'a604b0eb-fcf8-4df3-9e12-1cd9f082b592', 'weekly-split', 'llm'),
  (1, 'a604b0eb-fcf8-4df3-9e12-1cd9f082b592', 'receiving', 'llm'),
  -- 1st Quarter & Game Rushing split by week
  (1, '8936ddac-02dd-459a-ad71-ed988e8e33b2', 'first-quarter', 'llm'),
  (1, '8936ddac-02dd-459a-ad71-ed988e8e33b2', 'weekly-split', 'llm'),
  (1, '8936ddac-02dd-459a-ad71-ed988e8e33b2', 'rushing', 'llm'),
  -- 1st Quarter Passing
  (1, '92f92990-8c58-49c9-bd17-f78e8584d37c', 'first-quarter', 'llm'),
  (1, '92f92990-8c58-49c9-bd17-f78e8584d37c', 'passing', 'llm'),
  -- 1st Quarter Passing By Week
  (1, '51cdd093-0fbf-477a-9323-3cf1a4249487', 'first-quarter', 'llm'),
  (1, '51cdd093-0fbf-477a-9323-3cf1a4249487', 'passing', 'llm'),
  (1, '51cdd093-0fbf-477a-9323-3cf1a4249487', 'weekly-split', 'llm'),
  -- 1st Quarter PROE by week
  (1, '87a0f93e-d182-4eb2-811d-8970ae451111', 'first-quarter', 'llm'),
  (1, '87a0f93e-d182-4eb2-811d-8970ae451111', 'proe', 'llm'),
  (1, '87a0f93e-d182-4eb2-811d-8970ae451111', 'weekly-split', 'llm'),
  -- 1st Quarter Receiving
  (1, '14bb5a86-0cbe-400a-bba9-319318c5a7b2', 'first-quarter', 'llm'),
  (1, '14bb5a86-0cbe-400a-bba9-319318c5a7b2', 'receiving', 'llm'),
  -- 1st Quarter Receiving By Week
  (1, '9b0b222c-afe8-4674-872e-611b86620461', 'first-quarter', 'llm'),
  (1, '9b0b222c-afe8-4674-872e-611b86620461', 'receiving', 'llm'),
  (1, '9b0b222c-afe8-4674-872e-611b86620461', 'weekly-split', 'llm'),
  -- 1st Quarter Rushing
  (1, '77754734-6df4-43b0-8dbd-754df2ebc370', 'first-quarter', 'llm'),
  (1, '77754734-6df4-43b0-8dbd-754df2ebc370', 'rushing', 'llm'),
  -- 1st Quarter Rushing By Week
  (1, 'cb38cd00-9603-4c5c-b7c4-47f7153b80c7', 'first-quarter', 'llm'),
  (1, 'cb38cd00-9603-4c5c-b7c4-47f7153b80c7', 'rushing', 'llm'),
  (1, 'cb38cd00-9603-4c5c-b7c4-47f7153b80c7', 'weekly-split', 'llm'),
  -- 1st Team Touchdown Research
  (1, '800fe4da-7605-4d35-8272-a5ae9e85c319', 'first-touchdown', 'llm'),
  (1, '800fe4da-7605-4d35-8272-a5ae9e85c319', 'scoring', 'llm'),
  (1, '800fe4da-7605-4d35-8272-a5ae9e85c319', 'research', 'llm'),
  -- Air Yards by week
  (1, 'f796ff59-7f9a-49bb-ade0-cc6b0b4665aa', 'air-yards', 'llm'),
  (1, 'f796ff59-7f9a-49bb-ade0-cc6b0b4665aa', 'weekly-split', 'llm'),
  -- Air Yard Share By Week (×3 duplicates)
  (1, 'c2982094-4754-4ae3-b5ee-f3a22523e2ea', 'air-yards-share', 'llm'),
  (1, 'c2982094-4754-4ae3-b5ee-f3a22523e2ea', 'weekly-split', 'llm'),
  (1, 'c2982094-4754-4ae3-b5ee-f3a22523e2ea', 'receiving', 'llm'),
  (1, '3a9b50be-cb29-47ba-baeb-86f13304cd5a', 'air-yards-share', 'llm'),
  (1, '3a9b50be-cb29-47ba-baeb-86f13304cd5a', 'weekly-split', 'llm'),
  (1, '3a9b50be-cb29-47ba-baeb-86f13304cd5a', 'receiving', 'llm'),
  (1, '68f1227d-c5d6-4ff5-840f-8f766699ee5a', 'air-yards-share', 'llm'),
  (1, '68f1227d-c5d6-4ff5-840f-8f766699ee5a', 'weekly-split', 'llm'),
  (1, '68f1227d-c5d6-4ff5-840f-8f766699ee5a', 'receiving', 'llm'),
  -- Cover 1 By Week
  (1, '0939694e-a6ea-4b60-bafc-c29b6a1aeb73', 'coverage-scheme', 'llm'),
  (1, '0939694e-a6ea-4b60-bafc-c29b6a1aeb73', 'weekly-split', 'llm'),
  -- Cover 1 Faced By Week
  (1, '5e51fd75-6d0c-4955-8928-e99af11679f3', 'coverage-scheme', 'llm'),
  (1, '5e51fd75-6d0c-4955-8928-e99af11679f3', 'matchup', 'llm'),
  (1, '5e51fd75-6d0c-4955-8928-e99af11679f3', 'weekly-split', 'llm'),
  -- Current Season Rushing Stats
  (1, '380f60c1-408f-48ba-ad41-1ca4ac3467c8', 'rushing', 'llm'),
  (1, '380f60c1-408f-48ba-ad41-1ca4ac3467c8', 'research', 'llm'),
  -- Defense 1st Quarter Rushing Allowed by week
  (1, 'a8b26777-cc88-4252-b957-54622b95c749', 'first-quarter', 'llm'),
  (1, 'a8b26777-cc88-4252-b957-54622b95c749', 'rushing-allowed', 'llm'),
  (1, 'a8b26777-cc88-4252-b957-54622b95c749', 'weekly-split', 'llm'),
  -- Defense Coverage Matric
  (1, '942dbeac-0685-4808-92dc-ffcba72a93f9', 'coverage-scheme', 'llm'),
  (1, '942dbeac-0685-4808-92dc-ffcba72a93f9', 'research', 'llm'),
  -- Defense Overview
  (1, '7627bedf-1150-462c-8404-f4a49b3cfc2c', 'research', 'llm'),
  -- Defense Pass Rate Over Expected (PROE) Allowed By Week
  (1, '9deebfaf-bebd-48ee-9d43-3c055b544f81', 'proe', 'llm'),
  (1, '9deebfaf-bebd-48ee-9d43-3c055b544f81', 'weekly-split', 'llm'),
  (1, '9deebfaf-bebd-48ee-9d43-3c055b544f81', 'defense-tendencies', 'llm'),
  -- Draftkings Alt Passing
  (1, 'b9f09001-b8c0-48fa-ad1a-3d0f9a999588', 'alt-lines', 'llm'),
  (1, 'b9f09001-b8c0-48fa-ad1a-3d0f9a999588', 'draftkings', 'llm'),
  -- Draftkings Alt Receiving
  (1, '56ceaab5-ad23-44de-9843-664f4bb92e46', 'alt-lines', 'llm'),
  (1, '56ceaab5-ad23-44de-9843-664f4bb92e46', 'draftkings', 'llm'),
  -- Draftkings Alt Receiving Simple
  (1, '23c8c709-b624-4b4c-b2b5-d1eea388e27f', 'alt-lines', 'llm'),
  (1, '23c8c709-b624-4b4c-b2b5-d1eea388e27f', 'draftkings', 'llm'),
  -- DraftKings Alt Receptions
  (1, '86e8b2de-22d2-4e13-a126-80ebad3d25ac', 'alt-lines', 'llm'),
  (1, '86e8b2de-22d2-4e13-a126-80ebad3d25ac', 'draftkings', 'llm'),
  -- Draftkings Alt Rushing
  (1, '50f322d5-b35e-421b-b7c9-0a76e2415aee', 'alt-lines', 'llm'),
  (1, '50f322d5-b35e-421b-b7c9-0a76e2415aee', 'draftkings', 'llm'),
  -- Draftkings Alt Spread
  (1, '7fdf312c-4662-4bf4-b4de-3b9806f2da41', 'alt-lines', 'llm'),
  (1, '7fdf312c-4662-4bf4-b4de-3b9806f2da41', 'draftkings', 'llm'),
  (1, '7fdf312c-4662-4bf4-b4de-3b9806f2da41', 'spread', 'llm'),
  -- Draftkings First Half Alt Rushing yards
  (1, 'efd3b1e8-9070-4161-a24f-791fdfca1fde', 'alt-lines', 'llm'),
  (1, 'efd3b1e8-9070-4161-a24f-791fdfca1fde', 'draftkings', 'llm'),
  (1, 'efd3b1e8-9070-4161-a24f-791fdfca1fde', 'first-half', 'llm')
ON CONFLICT (user_id, view_id, tag_name) DO NOTHING;

UPDATE user_data_views
SET llm_tags_generated_at = NOW()
WHERE view_id IN (
  '34005dc2-1100-402b-a8d9-fc7592bd9b44',
  'b124f225-3e71-4f55-92ae-ae1ece5e2896',
  'a604b0eb-fcf8-4df3-9e12-1cd9f082b592',
  '8936ddac-02dd-459a-ad71-ed988e8e33b2',
  '92f92990-8c58-49c9-bd17-f78e8584d37c',
  '51cdd093-0fbf-477a-9323-3cf1a4249487',
  '87a0f93e-d182-4eb2-811d-8970ae451111',
  '14bb5a86-0cbe-400a-bba9-319318c5a7b2',
  '9b0b222c-afe8-4674-872e-611b86620461',
  '77754734-6df4-43b0-8dbd-754df2ebc370',
  'cb38cd00-9603-4c5c-b7c4-47f7153b80c7',
  '800fe4da-7605-4d35-8272-a5ae9e85c319',
  'f796ff59-7f9a-49bb-ade0-cc6b0b4665aa',
  'c2982094-4754-4ae3-b5ee-f3a22523e2ea',
  '3a9b50be-cb29-47ba-baeb-86f13304cd5a',
  '68f1227d-c5d6-4ff5-840f-8f766699ee5a',
  '0939694e-a6ea-4b60-bafc-c29b6a1aeb73',
  '5e51fd75-6d0c-4955-8928-e99af11679f3',
  '380f60c1-408f-48ba-ad41-1ca4ac3467c8',
  'a8b26777-cc88-4252-b957-54622b95c749',
  '942dbeac-0685-4808-92dc-ffcba72a93f9',
  '7627bedf-1150-462c-8404-f4a49b3cfc2c',
  '9deebfaf-bebd-48ee-9d43-3c055b544f81',
  'b9f09001-b8c0-48fa-ad1a-3d0f9a999588',
  '56ceaab5-ad23-44de-9843-664f4bb92e46',
  '23c8c709-b624-4b4c-b2b5-d1eea388e27f',
  '86e8b2de-22d2-4e13-a126-80ebad3d25ac',
  '50f322d5-b35e-421b-b7c9-0a76e2415aee',
  '7fdf312c-4662-4bf4-b4de-3b9806f2da41',
  'efd3b1e8-9070-4161-a24f-791fdfca1fde'
);

-- rollback:
-- DELETE FROM user_data_view_tags WHERE source = 'llm' AND view_id IN (...) AND created_at >= '2026-05-12';
-- UPDATE user_data_views SET llm_tags_generated_at = NULL WHERE view_id IN (...);
