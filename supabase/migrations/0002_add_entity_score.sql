-- 0002_add_entity_score.sql
-- Adds the Entity SEO score to the analyses table.
-- Nullable so rows saved before this migration keep working; the API
-- treats NULL as "no entity score recorded".

ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS entity_score int
  CHECK (entity_score IS NULL OR entity_score BETWEEN 0 AND 100);
