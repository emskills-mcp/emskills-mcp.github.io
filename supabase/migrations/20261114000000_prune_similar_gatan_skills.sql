-- Prune 5 near-duplicate Gatan skills identified by NVIDIA SkillEvaluator Tier 2
-- similarity scan (threshold 0.82). Merge drift triplet → drift-analysis,
-- merge find-image trio → find-image, delete vbscript-direct variant.
-- Net result: 87 → 82 skills.

-- ── Group A: Drift triplet ───────────────────────────────────────────────────
-- gatan-py-drift-fit (kept) becomes the canonical drift-analysis skill.
-- gatan-py-drift-interpolate and gatan-py-drift-plot are deleted.

UPDATE public.skills
SET
  slug        = 'gatan-py-drift-analysis',
  name        = 'DigitalMicrograph drift data analysis',
  summary     = 'Fit, interpolate, and plot drift data in DigitalMicrograph for motion correction via Python.',
  description = 'Analyses drift data using Python scripts in DigitalMicrograph: fits curves to drift measurements, interpolates missing frames, and plots results for motion correction and improved microscopy analysis. Supports fit, interpolate, and plot modes via the drift_analysis tool call.',
  tool_call   = 'drift_analysis',
  tags        = ARRAY['drift','motion-correction','interpolation','plot','python','digitalmicrograph'],
  updated_at  = '2026-11-14'
WHERE slug = 'gatan-py-drift-fit';

DELETE FROM public.skills WHERE slug IN (
  'gatan-py-drift-interpolate',
  'gatan-py-drift-plot'
);

-- ── Group B: VBScript ────────────────────────────────────────────────────────
-- gatan-dm-run-vbscript-direct is a minor variant of gatan-dm-run-vbscript.

DELETE FROM public.skills WHERE slug = 'gatan-dm-run-vbscript-direct';

-- ── Group C: Find-image trio ─────────────────────────────────────────────────
-- gatan-py-find-image-id (kept) becomes the canonical find-image skill.
-- gatan-py-find-image-label and gatan-py-find-image-name are deleted.

UPDATE public.skills
SET
  slug        = 'gatan-py-find-image',
  name        = 'Find image in DigitalMicrograph',
  summary     = 'Find a DigitalMicrograph image by ID, label, or name using Python.',
  description = 'Retrieves an image from the DigitalMicrograph workspace using Python. Supports three lookup strategies: by unique ID (incremented on each memory allocation), by label string, or by display name. Demonstrates the FindImage API for all common access patterns.',
  tool_call   = 'find_image',
  tags        = ARRAY['find-image','id','label','name','python','digitalmicrograph'],
  updated_at  = '2026-11-14'
WHERE slug = 'gatan-py-find-image-id';

DELETE FROM public.skills WHERE slug IN (
  'gatan-py-find-image-label',
  'gatan-py-find-image-name'
);
