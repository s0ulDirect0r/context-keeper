import type { SummaryContext, Pearl, ConceptTag } from './claude';
import type { SummaryContent } from './summary-types';
import type { Recording } from './otter';

// ── Step type ────────────────────────────────────────────────────────

export type Step =
  | 'choose-method'
  | 'otter-login'
  | 'otter-recordings'
  | 'manual-transcript'
  | 'paste-transcript'
  | 'context-wizard'
  | 'summary-mode'
  | 'generating'
  | 'summary';

// ── Phase gates ──────────────────────────────────────────────────────
// Explicit booleans that track which async operations have completed.
// Eliminates race conditions from implicit "is this array empty?" checks.

export interface GenerationPhase {
  summaryReady: boolean;
  tagsExtracting: boolean;
  tagsReady: boolean;
  pearlsGenerating: boolean;
  pearlsReady: boolean;
}

const initialPhase: GenerationPhase = {
  summaryReady: false,
  tagsExtracting: false,
  tagsReady: false,
  pearlsGenerating: false,
  pearlsReady: false,
};

// ── State ────────────────────────────────────────────────────────────

export interface GenerationState {
  // Navigation
  step: Step;
  inputMethod: 'otter' | 'manual' | 'paste' | null;

  // Otter data
  recordings: Recording[];
  loadingRecordings: boolean;
  prefetchedRecordings: Recording[] | null;

  // Transcript data
  transcripts: string[];
  recordingTitles: string[];
  recordingDates: string[];

  // Speaker identification
  speakerNames: string[];
  userSpeakerName: string | undefined;

  // Context
  context: SummaryContext | null;
  summaryMode: 'combined' | 'separate';

  // Streaming generation
  streamingMarkdown: string;
  isStreaming: boolean;

  // Generation output
  summaries: SummaryContent;
  conceptTags: ConceptTag[];
  pearls: Pearl[];

  // Phase gates
  phase: GenerationPhase;

  // Tag selection (lifted so it survives generating→summary transition)
  tagSelection: Set<string>;
  tagCustomTags: Set<string>;

  // Persistence
  savedSummaryId: string | null;

  // Error
  error: string | null;
}

export const initialState: GenerationState = {
  step: 'choose-method',
  inputMethod: null,
  recordings: [],
  loadingRecordings: false,
  prefetchedRecordings: null,
  transcripts: [],
  recordingTitles: [],
  recordingDates: [],
  speakerNames: [],
  userSpeakerName: undefined,
  context: null,
  summaryMode: 'combined',
  streamingMarkdown: '',
  isStreaming: false,
  summaries: [],
  conceptTags: [],
  pearls: [],
  phase: initialPhase,
  tagSelection: new Set(),
  tagCustomTags: new Set(),
  savedSummaryId: null,
  error: null,
};

// ── Actions ──────────────────────────────────────────────────────────

export type GenerationAction =
  | { type: 'SET_STEP'; step: Step }
  | { type: 'SET_INPUT_METHOD'; method: 'otter' | 'manual' | 'paste' | null }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_RECORDINGS'; recordings: Recording[] }
  | { type: 'SET_LOADING_RECORDINGS'; loading: boolean }
  | { type: 'SET_PREFETCHED_RECORDINGS'; recordings: Recording[] | null }
  | {
      type: 'TRANSCRIPTS_LOADED';
      transcripts: string[];
      recordingTitles: string[];
      recordingDates: string[];
      speakerNames: string[];
      userSpeakerName: string | undefined;
      nextStep: Step;
    }
  | { type: 'SET_CONTEXT'; context: SummaryContext }
  | { type: 'SET_SUMMARY_MODE'; mode: 'combined' | 'separate' }
  | { type: 'GENERATION_START' }
  | { type: 'SSE_SUMMARY_CHUNK'; text: string }
  | { type: 'SSE_SUMMARY_DONE'; summaries?: SummaryContent }
  | { type: 'SSE_TAGS_EXTRACTING' }
  | { type: 'SSE_TAGS_DONE'; tags: ConceptTag[] }
  | {
      type: 'SSE_COMPLETE';
      savedSummaryId?: string;
      summaries?: SummaryContent;
      tags?: ConceptTag[];
    }
  | { type: 'PEARLS_GENERATING' }
  | { type: 'PEARLS_DONE'; pearls: Pearl[] }
  | { type: 'PEARLS_FAILED' }
  | { type: 'SET_TAG_SELECTION'; selection: Set<string> }
  | { type: 'SET_TAG_CUSTOM_TAGS'; customTags: Set<string> }
  | { type: 'SET_SAVED_SUMMARY_ID'; id: string }
  | { type: 'SET_STEP_WITH_ERROR'; step: Step; error: string }
  | { type: 'GENERATION_FAILED'; error: string; stayOnGenerating?: boolean }
  | { type: 'START_OVER' };

