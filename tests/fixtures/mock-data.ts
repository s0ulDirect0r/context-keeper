export const MOCK_TRANSCRIPT = `Sarah: We need to push the API migration to next sprint.
James: I can have the auth refactor done by Thursday.
Sarah: OK, let's flag it as a blocker in the sprint retro.`;

export const MOCK_SUMMARY_MARKDOWN = `## Meeting Summary

### Key Decisions
- API migration pushed to next sprint due to auth service dependency

### Action Items
- **James**: Complete auth service refactor by Thursday
- **Sarah**: Escalate compliance review if no response by Friday`;

export const MOCK_TAGS = [
  {
    name: 'Technical Dependencies',
    description: 'Cross-team technical blockers',
    quotes: ['auth service refactor is blocking it'],
  },
  {
    name: 'Timeline Pressure',
    description: 'Deadline-driven urgency',
    quotes: ['promised the client a demo in three weeks'],
  },
];
