/**
 * Reference data loader for notable-flag matching.
 *
 * Data source attribution:
 * Reference list structure/content adapted from
 * github/DGA-Research/FEC_Coder_Project_Streamlit (Databases/*.csv).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_ATTRIBUTION =
  'github/DGA-Research/FEC_Coder_Project_Streamlit (Databases/*.csv)';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const referenceDir = path.resolve(moduleDir, '../../resources/reference-lists');

export interface LpacRecord {
  committeeId: string;
  shortName: string;
  officialName: string;
  sponsor: string;
}

export interface IndustryRecord {
  committeeId: string;
  committeeName: string;
  orgType: string;
  smallerCategory: string;
  largerCategory: string;
  connectedOrganization: string;
}

export interface BadGroupRecord {
  committeeId: string;
  committeeName: string;
  flag: string;
}

export interface CommitteeContextRecord {
  committeeId: string;
  committeeName: string;
  orgType: string;
  connectedOrgName: string;
  party: string;
}

export interface ReferenceData {
  attribution: string;
  lpac: LpacRecord[];
  industry: IndustryRecord[];
  badGroups: BadGroupRecord[];
  committees: CommitteeContextRecord[];
}

let referenceDataCache: ReferenceData | null = null;

function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === ',') {
      row.push(field.trim());
      field = '';
      continue;
    }

    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && next === '\n') {
        i++;
      }

      if (field.length > 0 || row.length > 0) {
        row.push(field.trim());
        rows.push(row);
        row = [];
        field = '';
      }
      continue;
    }

    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  return rows;
}

function readCsv(fileName: string): Array<Record<string, string>> {
  const fullPath = path.join(referenceDir, fileName);
  const raw = readFileSync(fullPath, 'utf8');
  const matrix = parseCsv(raw);
  if (matrix.length === 0) {
    return [];
  }

  const headers = matrix[0].map(normalizeHeader);
  const records: Array<Record<string, string>> = [];

  for (const row of matrix.slice(1)) {
    const record: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      record[headers[i]] = row[i] || '';
    }

    const hasAnyValue = Object.values(record).some((value) => value.trim().length > 0);
    if (hasAnyValue) {
      records.push(record);
    }
  }

  return records;
}

function toLpac(records: Array<Record<string, string>>): LpacRecord[] {
  return records
    .map((row) => ({
      committeeId: row.committee_id || '',
      shortName: row.short_name || '',
      officialName: row.official_lpac_name || '',
      sponsor: row.pac_sponsor_district || '',
    }))
    .filter((row) => row.committeeId || row.officialName || row.shortName);
}

function toIndustry(records: Array<Record<string, string>>): IndustryRecord[] {
  return records
    .map((row) => ({
      committeeId: row.committee_id || '',
      committeeName: row.committee_name || '',
      orgType: row.org_type || '',
      smallerCategory: row.smaller_categories || '',
      largerCategory: row.larger_categories || '',
      connectedOrganization: row.connected_organization || '',
    }))
    .filter((row) => row.committeeId || row.committeeName);
}

function toBadGroups(records: Array<Record<string, string>>): BadGroupRecord[] {
  return records
    .map((row) => ({
      committeeId: row.committee_id || '',
      committeeName: row.committee_name || '',
      flag: row.flag || '',
    }))
    .filter((row) => row.committeeId || row.committeeName);
}

function toCommitteeContext(records: Array<Record<string, string>>): CommitteeContextRecord[] {
  return records
    .map((row) => ({
      committeeId: row.cmte_id || '',
      committeeName: row.cmte_nm || '',
      orgType: row.org_tp || '',
      connectedOrgName: row.connected_org_nm || '',
      party: row.cmte_pty_affiliation || '',
    }))
    .filter((row) => row.committeeId || row.committeeName);
}

export function loadReferenceData(): ReferenceData {
  if (referenceDataCache) {
    return referenceDataCache;
  }

  const lpac = toLpac(readCsv('lpac-master.csv'));
  const industry = toIndustry(readCsv('industry-master.csv'));
  const badGroups = toBadGroups(readCsv('bad-group-master.csv'));
  const committees = toCommitteeContext(readCsv('committee-master.csv'));

  referenceDataCache = {
    attribution: SOURCE_ATTRIBUTION,
    lpac,
    industry,
    badGroups,
    committees,
  };

  return referenceDataCache;
}

export function resetReferenceDataCache(): void {
  referenceDataCache = null;
}
