import { createHash } from 'node:crypto';
import type {
  FECCursorScalar,
  FECKeysetIndexes,
  FECKeysetPagination,
  FECPagination,
} from '../api/types.js';
import { FECApiError, ValidationError } from '../utils/errors.js';

const TOKEN_PREFIX = 'fecp1.';
const TOKEN_VERSION = 1;
const MAX_TOKEN_BYTES = 2048;
const MAX_CURSOR_STRING_LENGTH = 512;

export const CONTINUATION_TOOLS = [
  'search_candidates',
  'get_receipts',
  'get_disbursements',
  'get_independent_expenditures',
  'search_donors',
  'search_spending',
] as const;

export type ContinuationTool = (typeof CONTINUATION_TOOLS)[number];

export type ContinuationCursor =
  | { kind: 'page'; page: number }
  | { kind: 'keyset'; values: KeysetCursorValues };

export type KeysetCursorValues = Record<string, FECCursorScalar> & {
  last_index: string | number;
};

export type ResultCount =
  | { status: 'exact'; value: number }
  | { status: 'approximate'; value: number }
  | { status: 'unspecified'; reportedValue?: number };

export type PaginationState =
  | {
      kind: 'page';
      count: ResultCount;
      page: number;
      pages: number;
      perPage: number;
      nextPage: number | null;
    }
  | {
      kind: 'keyset';
      count: ResultCount;
      perPage: number;
      nextValues: FECKeysetIndexes | null;
    };

interface TokenPayload {
  v: number;
  tool: string;
  filter_hash: string;
  cursor: unknown;
}

interface EncodeContinuationOptions {
  tool: ContinuationTool;
  effectiveFilters: Record<string, unknown>;
  cursor: ContinuationCursor;
}

interface DecodeContinuationBase {
  token: string;
  tool: ContinuationTool;
  effectiveFilters: Record<string, unknown>;
}

interface DecodePageContinuationOptions extends DecodeContinuationBase {
  cursorKind: 'page';
}

interface DecodeKeysetContinuationOptions extends DecodeContinuationBase {
  cursorKind: 'keyset';
  allowedKeysetKeys?: readonly string[];
  requiredKeysetKeys?: readonly string[];
}

type DecodeContinuationOptions =
  | DecodePageContinuationOptions
  | DecodeKeysetContinuationOptions;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isContinuationTool(value: unknown): value is ContinuationTool {
  return typeof value === 'string' && CONTINUATION_TOOLS.some((tool) => tool === value);
}

function normalizeJson(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ValidationError('Continuation filters contain an invalid number.', 'continuation');
    }
    return value;
  }
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJson(item));
  }
  if (isRecord(value)) {
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const item = normalizeJson(value[key]);
      if (item !== undefined) {
        normalized[key] = item;
      }
    }
    return normalized;
  }
  throw new ValidationError('Continuation filters contain an unsupported value.', 'continuation');
}

function hashFilters(effectiveFilters: Record<string, unknown>): string {
  return createHash('sha256')
    .update(JSON.stringify(normalizeJson(effectiveFilters)))
    .digest('hex');
}

