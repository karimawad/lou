// Short and long names for each slip type (no React, so the PDF builders can use them too).

import { SLIPS, type SlipType } from '../tax/slips';

export const SLIP_LABEL: Record<SlipType, string> = {
  T4: 'T4', T4A: 'T4A', T5: 'T5', T3: 'T3', T5008: 'T5008', T4RSP: 'T4RSP', T4RIF: 'T4RIF', T4E: 'T4E',
  T4AP: 'T4A(P)', T4AOAS: 'T4A(OAS)', T5007: 'T5007', NOA: 'NOA',
};
export const SLIP_NAME: Record<SlipType, string> = {
  ...Object.fromEntries(Object.entries(SLIPS).map(([k, v]) => [k, v.name.split(' - ')[1] ?? v.name])) as Record<Exclude<SlipType, 'NOA'>, string>,
  NOA: 'Notice of Assessment',
};
