import type { Scenario } from '../types';
import { ransomwareScenario } from './ransomware';
import { webAppScenario } from './webapp';
import { privilegedScenario } from './privileged';
import { corporateScenario } from './corporate';
import { publicServicesScenario } from './public';
import { industrialScenario } from './industrial';

/**
 * Registry of built-in scenario definitions, keyed by scenario key.
 * Order determines the default listing order in the instructor UI.
 */
export const SCENARIOS: Record<string, Scenario> = {
  [ransomwareScenario.key]: ransomwareScenario,
  [webAppScenario.key]: webAppScenario,
  [privilegedScenario.key]: privilegedScenario,
  [corporateScenario.key]: corporateScenario,
  [publicServicesScenario.key]: publicServicesScenario,
  [industrialScenario.key]: industrialScenario,
};

export function getScenarioByKey(key: string): Scenario | undefined {
  return SCENARIOS[key];
}

export function listScenarios(): Scenario[] {
  return Object.values(SCENARIOS);
}

export {
  ransomwareScenario,
  webAppScenario,
  privilegedScenario,
  corporateScenario,
  publicServicesScenario,
  industrialScenario,
};

export { CARD_LIBRARY, SERVICE_FIXED_IDS, STANDARD_DECK, standardCards } from './cards';
