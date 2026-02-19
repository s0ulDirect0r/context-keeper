// This module is now a re-export shim.
// Domain types live in @/models/types. AI operations live in @/services/summarize.
// Existing consumers can continue importing from here during migration.

export type {
  SummaryContent,
  SummaryContext,
  SummaryMetadata,
  GeneratedSummary,
} from '@/models/types';
export { generateSummary, streamSummarySingle } from '@/services/summarize';
