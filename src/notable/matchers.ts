import type {
  BadGroupRecord,
  IndustryRecord,
  LpacRecord,
  ReferenceData,
  CommitteeContextRecord,
} from './reference-data.js';

export type NotableFlagType = 'BAD_GROUP' | 'INDUSTRY' | 'LPAC' | 'KEYWORD_PATTERN';
export type MatchBasis = 'committee_id' | 'exact_name' | 'fuzzy_name' | 'context';

export interface FlagMatch {
  type: NotableFlagType;
  sourceList: string;
  matchBasis: MatchBasis;
  confidence: number;
  reason: string;
}

export interface MatchInput {
  committeeId?: string | null;
  name?: string | null;
}

interface NameCandidate<T> {
  value: string;
  entry: T;
}

const NAME_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bPOLITICAL ACTION COMMITTEE\b/g, 'PAC'],
  [/\bPOL ACTION COMMITTEE\b/g, 'PAC'],
  [/\bPOLITICAL ACTION\b/g, 'PAC'],
  [/\bCORPORATION\b/g, 'CORP'],
  [/\bINCORPORATED\b/g, 'INC'],
  [/\bCOMPANY\b/g, 'CO'],
  [/\bASSOCIATION\b/g, 'ASSOC'],
  [/\bCOMMITTEE\b/g, 'COM'],
  [/\bLIMITED LIABILITY COMPANY\b/g, 'LLC'],
  [/\bLIMITED LIABILITY COM\b/g, 'LLC'],
  [/\bPAC,\b/g, 'PAC'],
];

const NON_ALNUM = /[^A-Z0-9\s]/g;
const MULTI_SPACE = /\s+/g;

export function normalizeName(name: string): string {
  let normalized = name.toUpperCase().trim();

  for (const [pattern, replacement] of NAME_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(NON_ALNUM, ' ').replace(MULTI_SPACE, ' ').trim();
}

function tokenize(value: string): Set<string> {
  return new Set(value.split(' ').filter(Boolean));
}

function jaccardSimilarity(a: string, b: string): number {
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);
  if (aTokens.size === 0 || bTokens.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) {
      intersection++;
    }
  }

  const union = aTokens.size + bTokens.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) {
    return 0;
  }

  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= b.length; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[a.length][b.length];
}

function fuzzyConfidencePercent(a: string, b: string): number {
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) {
    return 0;
  }

  const jaccard = jaccardSimilarity(a, b);
  const levenshtein = 1 - levenshteinDistance(a, b) / maxLength;
  return Math.round(Math.max(jaccard, levenshtein) * 100);
}

function findBestFuzzyMatch<T>(
  normalizedTargetName: string,
  candidates: Array<NameCandidate<T>>,
  threshold: number
): { entry: T; value: string; confidence: number } | null {
  let best: { entry: T; value: string; confidence: number } | null = null;

  for (const candidate of candidates) {
    const confidence = fuzzyConfidencePercent(normalizedTargetName, normalizeName(candidate.value));
    if (confidence < threshold) {
      continue;
    }

    if (!best || confidence > best.confidence) {
      best = {
        entry: candidate.entry,
        value: candidate.value,
        confidence,
      };
    }
  }

  return best;
}

