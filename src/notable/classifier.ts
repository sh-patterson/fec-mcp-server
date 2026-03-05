import type { FECScheduleB, EnrichedReceipt, PACClassification } from '../api/types.js';
import type { ReferenceData } from './reference-data.js';
import {
  type FlagMatch,
  type NotableFlagType,
  getCommitteeContext,
  matchBadGroup,
  matchIndustry,
  matchLpac,
} from './matchers.js';

export interface NotableItem {
  name: string;
  date: string;
  amount: number;
  committee: string;
  flags: FlagMatch[];
}

const FLAG_PRIORITY: Record<NotableFlagType, number> = {
  BAD_GROUP: 1,
  INDUSTRY: 2,
  LPAC: 3,
  KEYWORD_PATTERN: 4,
};

const DISBURSEMENT_KEYWORD_FLAGS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\b(legal|attorney|law firm|compliance counsel)\b/i,
    reason: 'Keyword pattern suggests legal/compliance spending',
  },
  {
    pattern: /\b(consult|strategy|strategies|consulting)\b/i,
    reason: 'Keyword pattern suggests consulting/strategy spend',
  },
  {
    pattern: /\b(media|advertis|broadcast|tv|digital ad|online ad)\b/i,
    reason: 'Keyword pattern suggests media/advertising spend',
  },
  {
    pattern: /\b(poll|research|focus group|survey)\b/i,
    reason: 'Keyword pattern suggests polling/research spend',
  },
  {
    pattern: /\b(reimburse|reimbursement)\b/i,
    reason: 'Keyword pattern suggests reimbursement spend',
  },
  {
    pattern: /\b(hotel|resort|restaurant|airfare|flight|travel|alcohol|gift|gifts)\b/i,
    reason: 'Keyword pattern suggests travel/hospitality/gift spend',
  },
  {
    pattern: /\b(grassroots|field program|canvass|door to door)\b/i,
    reason: 'Keyword pattern suggests grassroots field operations spend',
  },
];