function isCursorScalar(value: unknown): value is FECCursorScalar {
  if (typeof value === 'string') {
    return value.length > 0 && value.length <= MAX_CURSOR_STRING_LENGTH;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  return typeof value === 'boolean';
}

function validatePageCursor(value: unknown): { kind: 'page'; page: number } {
  if (
    !isRecord(value) ||
    value.kind !== 'page' ||
    !Number.isSafeInteger(value.page) ||
    (value.page as number) < 1
  ) {
    throw new ValidationError('Continuation token contains an invalid page cursor.', 'continuation');
  }
  return { kind: 'page', page: value.page as number };
}

export function validateKeysetValues(
  value: unknown,
  allowedKeys?: readonly string[],
  requiredKeys: readonly string[] = ['last_index']
): KeysetCursorValues {
  if (!isRecord(value)) {
    throw new ValidationError('Continuation token contains an invalid keyset cursor.', 'continuation');
  }
  const keys = Object.keys(value);
  if (keys.length === 0 || keys.length > 8) {
    throw new ValidationError('Continuation token contains an invalid keyset cursor.', 'continuation');
  }
  if (allowedKeys && keys.some((key) => !allowedKeys.includes(key))) {
    throw new ValidationError('Continuation token contains a cursor for a different route.', 'continuation');
  }
  if (requiredKeys.some((key) => !keys.includes(key))) {
    throw new ValidationError('Continuation token is missing a required cursor value.', 'continuation');
  }

  const values: Record<string, FECCursorScalar> = {};
  for (const key of keys) {
    const item = value[key];
    if (!isCursorScalar(item)) {
      throw new ValidationError('Continuation token contains an invalid cursor value.', 'continuation');
    }
    values[key] = item;
  }

  const lastIndex = values.last_index;
  if (
    (typeof lastIndex === 'number' && (!Number.isSafeInteger(lastIndex) || lastIndex < 0)) ||
    (typeof lastIndex !== 'number' && typeof lastIndex !== 'string')
  ) {
    throw new ValidationError('Continuation token contains an invalid last_index.', 'continuation');
  }
  return values as KeysetCursorValues;
}

export function validateOpenFecKeysetValues(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[]
): KeysetCursorValues {
  try {
    return validateKeysetValues(value, allowedKeys, requiredKeys);
  } catch {
    throw new FECApiError('OpenFEC returned invalid keyset pagination metadata.');
  }
}

/**
 * Prefer returning the current page with no continuation over failing the whole tool
 * when OpenFEC sends incomplete keyset metadata.
 */
export function tryValidateOpenFecKeysetValues(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[]
): KeysetCursorValues | null {
  try {
    return validateOpenFecKeysetValues(value, allowedKeys, requiredKeys);
  } catch {
    return null;
  }
}

function validateKeysetCursor(
  value: unknown,
  allowedKeys?: readonly string[],
  requiredKeys?: readonly string[]
): { kind: 'keyset'; values: KeysetCursorValues } {
  if (!isRecord(value) || value.kind !== 'keyset') {
    throw new ValidationError('Continuation token contains an invalid keyset cursor.', 'continuation');
  }
  return {
    kind: 'keyset',
    values: validateKeysetValues(value.values, allowedKeys, requiredKeys),
  };
}

function validateCursor(
  value: unknown,
  kind: ContinuationCursor['kind'],
  allowedKeys?: readonly string[],
  requiredKeys?: readonly string[]
): ContinuationCursor {
  return kind === 'page'
    ? validatePageCursor(value)
    : validateKeysetCursor(value, allowedKeys, requiredKeys);
}

export function encodeContinuationToken(options: EncodeContinuationOptions): string {
  const cursor = validateCursor(options.cursor, options.cursor.kind);
  const payload: TokenPayload = {
    v: TOKEN_VERSION,
    tool: options.tool,
    filter_hash: hashFilters(options.effectiveFilters),
    cursor,
  };
  const token = `${TOKEN_PREFIX}${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}`;
  if (Buffer.byteLength(token, 'utf8') > MAX_TOKEN_BYTES) {
    throw new ValidationError('Continuation token exceeds the size limit.', 'continuation');
  }
  return token;
}

export function decodeContinuationToken(
  options: DecodePageContinuationOptions
): Extract<ContinuationCursor, { kind: 'page' }>;
export function decodeContinuationToken(
  options: DecodeKeysetContinuationOptions
): Extract<ContinuationCursor, { kind: 'keyset' }>;
export function decodeContinuationToken(options: DecodeContinuationOptions): ContinuationCursor {
  if (
    typeof options.token !== 'string' ||
    Buffer.byteLength(options.token, 'utf8') > MAX_TOKEN_BYTES ||
    !options.token.startsWith(TOKEN_PREFIX)
  ) {
    throw new ValidationError('Continuation token has an invalid size or prefix.', 'continuation');
  }

  const encoded = options.token.slice(TOKEN_PREFIX.length);
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) {
    throw new ValidationError('Continuation token is not valid base64url.', 'continuation');
  }

  let payload: unknown;
  try {
    const decoded = Buffer.from(encoded, 'base64url');
    if (decoded.toString('base64url') !== encoded) {
      throw new Error('Non-canonical base64url.');
    }
    payload = JSON.parse(decoded.toString('utf8'));
  } catch {
    throw new ValidationError('Continuation token is malformed.', 'continuation');
  }

  if (!isRecord(payload)) {
    throw new ValidationError('Continuation token payload is invalid.', 'continuation');
  }
  if (
    payload.v !== TOKEN_VERSION ||
    !isContinuationTool(payload.tool)
  ) {
    throw new ValidationError('Continuation token version or tool is invalid.', 'continuation');
  }
  if (payload.tool !== options.tool) {
    throw new ValidationError('Continuation token belongs to a different tool.', 'continuation');
  }
  if (
    typeof payload.filter_hash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(payload.filter_hash) ||
    payload.filter_hash !== hashFilters(options.effectiveFilters)
  ) {
    throw new ValidationError('Continuation token does not match the effective filters.', 'continuation');
  }

  return validateCursor(
    payload.cursor,
    options.cursorKind,
    options.cursorKind === 'keyset' ? options.allowedKeysetKeys : undefined,
    options.cursorKind === 'keyset' ? options.requiredKeysetKeys : undefined
  );
}

