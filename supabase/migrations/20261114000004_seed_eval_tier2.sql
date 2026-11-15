-- Seed Tier 2 (embedding similarity) results from NVIDIA SkillEvaluator 0.9.0
-- run on 2026-11-14 against 101 skills (threshold 0.82).
-- All 16 core skills: clean pass (0 pairs).
-- 5 Gatan pairs flagged SIMILARITY-MEDIUM (non-blocking advisory).

-- ── Clean pass: all 16 core skills ───────────────────────────────────────────
UPDATE public.skills
SET eval_tier2 = '{"similar_pairs": [], "threshold": 0.82, "run_date": "2026-11-14", "tool": "NVIDIA SkillEvaluator 0.9.0"}'
WHERE slug IN (
  'cryo2d-classify', 'ctf-fitter', 'edax-phase-map', 'eels-edge-id',
  'fib-mill-seg', 'fib-phase-fractions', 'grid-atlas-qc', 'lattice-dspacing',
  'particle-picker', 'provenance-verify', 'scalebar-calibrate', 'sem-particle-size',
  'sem-topography', 'stem-drift-lock', 'tem-view-twin', 'tomo-align'
);

-- ── Clean pass: all Gatan skills except the 7 with flagged pairs ──────────────
UPDATE public.skills
SET eval_tier2 = '{"similar_pairs": [], "threshold": 0.82, "run_date": "2026-11-14", "tool": "NVIDIA SkillEvaluator 0.9.0"}'
WHERE org = 'Gatan'
  AND slug NOT IN (
    'gatan-py-drift-fit', 'gatan-py-drift-plot', 'gatan-py-drift-interpolate',
    'gatan-py-find-image-label', 'gatan-py-find-image-name',
    'gatan-py-camera-acquisition', 'gatan-py-digiscan-acquisition'
  );

-- ── Flagged pairs ─────────────────────────────────────────────────────────────

UPDATE public.skills
SET eval_tier2 = '{"similar_pairs": [{"slug": "gatan-py-drift-plot", "score": 0.897}, {"slug": "gatan-py-drift-interpolate", "score": 0.856}], "threshold": 0.82, "run_date": "2026-11-14", "tool": "NVIDIA SkillEvaluator 0.9.0"}'
WHERE slug = 'gatan-py-drift-fit';

UPDATE public.skills
SET eval_tier2 = '{"similar_pairs": [{"slug": "gatan-py-drift-fit", "score": 0.897}, {"slug": "gatan-py-drift-interpolate", "score": 0.877}], "threshold": 0.82, "run_date": "2026-11-14", "tool": "NVIDIA SkillEvaluator 0.9.0"}'
WHERE slug = 'gatan-py-drift-plot';

UPDATE public.skills
SET eval_tier2 = '{"similar_pairs": [{"slug": "gatan-py-drift-plot", "score": 0.877}, {"slug": "gatan-py-drift-fit", "score": 0.856}], "threshold": 0.82, "run_date": "2026-11-14", "tool": "NVIDIA SkillEvaluator 0.9.0"}'
WHERE slug = 'gatan-py-drift-interpolate';

UPDATE public.skills
SET eval_tier2 = '{"similar_pairs": [{"slug": "gatan-py-find-image-name", "score": 0.865}], "threshold": 0.82, "run_date": "2026-11-14", "tool": "NVIDIA SkillEvaluator 0.9.0"}'
WHERE slug = 'gatan-py-find-image-label';

UPDATE public.skills
SET eval_tier2 = '{"similar_pairs": [{"slug": "gatan-py-find-image-label", "score": 0.865}], "threshold": 0.82, "run_date": "2026-11-14", "tool": "NVIDIA SkillEvaluator 0.9.0"}'
WHERE slug = 'gatan-py-find-image-name';

UPDATE public.skills
SET eval_tier2 = '{"similar_pairs": [{"slug": "gatan-py-digiscan-acquisition", "score": 0.855}], "threshold": 0.82, "run_date": "2026-11-14", "tool": "NVIDIA SkillEvaluator 0.9.0"}'
WHERE slug = 'gatan-py-camera-acquisition';

UPDATE public.skills
SET eval_tier2 = '{"similar_pairs": [{"slug": "gatan-py-camera-acquisition", "score": 0.855}], "threshold": 0.82, "run_date": "2026-11-14", "tool": "NVIDIA SkillEvaluator 0.9.0"}'
WHERE slug = 'gatan-py-digiscan-acquisition';
