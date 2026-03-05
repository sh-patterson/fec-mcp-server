import type { NotableItem } from './classifier.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';

function formatItemLine(item: NotableItem, index: number, labelForCommittee: string): string[] {
  const lines: string[] = [
    `${index + 1}. **${item.name}** | ${formatDate(item.date)} | ${formatCurrency(item.amount)} | ${labelForCommittee}: ${item.committee}`,
  ];

  if (item.flags.length > 0) {
    const flagTypes = [...new Set(item.flags.map((flag) => flag.type))];
    lines.push(`   - Flags: ${flagTypes.join(', ')}`);

    const reasons = item.flags.map((flag) => flag.reason);
    lines.push(`   - Why flagged: ${reasons.join('; ')}`);
  }

  return lines;
}

function capItems(items: NotableItem[], maxRows: number): NotableItem[] {
  return items.slice(0, Math.max(maxRows, 1));
}

export function formatNotableReceiptsText(items: NotableItem[], maxRows = 10): string {
  if (items.length === 0) {
    return '### Flagged Notables\n\nNo receipt rows available for notable analysis.';
  }

  const flagged = items.filter((item) => item.flags.length > 0);
  const others = items.filter((item) => item.flags.length === 0);
  const lines: string[] = [];

  lines.push('### Flagged Notables');
  lines.push(`*Flagged-first ordering. Flagged rows: ${flagged.length} of ${items.length}*`);
  lines.push('');

  if (flagged.length === 0) {
    lines.push('No flagged notable receipts identified in current result set.');
  } else {
    for (const [index, item] of capItems(flagged, maxRows).entries()) {
      lines.push(...formatItemLine(item, index, 'Committee donated to'));
    }
  }

  lines.push('');
  lines.push('### Other High-Dollar Items');
  lines.push('');

  if (others.length === 0) {
    lines.push('No additional unflagged high-dollar receipt items in this result set.');
  } else {
    for (const [index, item] of capItems(others, maxRows).entries()) {
      lines.push(...formatItemLine(item, index, 'Committee donated to'));
    }
  }

  return lines.join('\n');
}

export function formatNotableDisbursementsText(items: NotableItem[], maxRows = 10): string {
  if (items.length === 0) {
    return '### Flagged Notables\n\nNo disbursement rows available for notable analysis.';
  }

  const flagged = items.filter((item) => item.flags.length > 0);
  const others = items.filter((item) => item.flags.length === 0);
  const lines: string[] = [];

  lines.push('### Flagged Notables');
  lines.push(`*Flagged-first ordering. Flagged rows: ${flagged.length} of ${items.length}*`);
  lines.push('');

  if (flagged.length === 0) {
    lines.push('No flagged notable disbursements identified in current result set.');
  } else {
    for (const [index, item] of capItems(flagged, maxRows).entries()) {
      lines.push(...formatItemLine(item, index, 'Spending committee'));
    }
  }

  lines.push('');
  lines.push('### Other High-Dollar Items');
  lines.push('');

  if (others.length === 0) {
    lines.push('No additional unflagged high-dollar disbursement items in this result set.');
  } else {
    for (const [index, item] of capItems(others, maxRows).entries()) {
      lines.push(...formatItemLine(item, index, 'Spending committee'));
    }
  }

  return lines.join('\n');
}
