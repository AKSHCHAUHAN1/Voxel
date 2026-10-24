CREATE INDEX "Dashboard_scene_search_idx"
ON "Dashboard"
USING GIN (to_tsvector('simple', "scene"::text));
