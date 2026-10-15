export type Technique = "SEM" | "TEM" | "STEM" | "EDS" | "EELS" | "cryo-EM" | "FIB";

export type Skill = {
  slug: string;
  name: string;
  technique: Technique;
  kind: "SKILL.md" | "MCP server";
  summary: string;
  description: string;
  org: string;
  repo: string;
  version: string;
  updated: string;
  stars: number;
  downloads: number;
  license: string;
  runtime: string;
  toolCall: string;
  category: string;
  tags: string[];
  verifiedBadge?: string;
  mcpEndpoint?: string | null;
  /** AI quality scores (0..1 each), null until scored. */
  quality?: { docs: number; examples: number; safety: number; overall: number } | null;
};

export const techniques: { code: Technique; count: number; note: string }[] = [
  { code: "SEM", count: 214, note: "surface & topography" },
  { code: "TEM", count: 189, note: "transmission imaging" },
  { code: "STEM", count: 141, note: "scanned probe" },
  { code: "EDS", count: 96, note: "elemental spectra" },
  { code: "EELS", count: 73, note: "energy loss" },
  { code: "cryo-EM", count: 302, note: "vitrified specimens" },
  { code: "FIB", count: 58, note: "ion milling" },
];

export const categories = [
  { name: "Image acquisition", count: 238 },
  { name: "Segmentation", count: 312 },
  { name: "Calibration", count: 97 },
  { name: "Spectrum analysis", count: 164 },
  { name: "Alignment & drift", count: 88 },
  { name: "Tilt series / tomography", count: 71 },
  { name: "Reconstruction", count: 129 },
];

