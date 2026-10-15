// Client-safe relevance search for the registry: full-text scoring with
// microscopy synonym expansion and bounded typo tolerance.

/** Minimal skill shape the scorer needs. */
export interface SearchableSkill {
  slug: string;
  name: string;
  technique: string;
  kind: string;
  summary: string;
  description: string;
  category: string;
  org: string;
  toolCall: string;
  tags: string[];
  stars: number;
}

/**
 * Microscopy terminology: each key expands to equivalent surface forms so a
 * query for "tem" also matches "transmission electron microscopy", etc.
 */
const SYNONYMS: Record<string, string[]> = {
  tem: ["transmission electron microscopy", "transmission electron microscope"],
  sem: ["scanning electron microscopy", "scanning electron microscope"],
  stem: ["scanning transmission electron microscopy", "scanning transmission"],
  eds: ["edx", "energy dispersive x ray", "energy dispersive spectroscopy", "xray"],
  edx: ["eds", "energy dispersive x ray", "energy dispersive spectroscopy", "xray"],
  eels: ["electron energy loss spectroscopy", "energy loss"],
  eftem: ["energy filtered", "energy filtered transmission electron microscopy"],
  cryoem: ["cryo em", "cryo electron microscopy", "single particle", "single particle analysis"],
  "cryo-em": ["cryoem", "cryo electron microscopy", "single particle", "single particle analysis"],
  fib: ["focused ion beam", "fib sem", "fibsem"],
  fibsem: ["fib sem", "focused ion beam", "fib"],
  saed: ["selected area electron diffraction", "electron diffraction", "diffraction pattern"],
  ebsd: ["electron backscatter diffraction", "backscatter"],
  cl: ["cathodoluminescence"],
  ebic: ["electron beam induced current"],
  "4dstem": ["4d stem", "four dimensional stem", "diffraction imaging"],
  ptychography: ["ptychographic", "phase retrieval"],
  holography: ["electron holography", "off axis holography"],
  tomography: ["electron tomography", "tomographic reconstruction", "tilt series"],
  in_situ: ["in situ", "insitu", "operando"],
  operando: ["in situ", "in-situ"],
  alignment: ["beam alignment", "astigmatism", "coma free"],
  drift: ["drift correction", "drift corrected"],
  denoising: ["denoise", "noise reduction"],
  segmentation: ["segment", "semantic segmentation", "instance segmentation"],
  micrograph: ["image", "microscopy image"],
  lattice: ["crystal lattice", "atomic lattice"],
  hr: ["high resolution", "hrtem", "hrsem"],
  hrtem: ["high resolution tem", "high resolution transmission electron microscopy", "hr tem"],
  xrd: ["x ray diffraction"],
  eels2: [],
  aberration: ["aberration corrected", "probe corrected", "cs corrected"],
  "cs-corrected": ["aberration corrected", "probe corrected"],
  vacuum: ["uhv", "ultra high vacuum"],
  uhv: ["ultra high vacuum"],
  spm: ["scanning probe microscopy"],
  afm: ["atomic force microscopy", "atomic force microscope"],
  diffraction: ["electron diffraction", "saed", "diffraction pattern"],
  spectrum: ["spectra", "spectroscopy"],
  spectra: ["spectrum", "spectroscopy"],
  imaging: ["image", "micrograph"],
};

/** Damerau–Levenshtein distance with an early cutoff at `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = new Array<number>(b.length + 1);
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0]!;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2]! + cost);
      }
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) {
      prev2[j] = prev[j]!;
      prev[j] = curr[j]!;
    }
  }
  return prev[b.length]!;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/[^a-z0-9\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text).split(" ").filter((t) => t.length > 0);
}

/** All surface forms for one query token (itself + known synonyms, normalized). */
function expandToken(token: string): string[] {
  const forms = new Set<string>([token]);
  const syns = SYNONYMS[token];
  if (syns) for (const s of syns) for (const t of tokenize(s)) forms.add(t);
  return [...forms];
}

/** How well a query token matches one candidate word: 1 exact, 0.85 prefix, fuzzy otherwise. */
function tokenScore(term: string, candidate: string): number {
  if (candidate === term) return 1;
  if (candidate.startsWith(term) || term.startsWith(candidate)) return 0.85;
  const budget = term.length <= 3 ? 0 : term.length <= 6 ? 1 : 2;
  if (budget === 0) return 0;
  const d = editDistance(term, candidate, budget);
  if (d > budget) return 0;
  return d === 1 ? 0.7 : 0.55;
}

/** Best score of a query token against a whole field's tokens. */
function fieldScore(terms: string[], fieldTokens: string[]): number {
  let best = 0;
  for (const term of terms) {
    for (const cand of fieldTokens) {
      const s = tokenScore(term, cand);
      if (s > best) best = s;
      if (best === 1) return 1;
    }
  }
  return best;
}

const FIELD_WEIGHTS = {
  name: 10,
  toolCall: 8,
  technique: 6,
  tags: 6,
  category: 4,
  org: 3,
  summary: 2,
  description: 1,
} as const;

/**
 * Relevance score for one skill against a query. Returns 0 for no match.
 * Every query token must match *some* field (AND semantics), with synonyms
 * and typos counting as weaker matches.
 */
export function scoreSkill(skill: SearchableSkill, query: string): number {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return 0;

  const fields: [number, string[]][] = [
    [FIELD_WEIGHTS.name, tokenize(skill.name)],
    [FIELD_WEIGHTS.toolCall, tokenize(skill.toolCall)],
    [FIELD_WEIGHTS.technique, tokenize(skill.technique)],
    [FIELD_WEIGHTS.tags, skill.tags.flatMap((t) => tokenize(t))],
    [FIELD_WEIGHTS.category, tokenize(skill.category)],
    [FIELD_WEIGHTS.org, tokenize(skill.org)],
    [FIELD_WEIGHTS.summary, tokenize(skill.summary)],
    [FIELD_WEIGHTS.description, tokenize(skill.description)],
  ];

  let score = 0;
  for (const qt of queryTokens) {
    const variants = expandToken(qt);
    let tokenBest = 0;
    for (const [weight, fieldTokens] of fields) {
      const s = fieldScore(variants, fieldTokens) * weight;
      if (s > tokenBest) tokenBest = s;
    }
    if (tokenBest === 0) return 0; // AND semantics: every term must hit somewhere
    score += tokenBest;
  }

  // Exact phrase bonus against the name and full text blob.
  const phrase = normalize(query);
  if (phrase.length > 2 && normalize(skill.name).includes(phrase)) score += 8;

  // Small popularity prior so near-ties break toward established skills.
  score += Math.min(2, Math.log10(skill.stars + 1) * 0.5);
  return score;
}
