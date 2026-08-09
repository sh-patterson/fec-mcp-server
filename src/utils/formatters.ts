/**
 * Formatting Utilities for FEC Data
 */

import type {
  FECCommitteeReport,
  FECCommitteeTotals,
  FECScheduleA,
  FECScheduleB,
  FECScheduleE,
  FECCommittee,
  CommitteeFinancialSummary,
  FormattedReceipt,
  FormattedDisbursement,
  PACClassification,
  EnrichedReceipt,
} from '../api/types.js';

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date for display (YYYY-MM-DD to readable format)
 */
export function formatDate(dateString?: string | null): string {
  if (!dateString) {
    return 'Unknown date';
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  const date = dateOnlyMatch
    ? new Date(
        Number.parseInt(dateOnlyMatch[1], 10),
        Number.parseInt(dateOnlyMatch[2], 10) - 1,
        Number.parseInt(dateOnlyMatch[3], 10)
      )
    : new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Calculate burn rate (disbursements / receipts)
 * Returns null if receipts are zero to avoid division by zero
 */
export function calculateBurnRate(receipts: number, disbursements: number): number | null {
  if (receipts === 0) {
    return null;
  }
  return Math.round((disbursements / receipts) * 100) / 100;
}

/**
 * Calculate small donor percentage (unitemized / total)
 * Returns null if total is zero
 */
export function calculateSmallDonorPercentage(
  unitemized: number,
  total: number
): number | null {
  if (total === 0) {
    return null;
  }
  return Math.round((unitemized / total) * 10000) / 100; // Two decimal places
}

/**
 * Combine cycle totals with the latest final report balances.
 */
export function transformCommitteeFinancials(
  totals: FECCommitteeTotals,
  report: FECCommitteeReport
): CommitteeFinancialSummary {
  const loans =
    totals.loans ??
    totals.loans_received ??
    (totals.loans_received_from_candidate !== undefined || totals.all_other_loans !== undefined
      ? (totals.loans_received_from_candidate ?? 0) + (totals.all_other_loans ?? 0)
      : null);

  return {
    committee_id: report.committee_id,
    committee_name: report.committee_name,
    cycle_totals: {
      cycle: totals.cycle,
      coverage_start_date: totals.coverage_start_date,
      coverage_end_date: totals.coverage_end_date,
      receipts: totals.receipts,
      disbursements: totals.disbursements,
      individual_contributions: totals.individual_contributions,
      individual_itemized_contributions: totals.individual_itemized_contributions,
      individual_unitemized_contributions: totals.individual_unitemized_contributions,
      pac_contributions: totals.other_political_committee_contributions,
      party_contributions: totals.political_party_committee_contributions,
      loans,
      candidate_loans:
        totals.loans_received_from_candidate ?? totals.candidate_contribution ?? null,
    },
    latest_report_balances: {
      report_type: report.report_type_full,
      coverage_start_date: report.coverage_start_date,
      coverage_end_date: report.coverage_end_date,
      cash_on_hand: report.cash_on_hand_end_period ?? null,
      debts_owed_by_committee: report.debts_owed_by_committee ?? null,
      debts_owed_to_committee: report.debts_owed_to_committee ?? null,
    },
    cycle_burn_rate:
      totals.receipts !== null && totals.disbursements !== null
        ? calculateBurnRate(totals.receipts, totals.disbursements)
        : null,
    cycle_unitemized_share:
      totals.individual_unitemized_contributions !== null &&
      totals.individual_contributions !== null
        ? calculateSmallDonorPercentage(
            totals.individual_unitemized_contributions,
            totals.individual_contributions
          )
        : null,
  };
}

/**
 * Transform FEC Schedule A record to formatted receipt
 */
export function transformScheduleA(record: FECScheduleA): FormattedReceipt {
  return {
    contributor_name: record.contributor_name,
    amount: record.contribution_receipt_amount,
    date: record.contribution_receipt_date,
    contributor_type: record.is_individual ? 'Individual' : (record.entity_type_desc || 'Organization'),
    employer: record.contributor_employer,
    occupation: record.contributor_occupation,
    city: record.contributor_city,
    state: record.contributor_state,
  };
}

/**
 * Transform FEC Schedule B record to formatted disbursement
 */
export function transformScheduleB(record: FECScheduleB): FormattedDisbursement {
  return {
    recipient_name: record.recipient_name,
    amount: record.disbursement_amount,
    date: record.disbursement_date,
    description: record.disbursement_description,
    purpose_category: record.disbursement_purpose_category,
    city: record.recipient_city,
    state: record.recipient_state,
  };
}

function formatReportedCurrency(amount: number | null): string {
  return amount === null ? 'Not reported' : formatCurrency(amount);
}

function formatCoverage(start: string | null, end: string | null): string {
  if (!start || !end) {
    return 'Not reported';
  }
  return `${formatDate(start)} - ${formatDate(end)}`;
}

function buildFinancialSummaryLines(summary: CommitteeFinancialSummary): string[] {
  const cycle = summary.cycle_totals;
  const latest = summary.latest_report_balances;
  const lines = [
    `## ${summary.committee_name}`,
    `**Committee ID:** ${summary.committee_id}`,
    '',
    `### Cycle totals (${cycle.cycle})`,
    `**Cycle coverage:** ${formatCoverage(cycle.coverage_start_date, cycle.coverage_end_date)}`,
    `- **Cycle total receipts:** ${formatReportedCurrency(cycle.receipts)}`,
    `- **Cycle total disbursements:** ${formatReportedCurrency(cycle.disbursements)}`,
    `- **Cycle total individual contributions:** ${formatReportedCurrency(cycle.individual_contributions)}`,
    `  - **Cycle total itemized individual contributions:** ${formatReportedCurrency(cycle.individual_itemized_contributions)}`,
    `  - **Cycle total unitemized individual contributions:** ${formatReportedCurrency(cycle.individual_unitemized_contributions)}`,
    `- **Cycle total other political committee contributions:** ${formatReportedCurrency(cycle.pac_contributions)}`,
    `- **Cycle total party committee contributions:** ${formatReportedCurrency(cycle.party_contributions)}`,
    `- **Cycle total loans:** ${formatReportedCurrency(cycle.loans)}`,
    `- **Cycle total candidate loans or contributions:** ${formatReportedCurrency(cycle.candidate_loans)}`,
  ];

  if (summary.cycle_burn_rate !== null) {
    lines.push(`- **Derived cycle burn rate:** ${summary.cycle_burn_rate.toFixed(2)}`);
  }

  if (summary.cycle_unitemized_share !== null) {
    lines.push(
      `- **Derived cycle unitemized share of individual contributions:** ${summary.cycle_unitemized_share.toFixed(1)}%`
    );
  }

  lines.push(
    '',
    '### Latest final report balances',
    `**Latest final report:** ${latest.report_type}`,
    `**Report period:** ${formatCoverage(latest.coverage_start_date, latest.coverage_end_date)}`,
    `- **Latest-report cash balance:** ${formatReportedCurrency(latest.cash_on_hand)}`,
    `- **Latest-report debt owed by committee:** ${formatReportedCurrency(latest.debts_owed_by_committee)}`,
    `- **Latest-report debt owed to committee:** ${formatReportedCurrency(latest.debts_owed_to_committee)}`
  );

  return lines;
}

/**
 * Format financial summary as readable text
 */
export function formatFinancialSummaryText(summary: CommitteeFinancialSummary): string {
  return buildFinancialSummaryLines(summary).join('\n');
}

/**
 * Format receipts list as readable text
 */
export function formatReceiptsText(receipts: FormattedReceipt[], committeeName?: string): string {
  if (receipts.length === 0) {
    return 'No contributions found matching the criteria.';
  }

  const lines: string[] = [];

  if (committeeName) {
    lines.push(`## Contributions to ${committeeName}`);
    lines.push('');
  }

  receipts.forEach((receipt, index) => {
    const location = [receipt.city, receipt.state].filter(Boolean).join(', ');
    lines.push(`${index + 1}. **${receipt.contributor_name}** - ${formatCurrency(receipt.amount)}`);
    lines.push(`   - Date: ${formatDate(receipt.date)}`);
    lines.push(`   - Type: ${receipt.contributor_type}`);
    if (receipt.employer) {
      lines.push(`   - Employer: ${receipt.employer}`);
    }
    if (receipt.occupation) {
      lines.push(`   - Occupation: ${receipt.occupation}`);
    }
    if (location) {
      lines.push(`   - Location: ${location}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Format disbursements list as readable text
 */
export function formatDisbursementsText(disbursements: FormattedDisbursement[], committeeName?: string): string {
  if (disbursements.length === 0) {
    return 'No disbursements found matching the criteria.';
  }

  const lines: string[] = [];

  if (committeeName) {
    lines.push(`## Disbursements by ${committeeName}`);
    lines.push('');
  }

  disbursements.forEach((disbursement, index) => {
    const location = [disbursement.city, disbursement.state].filter(Boolean).join(', ');
    lines.push(`${index + 1}. **${disbursement.recipient_name}** - ${formatCurrency(disbursement.amount)}`);
    lines.push(`   - Date: ${formatDate(disbursement.date)}`);
    if (disbursement.description) {
      lines.push(`   - Purpose: ${disbursement.description}`);
    }
    if (disbursement.purpose_category) {
      lines.push(`   - Category: ${disbursement.purpose_category}`);
    }
    if (location) {
      lines.push(`   - Location: ${location}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Classify a PAC based on FEC committee data
 */
export function classifyPAC(committee: FECCommittee): PACClassification {
  const orgType = committee.organization_type;

  return {
    committee_id: committee.committee_id,
    name: committee.name,
    designation: committee.designation,
    designation_full: committee.designation_full,
    organization_type: orgType,
    organization_type_full: committee.organization_type_full,
    connected_organization: committee.connected_organization_name,
    is_leadership_pac: committee.leadership_pac === true || committee.designation === 'D',
    is_corporate_pac: orgType === 'C',
    is_labor_pac: orgType === 'L',
    is_trade_pac: orgType === 'T' || orgType === 'M',
    sponsor_candidate: committee.sponsor_candidate_list?.[0]?.candidate_name || null,
  };
}

/**
 * Format independent expenditure for display
 */
export function formatIndependentExpenditureText(
  expenditures: FECScheduleE[],
  targetCandidate?: string
): string {
  if (expenditures.length === 0) {
    return 'No independent expenditures found matching the criteria.';
  }

  const lines: string[] = [];

  if (targetCandidate) {
    lines.push(`## Independent Expenditures Targeting ${targetCandidate}`);
  } else {
    lines.push('## Independent Expenditures');
  }
  lines.push('');

  // Group by support/oppose
  const supporting = expenditures.filter(e => e.support_oppose_indicator === 'S');
  const opposing = expenditures.filter(e => e.support_oppose_indicator === 'O');

  const totalSupport = supporting.reduce((sum, e) => sum + e.expenditure_amount, 0);
  const totalOppose = opposing.reduce((sum, e) => sum + e.expenditure_amount, 0);

  lines.push(`**Current-page support total:** ${formatCurrency(totalSupport)} (${supporting.length} expenditures)`);
  lines.push(`**Current-page oppose total:** ${formatCurrency(totalOppose)} (${opposing.length} expenditures)`);
  lines.push('');

  expenditures.forEach((exp, index) => {
    const indicator =
      exp.support_oppose_indicator === 'S'
        ? 'SUPPORT'
        : exp.support_oppose_indicator === 'O'
          ? 'OPPOSE'
          : 'UNKNOWN';
    lines.push(`${index + 1}. **${exp.committee_name}** - ${formatCurrency(exp.expenditure_amount)} [${indicator}]`);
    if (exp.candidate_name) {
      lines.push(`   - Candidate: ${exp.candidate_name} (${exp.candidate_party || 'Unknown party'})`);
    }
    lines.push(`   - Date: ${formatDate(exp.expenditure_date)}`);
    if (exp.expenditure_description) {
      lines.push(`   - Purpose: ${exp.expenditure_description}`);
    }
    if (exp.payee_name) {
      lines.push(`   - Paid to: ${exp.payee_name}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

const PAC_CLASSIFICATION_LABELS = [
  ['is_leadership_pac', 'Leadership PAC', 'Leadership'],
  ['is_corporate_pac', 'Corporate PAC', 'Corporate'],
  ['is_labor_pac', 'Labor PAC', 'Labor'],
  ['is_trade_pac', 'Trade/Membership PAC', 'Trade'],
] as const;

function getPACClassificationLabels(
  pac: PACClassification,
  labelType: 'full' | 'short'
): string[] {
  const labelIndex = labelType === 'full' ? 1 : 2;
  return PAC_CLASSIFICATION_LABELS
    .filter(([flag]) => pac[flag])
    .map((labels) => labels[labelIndex]);
}

/**
 * Format PAC classification for display
 */
export function formatPACClassificationText(pac: PACClassification): string {
  const tags = getPACClassificationLabels(pac, 'full');

  const lines = [
    `**${pac.name}** (${pac.committee_id})`,
    `- Type: ${pac.designation_full}`,
  ];

  if (tags.length > 0) {
    lines.push(`- Classification: ${tags.join(', ')}`);
  }

  if (pac.connected_organization) {
    lines.push(`- Connected Organization: ${pac.connected_organization}`);
  }

  if (pac.sponsor_candidate) {
    lines.push(`- Sponsor Candidate: ${pac.sponsor_candidate}`);
  }

  return lines.join('\n');
}

/**
 * Format enriched receipts with PAC classification
 */
export function formatEnrichedReceiptsText(receipts: EnrichedReceipt[], committeeName?: string): string {
  if (receipts.length === 0) {
    return 'No contributions found matching the criteria.';
  }

  const lines: string[] = [];

  if (committeeName) {
    lines.push(`## Contributions to ${committeeName}`);
    lines.push('');
  }

  // Separate by contributor type first; PAC classification is enrichment on top of committee/org records.
  const individualContributions = receipts.filter(r => r.contributor_type === 'Individual');
  const organizationContributions = receipts.filter(r => r.contributor_type !== 'Individual');
  const pacContributions = organizationContributions.filter(r => r.pac_classification !== null);
  const otherOrganizationContributions = organizationContributions.filter(
    r => r.pac_classification === null
  );

  if (pacContributions.length > 0) {
    lines.push('### PAC Contributions');
    lines.push('');

    pacContributions.forEach((receipt, index) => {
      const pac = receipt.pac_classification!;
      const tags = getPACClassificationLabels(pac, 'short');
      const tagStr = tags.length > 0 ? ` [${tags.join(', ')}]` : '';

      lines.push(`${index + 1}. **${receipt.contributor_name}** - ${formatCurrency(receipt.amount)}${tagStr}`);
      lines.push(`   - Date: ${formatDate(receipt.date)}`);
      if (pac.connected_organization) {
        lines.push(`   - Connected Org: ${pac.connected_organization}`);
      }
      if (pac.sponsor_candidate) {
        lines.push(`   - Sponsor: ${pac.sponsor_candidate}`);
      }
      lines.push('');
    });
  }

  if (individualContributions.length > 0) {
    lines.push('### Individual Contributions');
    lines.push('');

    individualContributions.forEach((receipt, index) => {
      const location = [receipt.city, receipt.state].filter(Boolean).join(', ');
      lines.push(`${index + 1}. **${receipt.contributor_name}** - ${formatCurrency(receipt.amount)}`);
      lines.push(`   - Date: ${formatDate(receipt.date)}`);
      if (receipt.employer) {
        lines.push(`   - Employer: ${receipt.employer}`);
      }
      if (receipt.occupation) {
        lines.push(`   - Occupation: ${receipt.occupation}`);
      }
      if (location) {
        lines.push(`   - Location: ${location}`);
      }
      lines.push('');
    });
  }

  if (otherOrganizationContributions.length > 0) {
    lines.push('### Other Committee/Organization Contributions');
    lines.push('');

    otherOrganizationContributions.forEach((receipt, index) => {
      const location = [receipt.city, receipt.state].filter(Boolean).join(', ');
      lines.push(`${index + 1}. **${receipt.contributor_name}** - ${formatCurrency(receipt.amount)}`);
      lines.push(`   - Date: ${formatDate(receipt.date)}`);
      lines.push(`   - Type: ${receipt.contributor_type}`);
      if (location) {
        lines.push(`   - Location: ${location}`);
      }
      lines.push('');
    });
  }

  return lines.join('\n');
}
