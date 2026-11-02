import type { Scenario } from '../types';
import { ransomwareScenario } from './ransomware';
import { webAppScenario } from './webapp';
import { privilegedScenario } from './privileged';

/**
 * Registry of built-in scenario definitions, keyed by scenario key.
 * Order determines the default listing order in the instructor UI.
 */
export const SCENARIOS: Record<string, Scenario> = {
  [ransomwareScenario.key]: ransomwareScenario,
  [webAppScenario.key]: webAppScenario,
  [privilegedScenario.key]: privilegedScenario,
};

export function getScenarioByKey(key: string): Scenario | undefined {
  return SCENARIOS[key];
}

export function listScenarios(): Scenario[] {
  return Object.values(SCENARIOS);
}

export { ransomwareScenario, webAppScenario, privilegedScenario };
