/**
 * get_committee_flags MCP Tool
 * Check for compliance issues, RFAIs, amendments, and red flags
 */

import type { FECClient } from '../api/client.js';
import type { CommitteeFlags, FECFiling } from '../api/types.js';
import { getCommitteeFlagsInputSchema } from '../schemas/committee-flags.schema.js';
import { formatErrorForToolResponse, NotFoundError } from '../utils/errors.js';
import { formatDate, formatCurrency } from '../utils/formatters.js';

export const GET_COMMITTEE_FLAGS_TOOL = {
  name: 'get_committee_flags',
  description: `Check a campaign committee for compliance red flags including RFAIs (Requests for Additional Information from the FEC), amended filings, and late reports. Essential for identifying potential campaign finance issues and compliance problems.`,
  inputSchema: getCommitteeFlagsInputSchema,
};

export interface GetCommitteeFlagsResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/**
 * Analyze filings to extract flags
 */
function analyzeFilings(filings: FECFiling[]): CommitteeFlags {
  const rfais: FECFiling[] = [];
  const amendments: FECFiling[] = [];
  const lateFilings: FECFiling[] = [];

  for (const filing of filings) {
    // Check for RFAIs (Request for Additional Information)
    if (filing.document_type === 'RFAI' || filing.form_type === 'RFAI') {
      rfais.push(filing);
    }

    // Check for amendments
    if (filing.amendment_indicator && filing.amendment_indicator !== 'N') {
      amendments.push(filing);
    }

    // Note: Late filings would need additional date comparison logic
    // For now we flag amendments as they often indicate issues
  }

  const recentIssues: CommitteeFlags['recent_issues'] = [];

  // Add RFAIs to issues
  for (const rfai of rfais.slice(0, 5)) {
    recentIssues.push({
      type: 'rfai',
      date: rfai.receipt_date,
      description: `RFAI received: ${rfai.document_type_full || 'Request for Additional Information'}`,
    });
  }

  // Add significant amendments to issues
  for (const amendment of amendments.slice(0, 5)) {
    recentIssues.push({
      type: 'amendment',
      date: amendment.receipt_date,
      description: `Amended filing: ${amendment.form_type} - ${amendment.report_type_full || 'Report'}`,
    });
  }

  return {
    committee_id: filings[0]?.committee_id || '',
    committee_name: filings[0]?.committee_name || '',
    has_rfais: rfais.length > 0,
    rfai_count: rfais.length,
    has_late_filings: lateFilings.length > 0,
    late_filing_count: lateFilings.length,
    has_amendments: amendments.length > 0,
    amendment_count: amendments.length,
    recent_issues: recentIssues.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    ),
  };
}

/**
 * Format flags for display
 */
function formatFlagsText(flags: CommitteeFlags): string {
  const lines: string[] = [
    `## Compliance Review: ${flags.committee_name}`,
    `**Committee ID:** ${flags.committee_id}`,
    '',
  ];

  // Overall status
  const hasIssues = flags.has_rfais || flags.has_amendments;
  if (!hasIssues) {
    lines.push('### Status: No Significant Flags');
    lines.push('No RFAIs or amendments found in recent filings.');
    return lines.join('\n');
  }

  lines.push('### Flags Summary');

  if (flags.has_rfais) {
    lines.push(`- **RFAIs:** ${flags.rfai_count} request(s) for additional information from FEC`);
  }

  if (flags.has_amendments) {
    lines.push(`- **Amendments:** ${flags.amendment_count} amended filing(s)`);
  }

  if (flags.has_late_filings) {
    lines.push(`- **Late Filings:** ${flags.late_filing_count} late report(s)`);
  }

  // List recent issues
  if (flags.recent_issues.length > 0) {
    lines.push('');
    lines.push('### Recent Issues');

    for (const issue of flags.recent_issues) {
      const icon = issue.type === 'rfai' ? '!' : issue.type === 'amendment' ? '*' : '?';
      lines.push(`${icon} **${formatDate(issue.date)}** - ${issue.description}`);
    }
  }

  // Add context
  lines.push('');
  lines.push('---');
  lines.push('*Note: RFAIs indicate the FEC has requested additional information or clarification.*');
  lines.push('*Amendments may indicate corrections to previously filed reports.*');

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
        limit: 50,
      }),
      client.getFilings({
        committee_id: params.committee_id,
        document_type: 'RFAI',
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