// ── Reducer ──────────────────────────────────────────────────────────

export function generationReducer(
  state: GenerationState,
  action: GenerationAction,
): GenerationState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.step, error: null };

    case 'SET_INPUT_METHOD':
      return { ...state, inputMethod: action.method };

    case 'SET_ERROR':
      return { ...state, error: action.error };

    case 'SET_RECORDINGS':
      return { ...state, recordings: action.recordings };

    case 'SET_LOADING_RECORDINGS':
      return { ...state, loadingRecordings: action.loading };

    case 'SET_PREFETCHED_RECORDINGS':
      return { ...state, prefetchedRecordings: action.recordings };

    case 'TRANSCRIPTS_LOADED':
      return {
        ...state,
        transcripts: action.transcripts,
        recordingTitles: action.recordingTitles,
        recordingDates: action.recordingDates,
        speakerNames: action.speakerNames,
        userSpeakerName: action.userSpeakerName,
        step: action.nextStep,
        error: null,
      };

    case 'SET_CONTEXT':
      return { ...state, context: action.context };

    case 'SET_SUMMARY_MODE':
      return { ...state, summaryMode: action.mode };

    // Reset all generation output and enter the generating step
    case 'GENERATION_START':
      return {
        ...state,
        streamingMarkdown: '',
        isStreaming: false,
        summaries: [],
        conceptTags: [],
        pearls: [],
        tagSelection: new Set(),
        tagCustomTags: new Set(),
        savedSummaryId: null,
        error: null,
        phase: initialPhase,
        step: 'generating',
      };

    case 'SSE_SUMMARY_CHUNK':
      return {
        ...state,
        streamingMarkdown: state.streamingMarkdown + action.text,
        isStreaming: true,
      };

    case 'SSE_SUMMARY_DONE':
      return {
        ...state,
        isStreaming: false,
        summaries: action.summaries ?? state.summaries,
        phase: { ...state.phase, summaryReady: true },
      };

    case 'SSE_TAGS_EXTRACTING':
      return {
        ...state,
        phase: { ...state.phase, tagsExtracting: true },
      };

    case 'SSE_TAGS_DONE':
      return {
        ...state,
        conceptTags: action.tags,
        phase: { ...state.phase, tagsExtracting: false, tagsReady: true },
      };

    case 'SSE_COMPLETE':
      return {
        ...state,
        savedSummaryId: action.savedSummaryId ?? state.savedSummaryId,
        summaries: action.summaries ?? state.summaries,
        conceptTags: action.tags ?? state.conceptTags,
        phase: {
          ...state.phase,
          summaryReady: true,
          tagsExtracting: false,
          tagsReady: true,
        },
        step: 'summary',
      };

    case 'PEARLS_GENERATING':
      return {
        ...state,
        error: null,
        phase: { ...state.phase, pearlsGenerating: true },
      };

    case 'PEARLS_DONE':
      return {
        ...state,
        pearls: action.pearls,
        phase: { ...state.phase, pearlsGenerating: false, pearlsReady: true },
      };

    case 'PEARLS_FAILED':
      return {
        ...state,
        phase: { ...state.phase, pearlsGenerating: false },
      };

    case 'SET_TAG_SELECTION':
      return { ...state, tagSelection: action.selection };

    case 'SET_TAG_CUSTOM_TAGS':
      return { ...state, tagCustomTags: action.customTags };

    case 'SET_SAVED_SUMMARY_ID':
      return { ...state, savedSummaryId: action.id };

    // Step transition that preserves an error message
    case 'SET_STEP_WITH_ERROR':
      return { ...state, step: action.step, error: action.error };

    // Atomic error + step transition — avoids SET_STEP clearing the error
    case 'GENERATION_FAILED':
      return {
        ...state,
        step: action.stayOnGenerating ? 'generating' : 'context-wizard',
        error: action.error,
        isStreaming: false,
      };

    // Full reset — preserves nothing (otterSession is external)
    case 'START_OVER':
      return { ...initialState };

    default:
      return state;
  }
}
