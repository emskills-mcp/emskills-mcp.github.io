-- Sync skills catalog with the canonical GitHub registry (emskills-mcp/em-skills).
-- 1. Fix org/repo on existing skills that were seeded with placeholder values.
-- 2. Upsert 7 skills present in the GitHub repo (some may already exist with wrong org/repo).

-- ── Fix existing skills ──────────────────────────────────────────────────────

UPDATE public.skills
SET org = 'emskills-mcp', repo = 'emskills-mcp/em-skills', updated_at = '2026-11-14'
WHERE slug IN (
  'cryo2d-classify',
  'edax-phase-map',
  'ctf-fitter',
  'fib-mill-seg',
  'tomo-align',
  'grid-atlas-qc',
  'scalebar-calibrate',
  'particle-picker',
  'lattice-dspacing',
  'eels-edge-id',
  'sem-topography',
  'stem-drift-lock'
);

-- ── Insert 4 new skills (truly absent from DB) ───────────────────────────────

INSERT INTO public.skills
  (slug, name, technique, kind, summary, description, org, repo,
   version, stars, downloads, license, runtime, tool_call, category, tags, updated_at)
VALUES

('fib-phase-fractions',
 'FIB-SEM phase volume fractions',
 'FIB', 'MCP server',
 'Phase volume fractions of a FIB-SEM volume with sampling error bars.',
 'Computes the volume fraction and surface density of every phase in a segmented FIB-SEM (slice-and-view) volume, in physical units from the voxel size, with a sampling standard error estimated from the covariance integral range.',
 'NUANCE-IT', 'NUANCE-IT/NUScope-TOMO', '1.0.0',
 0, 0, 'MIT', 'python 3.11', 'tomo_phase_fractions', 'Segmentation',
 ARRAY['fib-sem','slice-and-view','volume-fraction','uncertainty','nuscope-tomo'], '2026-11-14'),

('provenance-verify',
 'Microscopy file provenance verification',
 'SEM', 'MCP server',
 'Check that a microscopy file is unchanged since it was sealed, and who signed it.',
 'Verifies the cryptographic seal of a NUScope file (.h5, .nxs, .zarr, .tif): SHA-256 of the data, calibration, metadata and the hash-chained processing history, plus every Ed25519 signature with the signer''s ORCID iD.',
 'NUANCE-IT', 'NUANCE-IT/NUScope', '1.0.0',
 0, 0, 'MIT', 'python 3.11', 'nuscope_verify', 'Data integrity',
 ARRAY['provenance','integrity','signature','orcid','nuscope'], '2026-11-14'),

('sem-particle-size',
 'SEM particle sizing with provenance',
 'SEM', 'MCP server',
 'Particle sizing in calibrated nm from any NUANCE SEM file, with provenance.',
 'Finds particles in an SEM image and measures area, equivalent diameter, Feret, aspect ratio and circularity in nm, using the pixel size read from the instrument''s own metadata (Thermo Fisher, Zeiss, Hitachi, JEOL, Gatan and 40+ formats via NUScope).',
 'NUANCE-IT', 'NUANCE-IT/NUScope', '1.0.0',
 0, 0, 'MIT', 'python 3.11', 'nuscope_analyze', 'Segmentation',
 ARRAY['particles','morphometry','calibration','provenance','nuscope'], '2026-11-14'),

('tem-view-twin',
 'TEM physics-based digital twin',
 'TEM', 'SKILL.md',
 'Physics-based TEM digital twin that simulates calibrated images, diffraction, spectra and holograms.',
 'Runs the TEM-view digital twin headlessly: wave-optical imaging with the contrast transfer function, electron diffraction, STEM and 4D-STEM, CBED, EDS and EELS, off-axis and in-line holography, with cryo and heating holders. Returns NumPy data with calibrations from metadata.',
 'Advanced-EM', 'Advanced-EM/TEM-view', '1.0.0',
 0, 0, 'MIT', 'node 20', 'simulate_tem', 'Simulation',
 ARRAY['simulation','digital-twin','diffraction','ctf','training'], '2026-11-14');
