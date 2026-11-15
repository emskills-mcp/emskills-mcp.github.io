-- Add Tier-1 and Tier-2 SkillEvaluator result columns.
-- eval_tier1: null = not yet evaluated, {"pass": true|false, "issues": [...], ...}
-- eval_tier2: null = not yet evaluated, {"similar_pairs": [...], "threshold": 0.82, ...}

ALTER TABLE public.skills
  ADD COLUMN IF NOT EXISTS eval_tier1 JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS eval_tier2 JSONB DEFAULT NULL;

-- Seed results for the 82 Gatan skills — all passed Tier 1 from the
-- NVIDIA SkillEvaluator 0.9.0 run on 2026-11-14.
UPDATE public.skills
SET eval_tier1 = '{"pass": true, "issues": [], "run_date": "2026-11-14", "tool": "NVIDIA SkillEvaluator 0.9.0"}'
WHERE org = 'Gatan';

-- Seed results for the 16 core (non-Gatan) skills — all passed Tier 1.
-- Advisory-only: OC-RELOAD (informational) and trigger placement (non-blocking).
UPDATE public.skills
SET eval_tier1 = '{"pass": true, "issues": ["advisory: OC-RELOAD (informational)", "advisory: Use-when trigger placement"], "run_date": "2026-11-14", "tool": "NVIDIA SkillEvaluator 0.9.0"}'
WHERE slug IN (
  'cryo2d-classify', 'ctf-fitter', 'edax-phase-map', 'eels-edge-id',
  'fib-mill-seg', 'fib-phase-fractions', 'grid-atlas-qc', 'lattice-dspacing',
  'particle-picker', 'provenance-verify', 'scalebar-calibrate', 'sem-particle-size',
  'sem-topography', 'stem-drift-lock', 'tem-view-twin', 'tomo-align'
);
