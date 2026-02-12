// Guest localStorage persistence for Cedar decisions and actions.
// Key structure mirrors the database tables but scoped to localStorage
// so guests can use Cedar features without an account.

import type { Decision } from './types/cedar';
import type { Action } from './types/cedar';

const DECISIONS_PREFIX = 'cedar:decisions:';
const ACTIONS_PREFIX = 'cedar:actions:';

/**
 * Persist decisions for a given summary to guest localStorage.
 */
export function saveGuestDecisions(summaryId: string, decisions: Decision[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${DECISIONS_PREFIX}${summaryId}`, JSON.stringify(decisions));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

/**
 * Load decisions for a given summary from guest localStorage.
 * Returns an empty array if nothing is stored or data is corrupted.
 */
export function loadGuestDecisions(summaryId: string): Decision[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(`${DECISIONS_PREFIX}${summaryId}`);
    if (!stored) return [];
    return JSON.parse(stored) as Decision[];
  } catch {
    return [];
  }
}

/**
 * Persist actions for a given decision to guest localStorage.
 */
export function saveGuestActions(decisionId: string, actions: Action[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${ACTIONS_PREFIX}${decisionId}`, JSON.stringify(actions));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

/**
 * Load actions for a given decision from guest localStorage.
 * Returns an empty array if nothing is stored or data is corrupted.
 */
export function loadGuestActions(decisionId: string): Action[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(`${ACTIONS_PREFIX}${decisionId}`);
    if (!stored) return [];
    return JSON.parse(stored) as Action[];
  } catch {
    return [];
  }
}

/**
 * Clear all Cedar guest data from localStorage.
 * Useful when user signs up (data migrates to DB) or wants a fresh start.
 */
export function clearGuestCedarData(): void {
  if (typeof window === 'undefined') return;

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith(DECISIONS_PREFIX) || key.startsWith(ACTIONS_PREFIX))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}
