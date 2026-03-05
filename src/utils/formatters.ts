/**
 * Formatting Utilities for FEC Data
 */

import type {
  FECCommitteeReport,
  FECScheduleA,
  FECScheduleB,
  FECScheduleC,
  FECScheduleD,
  FECScheduleE,
  FECCommittee,
  CommitteeFinancialSummary,
  EnhancedFinancialSummary,
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
 * Transform FEC committee report to our summary format
 */
export function transformCommitteeReport(report: FECCommitteeReport): CommitteeFinancialSummary {
  const burnRate = calculateBurnRate(
    report.total_receipts_period,
    report.total_disbursements_period
  );

  const smallDonorPercentage = calculateSmallDonorPercentage(
    report.individual_unitemized_contributions_period,
    report.total_receipts_period
  );

  return {
    committee_id: report.committee_id,
    committee_name: report.committee_name,
    report_type: report.report_type_full,
    coverage_period: {
      start: report.coverage_start_date,
      end: report.coverage_end_date,
    },
    cycle: report.cycle,
    total_receipts: report.total_receipts_period ?? 0,
    total_disbursements: report.total_disbursements_period ?? 0,
    cash_on_hand: report.cash_on_hand_end_period ?? 0,
    debts_owed: report.debts_owed_by_committee ?? 0,
    burn_rate: burnRate,
    individual_contributions: report.individual_contributions_period ?? 0,
    individual_itemized: report.individual_itemized_contributions_period ?? 0,
    individual_unitemized: report.individual_unitemized_contributions_period ?? 0,
    pac_contributions: report.other_political_committee_contributions_period ?? 0,
    party_contributions: report.political_party_committee_contributions_period ?? 0,
    small_donor_percentage: smallDonorPercentage,
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

/**
 * Format financial summary as readable text
 */
export function formatFinancialSummaryText(summary: CommitteeFinancialSummary): string {
  const lines: string[] = [
    `## ${summary.committee_name}`,
    `**Committee ID:** ${summary.committee_id}`,
    `**Report:** ${summary.report_type}`,
    `**Period:** ${formatDate(summary.coverage_period.start)} - ${formatDate(summary.coverage_period.end)}`,
    '',
    '### Financial Summary',
    `- **Total Receipts:** ${formatCurrency(summary.total_receipts)}`,
    `- **Total Disbursements:** ${formatCurrency(summary.total_disbursements)}`,
    `- **Cash on Hand:** ${formatCurrency(summary.cash_on_hand)}`,
    `- **Debts Owed:** ${formatCurrency(summary.debts_owed)}`,
  ];

  if (summary.burn_rate !== null) {
    lines.push(`- **Burn Rate:** ${summary.burn_rate.toFixed(2)} (${summary.burn_rate > 1 ? 'spending more than raising' : 'raising more than spending'})`);
  }

  lines.push('', '### Contribution Breakdown');
  lines.push(`- **Individual Contributions:** ${formatCurrency(summary.individual_contributions)}`);
  lines.push(`  - Itemized (>${formatCurrency(200)}): ${formatCurrency(summary.individual_itemized)}`);
  lines.push(`  - Unitemized (<${formatCurrency(200)}): ${formatCurrency(summary.individual_unitemized)}`);

  if (summary.small_donor_percentage !== null) {
    lines.push(`  - Small Donor %: ${summary.small_donor_percentage.toFixed(1)}%`);
  }

  lines.push(`- **PAC Contributions:** ${formatCurrency(summary.pac_contributions)}`);
  lines.push(`- **Party Contributions:** ${formatCurrency(summary.party_contributions)}`);

  return lines.join('\n');
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
 * Transform Schedule C loans to our enhanced format
 */
export function transformLoans(loans: FECScheduleC[]): EnhancedFinancialSummary['loans'] {
  return loans.map(loan => ({
    source: loan.loan_source_name,
    amount: loan.original_loan_amount,
    balance: loan.loan_balance,
    date: loan.incurred_date,
    is_candidate_loan: loan.personally_funded || !!loan.candidate_name,
  }));
}

/**
 * Transform Schedule D debts to our enhanced format
 */
export function transformDebts(debts: FECScheduleD[]): EnhancedFinancialSummary['debts'] {
  return debts.map(debt => ({
    creditor: debt.creditor_debtor_name,
    amount: debt.outstanding_balance_close_of_period,
    nature: debt.nature_of_debt,
  }));
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
 * Format enhanced financial summary with loans and debts
 */
export function formatEnhancedFinancialSummaryText(summary: EnhancedFinancialSummary): string {
  // Start with base financial summary
  const lines: string[] = [
    `## ${summary.committee_name}`,
    `**Committee ID:** ${summary.committee_id}`,
    `**Report:** ${summary.report_type}`,
    `**Period:** ${formatDate(summary.coverage_period.start)} - ${formatDate(summary.coverage_period.end)}`,
    '',
    '### Financial Summary',
    `- **Total Receipts:** ${formatCurrency(summary.total_receipts)}`,
    `- **Total Disbursements:** ${formatCurrency(summary.total_disbursements)}`,
    `- **Cash on Hand:** ${formatCurrency(summary.cash_on_hand)}`,
    `- **Debts Owed:** ${formatCurrency(summary.debts_owed)}`,
  ];

  if (summary.burn_rate !== null) {
    lines.push(`- **Burn Rate:** ${summary.burn_rate.toFixed(2)} (${summary.burn_rate > 1 ? 'spending more than raising' : 'raising more than spending'})`);
  }

  lines.push('', '### Contribution Breakdown');
  lines.push(`- **Individual Contributions:** ${formatCurrency(summary.individual_contributions)}`);
  lines.push(`  - Itemized (>${formatCurrency(200)}): ${formatCurrency(summary.individual_itemized)}`);
  lines.push(`  - Unitemized (<${formatCurrency(200)}): ${formatCurrency(summary.individual_unitemized)}`);

  if (summary.small_donor_percentage !== null) {
    lines.push(`  - Small Donor %: ${summary.small_donor_percentage.toFixed(1)}%`);
  }

  lines.push(`- **PAC Contributions:** ${formatCurrency(summary.pac_contributions)}`);
  lines.push(`- **Party Contributions:** ${formatCurrency(summary.party_contributions)}`);

  // Add loans section
  if (summary.loans.length > 0) {
    lines.push('', '### Loans (Schedule C)');
    lines.push(`- **Total Loans:** ${formatCurrency(summary.total_loans)}`);
    lines.push(`- **Candidate Loans:** ${formatCurrency(summary.candidate_loans)}`);
    lines.push('');
    summary.loans.forEach((loan, index) => {
      lines.push(`${index + 1}. **${loan.source}** - ${formatCurrency(loan.amount)}`);
      lines.push(`   - Balance: ${formatCurrency(loan.balance)}`);
      lines.push(`   - Date: ${formatDate(loan.date)}`);
      if (loan.is_candidate_loan) {
        lines.push(`   - ⚠️ Candidate/Personal Loan`);
      }
    });
  }

  // Add debts section
  if (summary.debts.length > 0) {
    lines.push('', '### Debts & Obligations (Schedule D)');
    summary.debts.forEach((debt, index) => {
      lines.push(`${index + 1}. **${debt.creditor}** - ${formatCurrency(debt.amount)}`);
      if (debt.nature) {
        lines.push(`   - Nature: ${debt.nature}`);
      }
    });
  }

  return lines.join('\n');
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

  lines.push(`**Total Supporting:** ${formatCurrency(totalSupport)} (${supporting.length} expenditures)`);
  lines.push(`**Total Opposing:** ${formatCurrency(totalOppose)} (${opposing.length} expenditures)`);
  lines.push('');

  expenditures.forEach((exp, index) => {
    const indicator = exp.support_oppose_indicator === 'S' ? '✓ SUPPORT' : '✗ OPPOSE';
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

/**
 * Format PAC classification for display
 */
export function formatPACClassificationText(pac: PACClassification): string {
  const tags: string[] = [];

  if (pac.is_leadership_pac) tags.push('Leadership PAC');
  if (pac.is_corporate_pac) tags.push('Corporate PAC');
  if (pac.is_labor_pac) tags.push('Labor PAC');
  if (pac.is_trade_pac) tags.push('Trade/Membership PAC');

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
      const tags: string[] = [];
      if (pac.is_leadership_pac) tags.push('Leadership');
      if (pac.is_corporate_pac) tags.push('Corporate');
      if (pac.is_labor_pac) tags.push('Labor');
      if (pac.is_trade_pac) tags.push('Trade');

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