function idEquals(a?: string | null, b?: string | null): boolean {
  if (!a || !b) {
    return false;
  }
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

export function matchLpac(
  input: MatchInput,
  records: LpacRecord[],
  fuzzyThreshold: number
): FlagMatch | null {
  const committeeId = input.committeeId?.trim();
  const targetName = input.name?.trim();

  if (committeeId) {
    const idMatch = records.find((record) => idEquals(record.committeeId, committeeId));
    if (idMatch) {
      return {
        type: 'LPAC',
        sourceList: 'LPAC Master',
        matchBasis: 'committee_id',
        confidence: 100,
        reason: `Matched LPAC Master by committee_id ${committeeId}`,
      };
    }
  }

  if (!targetName) {
    return null;
  }

  const normalizedTarget = normalizeName(targetName);
  for (const record of records) {
    const names = [record.officialName, record.shortName].filter(Boolean);
    for (const name of names) {
      if (normalizeName(name) === normalizedTarget) {
        return {
          type: 'LPAC',
          sourceList: 'LPAC Master',
          matchBasis: 'exact_name',
          confidence: 99,
          reason: `Matched LPAC Master by normalized name (${name})`,
        };
      }
    }
  }

  const candidates: Array<NameCandidate<LpacRecord>> = [];
  for (const record of records) {
    if (record.officialName) {
      candidates.push({ value: record.officialName, entry: record });
    }
    if (record.shortName) {
      candidates.push({ value: record.shortName, entry: record });
    }
  }

  const fuzzy = findBestFuzzyMatch(normalizedTarget, candidates, fuzzyThreshold);
  if (!fuzzy) {
    return null;
  }

  return {
    type: 'LPAC',
    sourceList: 'LPAC Master',
    matchBasis: 'fuzzy_name',
    confidence: fuzzy.confidence,
    reason: `Fuzzy name match to LPAC Master (${fuzzy.value}, ${fuzzy.confidence}% confidence)`,
  };
}

export function matchIndustry(
  input: MatchInput,
  records: IndustryRecord[],
  fuzzyThreshold: number
): FlagMatch | null {
  const committeeId = input.committeeId?.trim();
  const targetName = input.name?.trim();

  if (committeeId) {
    const idMatch = records.find((record) => idEquals(record.committeeId, committeeId));
    if (idMatch) {
      const category = idMatch.largerCategory || 'Uncategorized industry';
      return {
        type: 'INDUSTRY',
        sourceList: 'Industry Master',
        matchBasis: 'committee_id',
        confidence: 100,
        reason: `Matched Industry Master by committee_id ${committeeId} (${category})`,
      };
    }
  }

  if (!targetName) {
    return null;
  }

  const normalizedTarget = normalizeName(targetName);
  for (const record of records) {
    if (normalizeName(record.committeeName) === normalizedTarget) {
      const category = record.largerCategory || 'Uncategorized industry';
      return {
        type: 'INDUSTRY',
        sourceList: 'Industry Master',
        matchBasis: 'exact_name',
        confidence: 99,
        reason: `Matched Industry Master by normalized name (${category})`,
      };
    }
  }

  const candidates = records
    .filter((record) => Boolean(record.committeeName))
    .map((record) => ({ value: record.committeeName, entry: record }));

  const fuzzy = findBestFuzzyMatch(normalizedTarget, candidates, fuzzyThreshold);
  if (!fuzzy) {
    return null;
  }

  const category = fuzzy.entry.largerCategory || 'Uncategorized industry';
  return {
    type: 'INDUSTRY',
    sourceList: 'Industry Master',
    matchBasis: 'fuzzy_name',
    confidence: fuzzy.confidence,
    reason: `Fuzzy name match to Industry Master (${category}, ${fuzzy.confidence}% confidence)`,
  };
}

export function matchBadGroup(
  input: MatchInput,
  records: BadGroupRecord[],
  fuzzyThreshold: number
): FlagMatch | null {
  const committeeId = input.committeeId?.trim();
  const targetName = input.name?.trim();

  if (committeeId) {
    const idMatch = records.find((record) => idEquals(record.committeeId, committeeId));
    if (idMatch) {
      const detail = idMatch.flag || 'Flagged committee group';
      return {
        type: 'BAD_GROUP',
        sourceList: 'Bad Group Master',
        matchBasis: 'committee_id',
        confidence: 100,
        reason: `Matched Bad Group Master by committee_id ${committeeId} (${detail})`,
      };
    }
  }

  if (!targetName) {
    return null;
  }

  const normalizedTarget = normalizeName(targetName);
  for (const record of records) {
    if (normalizeName(record.committeeName) === normalizedTarget) {
      const detail = record.flag || 'Flagged committee group';
      return {
        type: 'BAD_GROUP',
        sourceList: 'Bad Group Master',
        matchBasis: 'exact_name',
        confidence: 99,
        reason: `Matched Bad Group Master by normalized name (${detail})`,
      };
    }
  }

  const candidates = records
    .filter((record) => Boolean(record.committeeName))
    .map((record) => ({ value: record.committeeName, entry: record }));

  const fuzzy = findBestFuzzyMatch(normalizedTarget, candidates, fuzzyThreshold);
  if (!fuzzy) {
    return null;
  }

  const detail = fuzzy.entry.flag || 'Flagged committee group';
  return {
    type: 'BAD_GROUP',
    sourceList: 'Bad Group Master',
    matchBasis: 'fuzzy_name',
    confidence: fuzzy.confidence,
    reason: `Fuzzy name match to Bad Group Master (${detail}, ${fuzzy.confidence}% confidence)`,
  };
}

export function getCommitteeContext(
  referenceData: ReferenceData,
  committeeId?: string | null
): CommitteeContextRecord | null {
  if (!committeeId) {
    return null;
  }

  const found = referenceData.committees.find((record) =>
    idEquals(record.committeeId, committeeId)
  );

  return found || null;
}