export const skills: Skill[] = [
  {
    slug: "cryo2d-classify",
    name: "cryo2d-classify",
    technique: "cryo-EM",
    kind: "MCP server",
    summary:
      "Reference-free 2D classification of particle micrographs with a motion-correction pre-pass.",
    description:
      "Reference-free 2D classification of cryo-EM particle micrographs. Includes motion correction, contrast transfer estimation, and clustering with configurable binning and angular sampling. Exposes a typed MCP toolset for batch runs against a session directory.",
    org: "volvox-lab",
    repo: "volvox-lab/cryo2d",
    version: "v2.4.1",
    updated: "2026-06-02",
    stars: 1204,
    downloads: 48910,
    license: "MIT",
    runtime: "python 3.11",
    toolCall: "2d_classify",
    category: "Segmentation",
    tags: ["2d", "cluster", "ctf"],
  },
  {
    slug: "edax-phase-map",
    name: "edax-phase-map",
    technique: "EDS",
    kind: "MCP server",
    summary: "Phase mapping from dispersive spectra with peak deconvolution and ZAF correction.",
    description:
      "Super-resolution phase mapping from energy dispersive spectra. Performs automatic peak deconvolution, background subtraction, and ZAF quantification, returning per-pixel elemental fractions plus a labelled phase map.",
    org: "quanta-research",
    repo: "quanta-research/edax-phase-map",
    version: "v1.9.0",
    updated: "2026-05-28",
    stars: 876,
    downloads: 31204,
    license: "MIT",
    runtime: "python 3.10",
    toolCall: "phase_map",
    category: "Spectrum analysis",
    tags: ["eds", "quant", "zaf"],
  },
  {
    slug: "ctf-fitter",
    name: "ctf-fitter",
    technique: "TEM",
    kind: "SKILL.md",
    summary: "Per-tilt CTF estimation and refinement with amorphous-carbon reference subtraction.",
    description:
      "Per-tilt contrast transfer function estimation and refinement for TEM diffraction patterns. Handles amorphous-carbon reference subtraction, astigmatism fitting, and defocus drift across a tilt series.",
    org: "helix-imaging",
    repo: "helix-imaging/ctf-fitter",
    version: "v3.1.2",
    updated: "2026-06-05",
    stars: 642,
    downloads: 22780,
    license: "Apache-2.0",
    runtime: "python 3.11",
    toolCall: "fit_ctf",
    category: "Calibration",
    tags: ["ctf", "defocus", "tilt"],
  },
  {
    slug: "fib-mill-seg",
    name: "fib-mill-seg",
    technique: "FIB",
    kind: "MCP server",
    summary: "Mill-volume segmentation and lift-out path planning for serial sectioning.",
    description:
      "Segments the mill volume from live FIB imagery and plans a lift-out path for serial-sectioning workflows, including lamella thickness targets and redeposition avoidance.",
    org: "mesa-nano",
    repo: "mesa-nano/fib-mill-seg",
    version: "v0.8.3",
    updated: "2026-04-19",
    stars: 411,
    downloads: 9840,
    license: "MIT",
    runtime: "python 3.11",
    toolCall: "plan_liftout",
    category: "Segmentation",
    tags: ["lamella", "liftout", "planning"],
  },
  {
    slug: "sem-topography",
    name: "sem-topography",
    technique: "SEM",
    kind: "SKILL.md",
    summary: "3D surface relief reconstruction from four-quadrant backscattered stacks.",
    description:
      "Reconstructs 3D surface relief from four-quadrant backscattered electron stacks, returning a height field with per-pixel confidence and roughness statistics.",
    org: "surfacelab",
    repo: "surfacelab/sem-topography",
    version: "v2.4.0",
    updated: "2026-03-11",
    stars: 588,
    downloads: 17420,
    license: "MIT",
    runtime: "python 3.10",
    toolCall: "reconstruct_relief",
    category: "Reconstruction",
    tags: ["bse", "height", "roughness"],
  },
  {
    slug: "eels-edge-id",
    name: "eels-edge-id",
    technique: "EELS",
    kind: "MCP server",
    summary: "Core-loss edge identification and oxidation-state fingerprinting.",
    description:
      "Identifies core-loss edges in EELS spectra, fits fine structure, and fingerprints oxidation states against a reference library. Returns candidate assignments with confidence intervals.",
    org: "zernike-dept",
    repo: "zernike-dept/eels-edge-id",
    version: "v1.2.7",
    updated: "2026-05-14",
    stars: 337,
    downloads: 8120,
    license: "BSD-3-Clause",
    runtime: "python 3.11",
    toolCall: "identify_edges",
    category: "Spectrum analysis",
    tags: ["core-loss", "elnes", "oxidation"],
  },
  {
    slug: "stem-drift-lock",
    name: "stem-drift-lock",
    technique: "STEM",
    kind: "MCP server",
    summary: "Closed-loop drift correction for long atomic-resolution acquisitions.",
    description:
      "Estimates specimen drift between scan frames and issues stage/scan-shift corrections, keeping atomic-resolution STEM acquisitions locked over multi-hour sessions.",
    org: "atomscope",
    repo: "atomscope/stem-drift-lock",
    version: "v0.6.1",
    updated: "2026-06-08",
    stars: 295,
    downloads: 6410,
    license: "MIT",
    runtime: "python 3.11",
    toolCall: "lock_drift",
    category: "Alignment & drift",
    tags: ["drift", "scan-shift", "haadf"],
  },
  {
    slug: "tomo-align",
    name: "tomo-align",
    technique: "TEM",
    kind: "SKILL.md",
    summary: "Fiducial-free tilt-series alignment with confidence-weighted reconstruction.",
    description:
      "Aligns tilt series without fiducials using patch tracking, then reconstructs a 3D volume with per-voxel confidence maps for downstream segmentation.",
    org: "helix-imaging",
    repo: "helix-imaging/tomo-align",
    version: "v3.0.4",
    updated: "2026-02-22",
    stars: 704,
    downloads: 25610,
    license: "Apache-2.0",
    runtime: "python 3.10",
    toolCall: "align_tilt_series",
    category: "Tilt series / tomography",
    tags: ["tomography", "patch-track", "3d"],
  },
  {
    slug: "grid-atlas-qc",
    name: "grid-atlas-qc",
    technique: "cryo-EM",
    kind: "MCP server",
    summary: "Ice-thickness estimation and automated grid-square quality triage.",
    description:
      "Scores grid squares and foil holes from an atlas montage, estimating ice thickness and contamination to produce a ranked acquisition queue for automated data collection.",
    org: "volvox-lab",
    repo: "volvox-lab/grid-atlas-qc",
    version: "v1.5.0",
    updated: "2026-05-30",
    stars: 512,
    downloads: 14980,
    license: "MIT",
    runtime: "python 3.11",
    toolCall: "score_atlas",
    category: "Image acquisition",
    tags: ["atlas", "ice", "triage"],
  },
  {
    slug: "scalebar-calibrate",
    name: "scalebar-calibrate",
    technique: "SEM",
    kind: "SKILL.md",
    summary: "Magnification calibration against certified cross-grating standards.",
    description:
      "Calibrates magnification and pixel size against certified cross-grating standards, producing a drift-corrected calibration record suitable for audit trails.",
    org: "metrolab",
    repo: "metrolab/scalebar-calibrate",
    version: "v1.0.2",
    updated: "2026-01-30",
    stars: 188,
    downloads: 5230,
    license: "MIT",
    runtime: "node 20",
    toolCall: "calibrate_scale",
    category: "Calibration",
    tags: ["magnification", "standard", "audit"],
  },
  {
    slug: "particle-picker",
    name: "particle-picker",
    technique: "cryo-EM",
    kind: "MCP server",
    summary: "Template-free particle picking tuned for low signal-to-noise micrographs.",
    description:
      "Template-free particle picking with a denoising front-end for low signal-to-noise micrographs. Emits coordinate star files and per-pick confidence.",
    org: "nano-science-inst",
    repo: "nano-science-inst/particle-picker",
    version: "v2.0.0",
    updated: "2026-06-11",
    stars: 933,
    downloads: 37110,
    license: "MIT",
    runtime: "python 3.11",
    toolCall: "pick_particles",
    category: "Segmentation",
    tags: ["picking", "denoise", "star"],
  },
  {
    slug: "lattice-dspacing",
    name: "lattice-dspacing",
    technique: "STEM",
    kind: "SKILL.md",
    summary: "Bayesian d-spacing measurement and lattice fitting from HRSTEM images.",
    description:
      "Measures d-spacings and fits atomic lattices from high-resolution STEM images using Bayesian inference, reporting posterior intervals for each lattice parameter.",
    org: "atomscope",
    repo: "atomscope/lattice-dspacing",
    version: "v1.4.3",
    updated: "2026-04-07",
    stars: 421,
    downloads: 11260,
    license: "BSD-3-Clause",
    runtime: "python 3.10",
    toolCall: "fit_lattice",
    category: "Reconstruction",
    tags: ["lattice", "dspacing", "bayesian"],
  },
];

export function getSkill(slug: string) {
  return skills.find((s) => s.slug === slug);
}

export const registryStats = {
  skills: 1284,
  servers: 312,
  techniques: techniques.length,
};
