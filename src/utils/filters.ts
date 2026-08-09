import { ValidationError } from './errors.js';

export function resolveTransactionPeriod(
  twoYearTransactionPeriod?: number,
  cycle?: number
): number | undefined {
  if (
    twoYearTransactionPeriod !== undefined &&
    cycle !== undefined &&
    twoYearTransactionPeriod !== cycle
  ) {
    throw new ValidationError(
      'Conflicting cycle aliases: cycle and two_year_transaction_period must match.'
    );
  }

  return twoYearTransactionPeriod ?? cycle;
}

export function formatCycleFilter(cycle?: number): string {
  return cycle === undefined ? 'cycle all' : `cycle ${cycle}`;
}
