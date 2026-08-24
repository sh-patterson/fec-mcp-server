/**
 * get_committee_flags MCP Tool
 * Check for compliance issues, RFAIs, amendments, and red flags
 */

import type { FECClient } from '../api/client.js';
import type { CommitteeFilingReview, FECFiling } from '../api/types.js';
import { getCommitteeFlagsInputSchema } from '../schemas/committee-flags.schema.js';
import { formatErrorForToolResponse, NotFoundError } from '../utils/errors.js';
import { formatDate } from '../utils/formatters.js';

export const GET_COMMITTEE_FLAGS_TOOL = {
  name: 'get_committee_flags',
  description: `Find Requests for Additional Information and amended filings for human review. These filing records are review signals, not violation findings.`,
  inputSchema: getCommitteeFlagsInputSchema,
};

export interface GetCommitteeFlagsResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

function isRfaiFiling(filing: FECFiling): boolean {
  if (filing.form_type === 'RFAI') {
    return true;
  }

  const description = [filing.document_description, filing.document_type_full]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase();

  return description.includes('request for additional information');
}

/**
 * Analyze filings to extract flags
 */
function analyzeFilings(filings: FECFiling[]): CommitteeFilingReview {
  const rfais: FECFiling[] = [];
  const amendments: FECFiling[] = [];

  for (const filing of filings) {
    if (isRfaiFiling(filing)) {
      rfais.push(filing);
    }

    // Check for amendments
    if (filing.amendment_indicator && filing.amendment_indicator !== 'N') {
      amendments.push(filing);
    }
  }

  const signals: CommitteeFilingReview['signals'] = [];

  for (const rfai of rfais.slice(0, 5)) {
    signals.push({
      type: 'rfai',
      date: rfai.receipt_date,
      description:
        rfai.document_description ||
        rfai.document_type_full ||
        'Request for Additional Information',
      file_number: rfai.file_number,
      document_url: rfai.pdf_url,
    });
  }

  for (const amendment of amendments.slice(0, 5)) {
    signals.push({
      type: 'amendment',
      date: amendment.receipt_date,
      description: `Amended filing: ${amendment.form_type} - ${amendment.report_type_full || 'Report'}`,
      file_number: amendment.file_number,
      document_url: amendment.pdf_url,
    });
  }

  return {
    committee_id: filings[0]?.committee_id || '',
    committee_name: filings[0]?.committee_name || '',
    has_rfais: rfais.length > 0,
    rfai_count: rfais.length,
    has_amendments: amendments.length > 0,
    amendment_count: amendments.length,
    signals: signals.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    ),
  };
}

/**
 * Format flags for display
 */
function formatFlagsText(review: CommitteeFilingReview): string {
  const lines: string[] = [
    `## Filing review signals: ${review.committee_name}`,
    `**Committee ID:** ${review.committee_id}`,
    '',
  ];

  const hasSignals = review.has_rfais || review.has_amendments;
  if (!hasSignals) {
    lines.push('No RFAIs or amendments were found in the reviewed filing records.');
    return lines.join('\n');
  }

  lines.push('### Records for review');

  if (review.has_rfais) {
    lines.push(`- **RFAIs:** ${review.rfai_count} record(s)`);
  }

  if (review.has_amendments) {
    lines.push(`- **Amendments:** ${review.amendment_count} record(s)`);
  }

  if (review.signals.length > 0) {
    lines.push('');
    lines.push('### Recent filing records');

    for (const signal of review.signals) {
      lines.push(`- **${formatDate(signal.date)}** - ${signal.description}`);
      lines.push(`  - File number: ${signal.file_number}`);
      if (signal.document_url) {
        lines.push(`  - Document: ${signal.document_url}`);
      }
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('*These records identify items for review. They do not establish a violation.*');

  return lines.join('\n');
}

export async function executeGetCommitteeFlags(
  client: FECClient,
  params: {
    committee_id: string;
    cycle?: number;
  }
): Promise<GetCommitteeFlagsResult> {
  try {
    // Fetch both regular filings and RFAI documents
    const [filingsResponse, rfaiResponse] = await Promise.all([
      client.getFilings({
        committee_id: params.committee_id,
        cycle: params.cycle,
        limit: 50,
      }),
      client.getFilings({
        committee_id: params.committee_id,
        cycle: params.cycle,
        form_type: 'RFAI',
        limit: 20,
      }),
    ]);

    // Combine filings, removing duplicates
    const allFilings = [...filingsResponse.results];
    const existingIds = new Set(filingsResponse.results.map(f => f.file_number));

    for (const rfai of rfaiResponse.results) {
      if (!existingIds.has(rfai.file_number)) {
        allFilings.push(rfai);
      }
    }

    if (allFilings.length === 0) {
      throw new NotFoundError('Committee filings', params.committee_id);
    }

    // Analyze filings for flags
    const flags = analyzeFilings(allFilings);
    const formattedText = formatFlagsText(flags);

    return {
      content: [{ type: 'text', text: formattedText }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: formatErrorForToolResponse(error) }],
      isError: true,
    };
  }
}
