-- LLM-generated descriptor tags, final batch (users 131/132/133, 6 views)
-- Completes initial seeding of 172 user_data_views.

INSERT INTO user_data_view_tags (user_id, view_id, tag_name, source) VALUES
  -- DynastyIM QB
  (131, '2d426314-a43f-4cd8-8fb3-d3d7d6e4e5c9', 'dynasty', 'llm'),
  (131, '2d426314-a43f-4cd8-8fb3-d3d7d6e4e5c9', 'rankings', 'llm'),
  -- DynastyIM RB
  (131, 'f86cf51f-a57c-49dc-b92a-b8d9fbfd164b', 'dynasty', 'llm'),
  (131, 'f86cf51f-a57c-49dc-b92a-b8d9fbfd164b', 'rankings', 'llm'),
  -- DynastyIM TE
  (131, '6f1f12f7-a3b9-4524-a3eb-3bd7213f1864', 'dynasty', 'llm'),
  (131, '6f1f12f7-a3b9-4524-a3eb-3bd7213f1864', 'rankings', 'llm'),
  -- DynastyIM WR
  (131, 'a8898604-aa54-4816-bf74-43483420903b', 'dynasty', 'llm'),
  (131, 'a8898604-aa54-4816-bf74-43483420903b', 'rankings', 'llm'),
  -- RB rushing yard prop lines
  (133, 'f899a721-57f8-4aaa-b0b6-8c3b399c9781', 'prop-lines', 'llm'),
  (133, 'f899a721-57f8-4aaa-b0b6-8c3b399c9781', 'rushing', 'llm')
ON CONFLICT (user_id, view_id, tag_name) DO NOTHING;

-- Mark all 6 views processed (user 132 "New view" is junk, no tags)
UPDATE user_data_views SET llm_tags_generated_at = NOW()
WHERE view_id IN (
  '2d426314-a43f-4cd8-8fb3-d3d7d6e4e5c9',
  'f86cf51f-a57c-49dc-b92a-b8d9fbfd164b',
  '6f1f12f7-a3b9-4524-a3eb-3bd7213f1864',
  'a8898604-aa54-4816-bf74-43483420903b',
  '5b0851a5-6a87-497a-9d91-be3515ab622b',
  'f899a721-57f8-4aaa-b0b6-8c3b399c9781'
);
