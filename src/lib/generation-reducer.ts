import type { SummaryContext } from './claude';
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
  | {
      type: 'SSE_COMPLETE';
      savedSummaryId?: string;
      summaries?: SummaryContent;
    }
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
        savedSummaryId: null,
        error: null,
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
      };

    case 'SSE_COMPLETE':
      return {
        ...state,
        savedSummaryId: action.savedSummaryId ?? state.savedSummaryId,
        summaries: action.summaries ?? state.summaries,
        step: 'summary',
      };

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