function getResultCount(pagination: FECPagination | FECKeysetPagination): ResultCount {
  const count = pagination.count;
  if (!Number.isSafeInteger(count) || (count as number) < 0) {
    return { status: 'unspecified' };
  }
  if (pagination.is_count_exact === true) {
    return { status: 'exact', value: count as number };
  }
  if (pagination.is_count_exact === false) {
    return { status: 'approximate', value: count as number };
  }
  return { status: 'unspecified', reportedValue: count as number };
}

function validatePaginationInteger(value: unknown, name: string, minimum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new FECApiError(`OpenFEC returned invalid ${name} pagination metadata.`);
  }
  return value as number;
}

export function createPagePaginationState(
  pagination: FECPagination | FECKeysetPagination
): Extract<PaginationState, { kind: 'page' }> {
  if (!('page' in pagination)) {
    throw new FECApiError('OpenFEC returned keyset metadata for a page route.');
  }
  const page = validatePaginationInteger(pagination.page, 'page', 1);
  const pages = validatePaginationInteger(pagination.pages, 'pages', 0);
  const perPage = validatePaginationInteger(pagination.per_page, 'per_page', 1);
  return {
    kind: 'page',
    count: getResultCount(pagination),
    page,
    pages,
    perPage,
    nextPage: page < pages ? page + 1 : null,
  };
}

export function createKeysetPaginationState(
  pagination: FECPagination | FECKeysetPagination
): Extract<PaginationState, { kind: 'keyset' }> {
  const perPage = validatePaginationInteger(pagination.per_page, 'per_page', 1);
  const nextValues = 'last_indexes' in pagination ? pagination.last_indexes : null;
  return {
    kind: 'keyset',
    count: getResultCount(pagination),
    perPage,
    nextValues,
  };
}

function formatCount(count: ResultCount): string {
  if (count.status === 'exact') {
    return `exact (${count.value} records)`;
  }
  if (count.status === 'approximate') {
    return `approximate (${count.value} reported records)`;
  }
  return count.reportedValue === undefined
    ? 'unspecified'
    : `unspecified (${count.reportedValue} reported records)`;
}

export function formatPaginationFooter(
  recordsShown: number,
  state: PaginationState,
  continuation?: string
): string {
  const lines = [
    '---',
    `Records shown: ${recordsShown}`,
    `Count status: ${formatCount(state.count)}`,
    continuation
      ? `Continuation: ${JSON.stringify({ continuation })}`
      : 'Continuation: none',
  ];
  return lines.join('\n');
}
