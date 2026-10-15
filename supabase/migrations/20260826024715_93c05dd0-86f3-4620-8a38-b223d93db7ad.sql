CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  unique (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT USAGE ON TYPE public.app_role TO authenticated;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_self_select" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

CREATE TABLE public.skills (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  technique text not null,
  kind text not null,
  summary text not null,
  description text not null,
  org text not null,
  repo text not null,
  version text not null,
  stars integer not null default 0,
  downloads integer not null default 0,
  license text not null,
  runtime text not null,
  tool_call text not null,
  category text not null,
  tags text[] not null default '{}',
  updated_at date,
  submitted_by uuid,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.skills TO anon;
GRANT SELECT ON public.skills TO authenticated;
GRANT ALL ON public.skills TO service_role;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "skills_public_read" ON public.skills FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.skill_submissions (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  technique text not null,
  kind text not null,
  summary text not null,
  description text not null,
  org text not null,
  repo text not null,
  version text not null,
  license text not null,
  runtime text not null,
  tool_call text not null,
  category text not null,
  tags text[] not null default '{}',
  submitter_id uuid not null,
  status text not null default 'pending',
  reviewer_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE ON public.skill_submissions TO authenticated;
GRANT ALL ON public.skill_submissions TO service_role;
ALTER TABLE public.skill_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "submissions_owner_select" ON public.skill_submissions FOR SELECT TO authenticated USING (auth.uid() = submitter_id);
CREATE POLICY "submissions_admin_select" ON public.skill_submissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "submissions_owner_insert" ON public.skill_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = submitter_id);
CREATE POLICY "submissions_owner_update" ON public.skill_submissions FOR UPDATE TO authenticated USING (auth.uid() = submitter_id) WITH CHECK (auth.uid() = submitter_id);
CREATE POLICY "submissions_admin_update" ON public.skill_submissions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (true);

INSERT INTO public.skills (slug, name, technique, kind, summary, description, org, repo, version, stars, downloads, license, runtime, tool_call, category, tags, updated_at, published_at) VALUES
('cryo2d-classify','cryo2d-classify','cryo-EM','MCP server','Reference-free 2D classification of particle micrographs with a motion-correction pre-pass.','Reference-free 2D classification of cryo-EM particle micrographs. Includes motion correction, contrast transfer estimation, and clustering with configurable binning and angular sampling. Exposes a typed MCP toolset for batch runs against a session directory.','volvox-lab','volvox-lab/cryo2d','v2.4.1',1204,48910,'MIT','python 3.11','2d_classify','Segmentation',ARRAY['2d','cluster','ctf'],'2026-06-02',now()),
('edax-phase-map','edax-phase-map','EDS','MCP server','Phase mapping from dispersive spectra with peak deconvolution and ZAF correction.','Super-resolution phase mapping from energy dispersive spectra. Performs automatic peak deconvolution, background subtraction, and ZAF quantification, returning per-pixel elemental fractions plus a labelled phase map.','quanta-research','quanta-research/edax-phase-map','v1.9.0',876,31204,'MIT','python 3.10','phase_map','Spectrum analysis',ARRAY['eds','quant','zaf'],'2026-05-28',now()),
('ctf-fitter','ctf-fitter','TEM','SKILL.md','Per-tilt CTF estimation and refinement with amorphous-carbon reference subtraction.','Per-tilt contrast transfer function estimation and refinement for TEM diffraction patterns. Handles amorphous-carbon reference subtraction, astigmatism fitting, and defocus drift across a tilt series.','helix-imaging','helix-imaging/ctf-fitter','v3.1.2',642,22780,'Apache-2.0','python 3.11','fit_ctf','Calibration',ARRAY['ctf','defocus','tilt'],'2026-06-05',now()),
('fib-mill-seg','fib-mill-seg','FIB','MCP server','Mill-volume segmentation and lift-out path planning for serial sectioning.','Segments the mill volume from live FIB imagery and plans a lift-out path for serial-sectioning workflows, including lamella thickness targets and redeposition avoidance.','mesa-nano','mesa-nano/fib-mill-seg','v0.8.3',411,9840,'MIT','python 3.11','plan_liftout','Segmentation',ARRAY['lamella','liftout','planning'],'2026-04-19',now()),
('sem-topography','sem-topography','SEM','SKILL.md','3D surface relief reconstruction from four-quadrant backscattered stacks.','Reconstructs 3D surface relief from four-quadrant backscattered electron stacks, returning a height field with per-pixel confidence and roughness statistics.','surfacelab','surfacelab/sem-topography','v2.4.0',588,17420,'MIT','python 3.10','reconstruct_relief','Reconstruction',ARRAY['bse','height','roughness'],'2026-03-11',now()),
('eels-edge-id','eels-edge-id','EELS','MCP server','Core-loss edge identification and oxidation-state fingerprinting.','Identifies core-loss edges in EELS spectra, fits fine structure, and fingerprints oxidation states against a reference library. Returns candidate assignments with confidence intervals.','zernike-dept','zernike-dept/eels-edge-id','v1.2.7',337,8120,'BSD-3-Clause','python 3.11','identify_edges','Spectrum analysis',ARRAY['core-loss','elnes','oxidation'],'2026-05-14',now()),
('stem-drift-lock','stem-drift-lock','STEM','MCP server','Closed-loop drift correction for long atomic-resolution acquisitions.','Estimates specimen drift between scan frames and issues stage/scan-shift corrections, keeping atomic-resolution STEM acquisitions locked over multi-hour sessions.','atomscope','atomscope/stem-drift-lock','v0.6.1',295,6410,'MIT','python 3.11','lock_drift','Alignment & drift',ARRAY['drift','scan-shift','haadf'],'2026-06-08',now()),
('tomo-align','tomo-align','TEM','SKILL.md','Fiducial-free tilt-series alignment with confidence-weighted reconstruction.','Aligns tilt series without fiducials using patch tracking, then reconstructs a 3D volume with per-voxel confidence maps for downstream segmentation.','helix-imaging','helix-imaging/tomo-align','v3.0.4',704,25610,'Apache-2.0','python 3.10','align_tilt_series','Tilt series / tomography',ARRAY['tomography','patch-track','3d'],'2026-02-22',now()),
('grid-atlas-qc','grid-atlas-qc','cryo-EM','MCP server','Ice-thickness estimation and automated grid-square quality triage.','Scores grid squares and foil holes from an atlas montage, estimating ice thickness and contamination to produce a ranked acquisition queue for automated data collection.','volvox-lab','volvox-lab/grid-atlas-qc','v1.5.0',512,14980,'MIT','python 3.11','score_atlas','Image acquisition',ARRAY['atlas','ice','triage'],'2026-05-30',now()),
('scalebar-calibrate','scalebar-calibrate','SEM','SKILL.md','Magnification calibration against certified cross-grating standards.','Calibrates magnification and pixel size against certified cross-grating standards, producing a drift-corrected calibration record suitable for audit trails.','metrolab','metrolab/scalebar-calibrate','v1.0.2',188,5230,'MIT','node 20','calibrate_scale','Calibration',ARRAY['magnification','standard','audit'],'2026-01-30',now()),
('particle-picker','particle-picker','cryo-EM','MCP server','Template-free particle picking tuned for low signal-to-noise micrographs.','Template-free particle picking with a denoising front-end for low signal-to-noise micrographs. Emits coordinate star files and per-pick confidence.','nano-science-inst','nano-science-inst/particle-picker','v2.0.0',933,37110,'MIT','python 3.11','pick_particles','Segmentation',ARRAY['picking','denoise','star'],'2026-06-11',now()),
('lattice-dspacing','lattice-dspacing','STEM','SKILL.md','Bayesian d-spacing measurement and lattice fitting from HRSTEM images.','Measures d-spacings and fits atomic lattices from high-resolution STEM images using Bayesian inference, reporting posterior intervals for each lattice parameter.','atomscope','atomscope/lattice-dspacing','v1.4.3',421,11260,'BSD-3-Clause','python 3.10','fit_lattice','Reconstruction',ARRAY['lattice','dspacing','bayesian'],'2026-04-07',now());
