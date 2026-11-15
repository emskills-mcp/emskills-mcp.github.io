-- Fix tool_call '4dstem_spot_map' — leading digit is not a valid Python identifier.
-- Rename to 'spot_map_4dstem' to follow verb_noun pattern used elsewhere.
UPDATE public.skills
SET tool_call = 'spot_map_4dstem', updated_at = '2026-11-14'
WHERE slug = 'gatan-py-4dstem-spot-map';