function dedupeFlags(flags: FlagMatch[]): FlagMatch[] {
  const seen = new Set<string>();
  const deduped: FlagMatch[] = [];

  for (const flag of flags) {
    const key = `${flag.type}|${flag.reason}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(flag);
    }
  }

  return deduped;
}

function parseDateValue(dateValue: string): number {
  const parsed = Date.parse(dateValue);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function compareItems(a: NotableItem, b: NotableItem): number {
  const aPriority = a.flags.length > 0 ? Math.min(...a.flags.map((flag) => FLAG_PRIORITY[flag.type])) : 99;
  const bPriority = b.flags.length > 0 ? Math.min(...b.flags.map((flag) => FLAG_PRIORITY[flag.type])) : 99;

  if (aPriority !== bPriority) {
    return aPriority - bPriority;
  }

  if (a.amount !== b.amount) {
    return b.amount - a.amount;
  }

  return parseDateValue(b.date) - parseDateValue(a.date);
}

function inferPacClassificationFlag(pac: PACClassification): FlagMatch | null {
  if (!pac.is_leadership_pac) {
    return null;
  }

  return {
    type: 'LPAC',
    sourceList: 'FEC committee metadata',
    matchBasis: 'context',
    confidence: 95,
    reason: 'FEC committee metadata indicates leadership PAC characteristics',
  };
}

function inferCommitteePatternFlag(name: string): FlagMatch | null {
  const pattern = /\b(FOR CONGRESS|FOR SENATE|FOR PRESIDENT|VICTORY FUND|LEADERSHIP PAC|LEADERSHIP FUND)\b/i;
  if (!pattern.test(name)) {
    return null;
  }

  return {
    type: 'KEYWORD_PATTERN',
    sourceList: 'Heuristic pattern',
    matchBasis: 'context',
    confidence: 85,
    reason: 'Donor name pattern suggests candidate/committee transfer or leadership vehicle',
  };
}

function buildListMatches(
  referenceData: ReferenceData,
  committeeId: string | null | undefined,
  entityName: string,
  fuzzyThreshold: number
): FlagMatch[] {
  const matches: FlagMatch[] = [];

  const badGroup = matchBadGroup({ committeeId, name: entityName }, referenceData.badGroups, fuzzyThreshold);
  if (badGroup) {
    matches.push(badGroup);
  }

  const industry = matchIndustry({ committeeId, name: entityName }, referenceData.industry, fuzzyThreshold);
  if (industry) {
    matches.push(industry);
  }

  const lpac = matchLpac({ committeeId, name: entityName }, referenceData.lpac, fuzzyThreshold);
  if (lpac) {
    matches.push(lpac);
  }

  return matches;
}

export function classifyNotableReceipts(
  receipts: EnrichedReceipt[],
  targetCommittee: string,
  referenceData: ReferenceData,
  fuzzyThreshold: number
): NotableItem[] {
  const findings = receipts.map((receipt) => {
    const flags: FlagMatch[] = buildListMatches(
      referenceData,
      receipt.contributor_committee_id,
      receipt.contributor_name,
      fuzzyThreshold
    );

    const pacFlag = receipt.pac_classification
      ? inferPacClassificationFlag(receipt.pac_classification)
      : null;
    if (pacFlag) {
      flags.push(pacFlag);
    }

    const patternFlag = receipt.contributor_type !== 'Individual'
      ? inferCommitteePatternFlag(receipt.contributor_name)
      : null;
    if (patternFlag) {
      flags.push(patternFlag);
    }

    const context = getCommitteeContext(referenceData, receipt.contributor_committee_id);
    if (context && context.connectedOrgName) {
      flags.push({
        type: 'KEYWORD_PATTERN',
        sourceList: 'Committee Master',
        matchBasis: 'context',
        confidence: 80,
        reason: `Committee Master context found connected organization: ${context.connectedOrgName}`,
      });
    }

    return {
      name: receipt.contributor_name,
      date: receipt.date,
      amount: receipt.amount,
      committee: targetCommittee,
      flags: dedupeFlags(flags),
    } satisfies NotableItem;
  });

  return findings.sort(compareItems);
}

function inferDisbursementKeywordFlags(record: FECScheduleB): FlagMatch[] {
  const sourceText = [
    record.disbursement_description,
    record.disbursement_purpose_category,
    record.recipient_name,
  ]
    .filter(Boolean)
    .join(' ');

  const flags: FlagMatch[] = [];
  for (const keyword of DISBURSEMENT_KEYWORD_FLAGS) {
    if (keyword.pattern.test(sourceText)) {
      flags.push({
        type: 'KEYWORD_PATTERN',
        sourceList: 'Heuristic pattern',
        matchBasis: 'context',
        confidence: 85,
        reason: keyword.reason,
      });
    }
  }

  return dedupeFlags(flags);
}

export function classifyNotableDisbursements(
  disbursements: FECScheduleB[],
  spendingCommittee: string,
  referenceData: ReferenceData,
  fuzzyThreshold: number
): NotableItem[] {
  const findings = disbursements.map((record) => {
    const flags: FlagMatch[] = buildListMatches(
      referenceData,
      record.recipient_committee_id,
      record.recipient_name,
      fuzzyThreshold
    );

    const keywordFlags = inferDisbursementKeywordFlags(record);
    flags.push(...keywordFlags);

    const context = getCommitteeContext(referenceData, record.recipient_committee_id);
    if (context && context.connectedOrgName) {
      flags.push({
        type: 'KEYWORD_PATTERN',
        sourceList: 'Committee Master',
        matchBasis: 'context',
        confidence: 80,
        reason: `Committee Master context found connected organization: ${context.connectedOrgName}`,
      });
    }

    return {
      name: record.recipient_name,
      date: record.disbursement_date,
      amount: record.disbursement_amount,
      committee: spendingCommittee,
      flags: dedupeFlags(flags),
    } satisfies NotableItem;
  });

  return findings.sort(compareItems);
}
