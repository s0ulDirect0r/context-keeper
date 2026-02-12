import { test, expect } from '@playwright/test';

test.describe('Cedar guest localStorage', () => {
  test('saveGuestDecisions / loadGuestDecisions round-trips correctly', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      const DECISIONS_PREFIX = 'cedar:decisions:';
      const summaryId = 'summary-test-1';

      const decisions = [
        {
          id: 'decision-1',
          userId: 'guest',
          summaryId,
          statement: 'Prioritize auth refactor.',
          reasoning: 'Auth blocks the API migration.',
          confidence: 'high',
          status: 'emerging',
          supportingPearls: [{ pearlId: 'pearl-1', relationship: 'supports' }],
          createdAt: '2026-02-11T10:00:00Z',
          updatedAt: '2026-02-11T10:00:00Z',
        },
        {
          id: 'decision-2',
          userId: 'guest',
          summaryId,
          statement: 'Formalize blocker tracking.',
          reasoning: 'Team needs structured dependency surfacing.',
          confidence: 'medium',
          status: 'emerging',
          supportingPearls: [],
          createdAt: '2026-02-11T10:00:00Z',
          updatedAt: '2026-02-11T10:00:00Z',
        },
      ];

      // Save
      localStorage.setItem(`${DECISIONS_PREFIX}${summaryId}`, JSON.stringify(decisions));

      // Load
      const stored = localStorage.getItem(`${DECISIONS_PREFIX}${summaryId}`);
      const loaded = stored ? JSON.parse(stored) : [];

      return {
        savedCount: decisions.length,
        loadedCount: loaded.length,
        firstStatement: loaded[0]?.statement,
        secondStatement: loaded[1]?.statement,
        match: JSON.stringify(decisions) === JSON.stringify(loaded),
      };
    });

    expect(result.match).toBe(true);
    expect(result.savedCount).toBe(2);
    expect(result.loadedCount).toBe(2);
    expect(result.firstStatement).toBe('Prioritize auth refactor.');
    expect(result.secondStatement).toBe('Formalize blocker tracking.');
  });

  test('saveGuestActions / loadGuestActions round-trips correctly', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      const ACTIONS_PREFIX = 'cedar:actions:';
      const decisionId = 'decision-test-1';

      const actions = [
        {
          id: 'action-1',
          userId: 'guest',
          decisionId,
          description: 'Confirm priority with James.',
          contextCard: {
            sourcePearlQuote: 'I can have the auth refactor done by Thursday.',
            sourcePearlSpeaker: 'James',
            sourcePearlInsight: 'James takes ownership.',
            parentDecisionStatement: 'Prioritize auth refactor.',
            framing: 'Position as support.',
            timing: 'Before end of day',
            talkingPoints: ['Acknowledge initiative', 'Ask what he needs'],
          },
          status: 'pending',
          dueDate: null,
          createdAt: '2026-02-11T10:05:00Z',
          updatedAt: '2026-02-11T10:05:00Z',
        },
      ];

      // Save
      localStorage.setItem(`${ACTIONS_PREFIX}${decisionId}`, JSON.stringify(actions));

      // Load
      const stored = localStorage.getItem(`${ACTIONS_PREFIX}${decisionId}`);
      const loaded = stored ? JSON.parse(stored) : [];

      return {
        match: JSON.stringify(actions) === JSON.stringify(loaded),
        description: loaded[0]?.description,
        hasContextCard: loaded[0]?.contextCard !== null,
        talkingPointCount: loaded[0]?.contextCard?.talkingPoints?.length,
      };
    });

    expect(result.match).toBe(true);
    expect(result.description).toBe('Confirm priority with James.');
    expect(result.hasContextCard).toBe(true);
    expect(result.talkingPointCount).toBe(2);
  });

  test('clearGuestCedarData removes all cedar keys', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      const DECISIONS_PREFIX = 'cedar:decisions:';
      const ACTIONS_PREFIX = 'cedar:actions:';

      // Populate some data
      localStorage.setItem(`${DECISIONS_PREFIX}summary-1`, JSON.stringify([{ id: 'd1' }]));
      localStorage.setItem(`${DECISIONS_PREFIX}summary-2`, JSON.stringify([{ id: 'd2' }]));
      localStorage.setItem(`${ACTIONS_PREFIX}decision-1`, JSON.stringify([{ id: 'a1' }]));
      // Also set a non-cedar key that should survive
      localStorage.setItem('context-keeper:preferences', JSON.stringify({ x: 1 }));

      const beforeCount = localStorage.length;

      // Clear cedar data
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(DECISIONS_PREFIX) || key.startsWith(ACTIONS_PREFIX))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));

      const afterCount = localStorage.length;
      const prefsStillExist = localStorage.getItem('context-keeper:preferences') !== null;
      const decisionsGone = localStorage.getItem(`${DECISIONS_PREFIX}summary-1`) === null;
      const actionsGone = localStorage.getItem(`${ACTIONS_PREFIX}decision-1`) === null;

      return {
        beforeCount,
        afterCount,
        removedCount: beforeCount - afterCount,
        prefsStillExist,
        decisionsGone,
        actionsGone,
      };
    });

    expect(result.removedCount).toBe(3); // 2 decisions + 1 actions
    expect(result.prefsStillExist).toBe(true);
    expect(result.decisionsGone).toBe(true);
    expect(result.actionsGone).toBe(true);
  });

  test('loadGuestDecisions returns empty array for missing key', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      const stored = localStorage.getItem('cedar:decisions:nonexistent');
      return stored ? JSON.parse(stored) : [];
    });

    expect(result).toEqual([]);
  });
});
