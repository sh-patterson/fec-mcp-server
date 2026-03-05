import { describe, it, expect } from 'vitest';
import {
  normalizeName,
  matchLpac,
  matchIndustry,
  matchBadGroup,
} from '../../src/notable/matchers.js';

describe('notable matchers', () => {
  it('should normalize committee name variants', () => {
    expect(normalizeName('Acme Political Action Committee, Inc.')).toBe('ACME PAC INC');
    expect(normalizeName('Acme   Corporation')).toBe('ACME CORP');
  });

  it('should match LPAC by committee id', () => {
    const match = matchLpac(
      { committeeId: 'C00000001', name: 'Random Name' },
      [{ committeeId: 'C00000001', shortName: 'ACME', officialName: 'ACME PAC', sponsor: '' }],
      90
    );

    expect(match?.type).toBe('LPAC');
    expect(match?.matchBasis).toBe('committee_id');
  });

  it('should fuzzy match industry by name', () => {
    const match = matchIndustry(
      { name: 'Texs Instruments PAC' },
      [
        {
          committeeId: 'C00000002',
          committeeName: 'TEXAS INSTRUMENTS POLITICAL ACTION COMMITTEE',
          orgType: 'C',
          smallerCategory: '',
          largerCategory: 'Big Tech',
          connectedOrganization: '',
        },
      ],
      85
    );

    expect(match?.type).toBe('INDUSTRY');
    expect(match?.matchBasis).toBe('fuzzy_name');
  });

  it('should match bad group by normalized exact name', () => {
    const match = matchBadGroup(
      { name: 'Right To Life Oregon PAC' },
      [
        {
          committeeId: 'C001',
          committeeName: 'RIGHT TO LIFE/OREGON PAC',
          flag: 'Anti-abortion/right to life group',
        },
      ],
      90
    );

    expect(match?.type).toBe('BAD_GROUP');
    expect(match?.matchBasis).toBe('exact_name');
  });
});
