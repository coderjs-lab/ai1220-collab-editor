import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { StatusBanner } from '../../components/StatusBanner';
import type {
  AiContextScope,
  AiFeature,
  AiRewriteTone,
  AiSummaryFormat,
  AiSummaryLength,
  ApiAiHistoryItem,
} from '../../types/api';
import { formatCalendarTimestamp, formatRelativeTimestamp } from '../../utils/format';

type SegmentDecision = 'accepted' | 'rejected';
type AcceptedPartsApplyMode = 'replace-selection' | 'replace-draft' | 'append';

interface SuggestionSegment {
  id: string;
  text: string;
  joiner: string;
}

interface ReviewSegment {
  id: string;
  content: string;
  decision: SegmentDecision | null;
}

const featureOptions: Array<{
  value: AiFeature;
  label: string;
  hint: string;
}> = [
  {
    value: 'rewrite',
    label: 'Rewrite',
    hint: 'Rework the selected text while preserving meaning.',
  },
  {
    value: 'summarize',
    label: 'Summarize',
    hint: 'Condense the current selection or nearby context.',
  },
  {
    value: 'expand',
    label: 'Expand',
    hint: 'Add more detail or supporting explanation.',
  },
  {
    value: 'fix_grammar',
    label: 'Fix grammar',
    hint: 'Correct grammar, spelling, and punctuation.',
  },
  {
    value: 'custom',
    label: 'Custom prompt',
    hint: 'Use a fully custom instruction against the chosen context.',
  },
];

const contextOptions: Array<{ value: AiContextScope; label: string; hint: string }> = [
  {
    value: 'selection',
    label: 'Selection',
    hint: 'Limit the request to the selected text in the editor.',
  },
  {
    value: 'section',
    label: 'Section',
    hint: 'Use the selected text plus a nearby section-sized excerpt.',
  },
  {
    value: 'document',
    label: 'Document',
    hint: 'Use a wider document-aware context with title and structure.',
  },
];

const toneOptions: Array<{ value: AiRewriteTone; label: string }> = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'confident', label: 'Confident' },
  { value: 'concise', label: 'Concise' },
];

const summaryLengthOptions: Array<{ value: AiSummaryLength; label: string }> = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
];

const summaryFormatOptions: Array<{ value: AiSummaryFormat; label: string }> = [
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'bullets', label: 'Bullets' },
];

function historyStatusClasses(status: string | null | undefined) {
  if (status === 'accepted' || status === 'edited' || status === 'partial') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  }
  if (status === 'rejected') {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  if (status === 'failed' || status === 'cancelled') {
    return 'border-amber-200 bg-amber-50 text-amber-900';
  }
  return 'border-[color:var(--border)] bg-white/75 text-[color:var(--text-soft)]';
}

function promptLabel(feature: AiFeature) {
  if (feature === 'custom') {
    return 'Instruction';
  }
  if (feature === 'rewrite') {
    return 'Rewrite guidance';
  }
  if (feature === 'summarize') {
    return 'Summary guidance';
  }
  if (feature === 'expand') {
    return 'Expansion guidance';
  }
  return 'Editing guidance';
}

function promptHint(feature: AiFeature) {
  if (feature === 'custom') {
    return 'Required. Describe exactly what the assistant should do.';
  }
  if (feature === 'rewrite') {
    return 'Optional. Add a specific rewrite goal beyond the tone setting.';
  }
  if (feature === 'summarize') {
    return 'Optional. Add emphasis, audience, or structure preferences.';
  }
  return 'Optional. Add any extra instruction for this request.';
}

function isBulletLine(value: string) {
  return /^([-*•]|\d+[.)]|[A-Za-z][.)]|\[[ xX]\])\s+/.test(value);
}

function splitParagraphIntoSentences(value: string) {
  const matches = Array.from(value.matchAll(/[^.!?]+(?:[.!?]+(?:["')\]]+)?)|[^.!?]+$/g));
  if (matches.length < 2) {
    return [value.trim()];
  }

  return matches
    .map((match) => match[0].trim())
    .filter((part) => part.length > 0);
}

function hashSegment(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function truncateInline(value: string, limit: number) {
  const normalized = value.trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function splitSuggestionSegments(value: string): SuggestionSegment[] {
  const normalized = value.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const segments: SuggestionSegment[] = [];

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const paragraphJoiner = paragraphIndex < paragraphs.length - 1 ? '\n\n' : '';
    const lines = paragraph
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length > 1 && lines.every(isBulletLine)) {
      lines.forEach((line, lineIndex) => {
        segments.push({
          id: `${segments.length}:${hashSegment(line)}`,
          text: line,
          joiner: lineIndex < lines.length - 1 ? '\n' : paragraphJoiner,
        });
      });
      return;
    }

    const sentences = splitParagraphIntoSentences(paragraph);
    if (sentences.length > 1) {
      sentences.forEach((sentence, sentenceIndex) => {
        segments.push({
          id: `${segments.length}:${hashSegment(sentence)}`,
          text: sentence,
          joiner: sentenceIndex < sentences.length - 1 ? ' ' : paragraphJoiner,
        });
      });
      return;
    }

    segments.push({
      id: `${segments.length}:${hashSegment(paragraph)}`,
      text: paragraph,
      joiner: paragraphJoiner,
    });
  });

  return segments;
}

function buildInitialReviewSegments(value: string): ReviewSegment[] {
  return splitSuggestionSegments(value).map((segment) => ({
    id: segment.id,
    content: `${segment.text}${segment.joiner}`,
    decision: null,
  }));
}

function mergeReviewSegments(segments: ReviewSegment[]) {
  const next: ReviewSegment[] = [];

  for (const segment of segments) {
    if (!segment.content) {
      continue;
    }

    const previous = next[next.length - 1];
    if (previous && previous.decision === segment.decision) {
      previous.content += segment.content;
      continue;
    }

    next.push({ ...segment });
  }

  return next.map((segment, index) => ({
    ...segment,
    id: `${index}:${hashSegment(`${segment.decision ?? 'pending'}:${segment.content}`)}`,
  }));
}

function buildAcceptedSuggestion(segments: ReviewSegment[]) {
  const acceptedSegments = segments.filter((segment) => segment.decision === 'accepted');
  if (acceptedSegments.length === 0) {
    return '';
  }

  return acceptedSegments
    .map((segment) => segment.content)
    .join('')
    .trim();
}

function setDecisionForSegment(
  segments: ReviewSegment[],
  targetId: string,
  decision: SegmentDecision | null,
) {
  return mergeReviewSegments(
    segments.map((segment) =>
      segment.id === targetId
        ? {
            ...segment,
            decision,
          }
        : segment,
    ),
  );
}

function setDecisionForSelection(
  segments: ReviewSegment[],
  start: number,
  end: number,
  decision: SegmentDecision | null,
) {
  if (end <= start) {
    return segments;
  }

  let cursor = 0;
  const next: ReviewSegment[] = [];

  for (const segment of segments) {
    const segmentStart = cursor;
    const segmentEnd = cursor + segment.content.length;
    cursor = segmentEnd;

    if (end <= segmentStart || start >= segmentEnd) {
      next.push({ ...segment });
      continue;
    }

    const localStart = Math.max(0, start - segmentStart);
    const localEnd = Math.min(segment.content.length, end - segmentStart);
    const before = segment.content.slice(0, localStart);
    const selected = segment.content.slice(localStart, localEnd);
    const after = segment.content.slice(localEnd);

    if (before) {
      next.push({
        id: `${segment.id}:before`,
        content: before,
        decision: segment.decision,
      });
    }

    if (selected) {
      next.push({
        id: `${segment.id}:selected`,
        content: selected,
        decision,
      });
    }

    if (after) {
      next.push({
        id: `${segment.id}:after`,
        content: after,
        decision: segment.decision,
      });
    }
  }

  return mergeReviewSegments(next);
}

interface AIAssistantPanelProps {
  canInvoke: boolean;
  canApplySuggestion: boolean;
  canUndoAiApply: boolean;
  hasSelectionContext: boolean;
  feature: AiFeature;
  prompt: string;
  promptError: string | null;
  context: AiContextScope;
  tone: AiRewriteTone;
  summaryLength: AiSummaryLength;
  summaryFormat: AiSummaryFormat;
  suggestion: string;
  suggestionSourceText: string;
  lastPrompt: string | null;
  lastModel: string | null;
  isSuggesting: boolean;
  suggestError: string | null;
  history: ApiAiHistoryItem[];
  historyError: string | null;
  isLoadingHistory: boolean;
  onFeatureChange: (value: AiFeature) => void;
  onPromptChange: (value: string) => void;
  onContextChange: (value: AiContextScope) => void;
  onToneChange: (value: AiRewriteTone) => void;
  onSummaryLengthChange: (value: AiSummaryLength) => void;
  onSummaryFormatChange: (value: AiSummaryFormat) => void;
  onSuggestionChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onRetryHistory: () => void;
  onReplaceDraft: (suggestion: string) => void;
  onReplaceSelection: (suggestion: string) => void;
  onAppendSuggestion: (suggestion: string) => void;
  onApplyAcceptedParts: (suggestion: string, mode: AcceptedPartsApplyMode) => void;
  onApplySelectedFragment: (fragment: string) => void;
  onRejectSuggestion: () => void;
  onUndoApply: () => void;
  onDismissSuggestion: () => void;
  embedded?: boolean;
}

export function AIAssistantPanel({
  canInvoke,
  canApplySuggestion,
  canUndoAiApply,
  hasSelectionContext,
  feature,
  prompt,
  promptError,
  context,
  tone,
  summaryLength,
  summaryFormat,
  suggestion,
  suggestionSourceText,
  lastPrompt,
  lastModel,
  isSuggesting,
  suggestError,
  history,
  historyError,
  isLoadingHistory,
  onFeatureChange,
  onPromptChange,
  onContextChange,
  onToneChange,
  onSummaryLengthChange,
  onSummaryFormatChange,
  onSuggestionChange,
  onSubmit,
  onCancel,
  onRetryHistory,
  onReplaceDraft,
  onReplaceSelection,
  onAppendSuggestion,
  onApplyAcceptedParts,
  onApplySelectedFragment,
  onRejectSuggestion,
  onUndoApply,
  onDismissSuggestion,
  embedded = false,
}: AIAssistantPanelProps) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [selectedFragment, setSelectedFragment] = useState('');
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });
  const [reviewSegments, setReviewSegments] = useState<ReviewSegment[]>(() =>
    buildInitialReviewSegments(suggestion),
  );
  const suggestionRef = useRef<HTMLTextAreaElement | null>(null);

  const sectionClassName = [
    embedded ? '' : 'shell-card rounded-[32px] p-5',
    'ai-panel',
    embedded ? 'ai-panel--embedded' : '',
  ].join(' ');
  const compactButtonClassName =
    'ai-panel__compact-button h-7 min-h-0 w-full rounded-full px-3 py-1 text-[0.5rem] font-semibold tracking-[0.02em]';
  const compactGhostButtonClassName =
    'ai-panel__compact-button h-7 min-h-0 w-full rounded-full px-3 py-1 text-[0.5rem] font-semibold tracking-[0.02em]';
  const visibleReviewSegments = useMemo(
    () => reviewSegments.filter((segment) => segment.content.trim().length > 0),
    [reviewSegments],
  );

  const featureHint =
    featureOptions.find((option) => option.value === feature)?.hint ??
    'Generate a document-ready AI suggestion.';

  const canApplySelectedFragment =
    canApplySuggestion && selectedFragment.trim().length > 0 && !isSuggesting;
  const canReviewSelectedFragment = selectedFragment.trim().length > 0 && !isSuggesting;
  const acceptedSegmentCount = visibleReviewSegments.filter(
    (segment) => segment.decision === 'accepted',
  ).length;
  const rejectedSegmentCount = visibleReviewSegments.filter(
    (segment) => segment.decision === 'rejected',
  ).length;
  const pendingSegmentCount =
    visibleReviewSegments.length - acceptedSegmentCount - rejectedSegmentCount;
  const acceptedSuggestion = useMemo(() => buildAcceptedSuggestion(reviewSegments), [reviewSegments]);
  const canApplyAcceptedParts =
    canApplySuggestion && acceptedSuggestion.trim().length > 0 && !isSuggesting;
  const acceptedAllSegments =
    visibleReviewSegments.length > 0 && acceptedSegmentCount === visibleReviewSegments.length;

  const suggestionLabel = useMemo(() => {
    if (feature === 'rewrite') {
      return 'Suggested rewrite';
    }
    if (feature === 'summarize') {
      return 'Suggested summary';
    }
    if (feature === 'expand') {
      return 'Expanded draft';
    }
    if (feature === 'fix_grammar') {
      return 'Corrected text';
    }
    return 'Assistant suggestion';
  }, [feature]);
  const assistantStatusLabel = isSuggesting
    ? 'Streaming'
    : suggestion.trim()
      ? 'Suggestion ready'
      : canInvoke
        ? 'Ready to draft'
        : 'History only';
  const historySummary =
    history.length === 0 ? 'No runs yet' : history.length === 1 ? '1 request' : `${history.length} requests`;

  useEffect(() => {
    setCopyMessage(null);
  }, [suggestion, history]);

  useEffect(() => {
    setReviewSegments(buildInitialReviewSegments(suggestion));
    setSelectedFragment('');
    setSelectedRange({ start: 0, end: 0 });
  }, [suggestion]);

  function updateSelectedFragment() {
    const element = suggestionRef.current;
    if (!element) {
      setSelectedFragment('');
      setSelectedRange({ start: 0, end: 0 });
      return;
    }

    const start = element.selectionStart;
    const end = element.selectionEnd;
    const next = element.value.slice(start, end).trim();
    setSelectedFragment(next);
    setSelectedRange({ start, end });
  }

  function preserveSuggestionSelection(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
  }

  function setSegmentDecision(segmentId: string, decision: SegmentDecision | null) {
    setReviewSegments((current) => setDecisionForSegment(current, segmentId, decision));
  }

  function clearSegmentDecisions() {
    setReviewSegments(buildInitialReviewSegments(suggestion));
  }

  function setSelectedFragmentDecision(decision: SegmentDecision | null) {
    if (selectedRange.end <= selectedRange.start) {
      return;
    }

    setReviewSegments((current) =>
      setDecisionForSelection(current, selectedRange.start, selectedRange.end, decision),
    );
  }

  function applyAcceptedParts(mode: AcceptedPartsApplyMode) {
    if (!acceptedSuggestion.trim()) {
      return;
    }

    if (acceptedAllSegments) {
      if (mode === 'replace-selection') {
        onReplaceSelection(acceptedSuggestion);
        return;
      }
      if (mode === 'replace-draft') {
        onReplaceDraft(acceptedSuggestion);
        return;
      }
      onAppendSuggestion(acceptedSuggestion);
      return;
    }

    onApplyAcceptedParts(acceptedSuggestion, mode);
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage('Copied to clipboard.');
    } catch {
      setCopyMessage('Clipboard access is unavailable in this browser.');
    }
  }

  return (
    <section className={sectionClassName}>
      <header className="ai-panel__header">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="ai-panel__eyebrow">AI assistant</p>
          </div>
          <div className="space-y-1">
            <h2 className="ai-panel__title">
              {embedded ? 'Writing help' : 'Document writing assistant'}
            </h2>
            <p className="ai-panel__subtitle">
              Generate, compare, and apply only the text you actually want in the shared draft.
            </p>
          </div>
        </div>

      </header>

      <div className="ai-panel__overview">
        <div className="ai-panel__overview-card">
          <p className="ai-panel__overview-label">Status</p>
          <p className="ai-panel__overview-value">{assistantStatusLabel}</p>
        </div>
        <div className="ai-panel__overview-card">
          <p className="ai-panel__overview-label">History</p>
          <p className="ai-panel__overview-value">{historySummary}</p>
        </div>
      </div>

      {copyMessage ? <StatusBanner title={copyMessage} tone="success" /> : null}
      {suggestError ? <StatusBanner title={suggestError} tone="danger" /> : null}

      {canInvoke ? (
        <div className="ai-card ai-card--soft">
          <div className="ai-panel__control-grid">
            <label className="ai-field">
              <span className="ai-field__label">Action</span>
              <select
                className="ai-field__control"
                aria-label="AI action"
                onChange={(event) => onFeatureChange(event.target.value as AiFeature)}
                value={feature}
              >
                {featureOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="ai-field">
              <span className="ai-field__label">Context scope</span>
              <select
                className="ai-field__control"
                aria-label="Context scope"
                onChange={(event) => onContextChange(event.target.value as AiContextScope)}
                value={context}
              >
                {contextOptions.map((option) => (
                  <option
                    disabled={option.value === 'selection' && !hasSelectionContext}
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {feature === 'rewrite' ? (
              <label className="ai-field">
                <span className="ai-field__label">Tone</span>
                <select
                  className="ai-field__control"
                  aria-label="Tone"
                  onChange={(event) => onToneChange(event.target.value as AiRewriteTone)}
                  value={tone}
                >
                  {toneOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {feature === 'summarize' ? (
              <>
                <label className="ai-field">
                  <span className="ai-field__label">Summary length</span>
                  <select
                    className="ai-field__control"
                    aria-label="Summary length"
                    onChange={(event) =>
                      onSummaryLengthChange(event.target.value as AiSummaryLength)
                    }
                    value={summaryLength}
                  >
                    {summaryLengthOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ai-field">
                  <span className="ai-field__label">Summary format</span>
                  <select
                    className="ai-field__control"
                    aria-label="Summary format"
                    onChange={(event) =>
                      onSummaryFormatChange(event.target.value as AiSummaryFormat)
                    }
                    value={summaryFormat}
                  >
                    {summaryFormatOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
          </div>

          <label className="ai-field ai-field--wide">
            <span className="ai-field__label">{promptLabel(feature)}</span>
            <textarea
              className="ai-field__textarea"
              onChange={(event) => onPromptChange(event.target.value)}
              placeholder={
                feature === 'custom'
                  ? 'For example: rewrite this paragraph for a technical audience and keep the tone formal.'
                  : 'Optional extra instruction...'
              }
              value={prompt}
            />
          </label>

          {promptError ? (
            <p className="text-sm font-medium text-red-700">{promptError}</p>
          ) : null}

          <div className="ai-panel__composer-footer">
            <div className="ai-panel__toolbar-actions">
              <Button
                className={compactButtonClassName}
                disabled={isSuggesting}
                onClick={onSubmit}
              >
                {isSuggesting ? 'Streaming...' : 'Generate'}
              </Button>
              {isSuggesting ? (
                <Button
                  className={compactGhostButtonClassName}
                  onClick={onCancel}
                  variant="ghost"
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="ai-card ai-card--soft">
          <p className="ai-panel__microcopy">
            You can review assistant history here, but only owners and editors can generate new
            suggestions.
          </p>
        </div>
      )}

      {suggestion || isSuggesting ? (
        <section className="ai-card ai-card--active ai-card--suggestion-surface">
          <div className="ai-panel__section-header ai-panel__section-header--suggestion">
            <div className="min-w-0">
              <p className="ai-panel__section-label">{suggestionLabel}</p>
            </div>
            <div className="ai-panel__toolbar-actions ai-panel__toolbar-actions--header">
              <Button
                aria-label="Dismiss suggestion"
                className={`${compactGhostButtonClassName} ai-panel__dismiss-button`}
                onClick={onDismissSuggestion}
                variant="ghost"
              >
                <svg
                  aria-hidden="true"
                  className="ai-panel__dismiss-icon"
                  viewBox="0 0 12 12"
                >
                  <path
                    d="M2 2L10 10M10 2L2 10"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.6"
                  />
                </svg>
              </Button>
            </div>
          </div>

          <details className="ai-details">
            <summary className="ai-details__summary">
              <div className="space-y-1">
                <p className="ai-panel__section-label">Source context</p>
                <p className="ai-panel__section-copy">
                  Review the exact context sent with this request.
                </p>
              </div>
            </summary>
            <div className="ai-details__body editor-copy">
              {suggestionSourceText || 'No source context was available for this request.'}
            </div>
          </details>

          <label className="ai-card ai-card--editor">
            <div className="ai-panel__section-header ai-panel__section-header--tight">
              <p className="ai-panel__section-label">Suggestion</p>
            </div>
            <textarea
              ref={suggestionRef}
              aria-label="Suggestion"
              className="ai-suggestion-editor"
              onChange={(event) => onSuggestionChange(event.target.value)}
              onKeyUp={updateSelectedFragment}
              onMouseUp={updateSelectedFragment}
              onSelect={updateSelectedFragment}
              placeholder={
                isSuggesting
                  ? 'Streaming response...'
                  : 'The assistant suggestion will appear here.'
              }
              readOnly={isSuggesting}
              value={suggestion}
            />
          </label>

          {selectedFragment ? (
            <div className="ai-card ai-card--soft ai-panel__selected-fragment-card">
              <div className="min-w-0 space-y-1">
                <div className="ai-panel__section-header ai-panel__section-header--tight">
                  <p className="ai-panel__section-label">Selected text</p>
                </div>
                <p className="ai-panel__section-copy">{truncateInline(selectedFragment, 120)}</p>
              </div>
              <div className="ai-panel__toolbar-actions ai-panel__toolbar-actions--selected">
                <Button
                  aria-label="Accept selected text"
                  className={compactButtonClassName}
                  disabled={!canReviewSelectedFragment}
                  onMouseDown={preserveSuggestionSelection}
                  onClick={() => setSelectedFragmentDecision('accepted')}
                  variant="secondary"
                >
                  Accept
                </Button>
                <Button
                  aria-label="Reject selected text"
                  className={compactButtonClassName}
                  disabled={!canReviewSelectedFragment}
                  onMouseDown={preserveSuggestionSelection}
                  onClick={() => setSelectedFragmentDecision('rejected')}
                  variant="danger"
                >
                  Reject
                </Button>
                <Button
                  aria-label="Reset selected text"
                  className={compactGhostButtonClassName}
                  disabled={!canReviewSelectedFragment}
                  onMouseDown={preserveSuggestionSelection}
                  onClick={() => setSelectedFragmentDecision(null)}
                  variant="ghost"
                >
                  Reset
                </Button>
              </div>
            </div>
          ) : null}

          <div className="ai-panel__button-grid ai-panel__button-grid--suggestion">
            <Button
              className={compactGhostButtonClassName}
              disabled={!suggestion.trim()}
              onClick={() => void copyText(suggestion)}
              variant="ghost"
            >
              Copy
            </Button>
            <Button
              className={compactButtonClassName}
              disabled={!canApplySuggestion || !hasSelectionContext || !suggestion.trim()}
              onClick={() => onReplaceSelection(suggestion)}
              variant="secondary"
            >
              Replace selection
            </Button>
            <Button
              className={compactButtonClassName}
              disabled={!canApplySuggestion || !suggestion.trim()}
              onClick={() => onReplaceDraft(suggestion)}
              variant="secondary"
            >
              Replace draft
            </Button>
            <Button
              className={compactButtonClassName}
              disabled={!canApplySuggestion || !suggestion.trim()}
              onClick={() => onAppendSuggestion(suggestion)}
              variant="secondary"
            >
              Append below
            </Button>
            <Button
              aria-label="Apply selected fragment"
              className={compactButtonClassName}
              disabled={!canApplySelectedFragment}
              onMouseDown={preserveSuggestionSelection}
              onClick={() => onApplySelectedFragment(selectedFragment)}
              variant="secondary"
            >
              Apply fragment
            </Button>
            <Button
              className={compactButtonClassName}
              disabled={!suggestion.trim()}
              onClick={onRejectSuggestion}
              variant="danger"
            >
              Reject
            </Button>
            <Button
              className={`${compactGhostButtonClassName} ai-panel__button-grid-button--center`}
              disabled={!canUndoAiApply}
              onClick={onUndoApply}
              variant="ghost"
            >
              Undo apply
            </Button>
          </div>

          {visibleReviewSegments.length > 1 || selectedFragment ? (
            <details className="ai-details ai-details--partial">
              <summary className="ai-details__summary">
                <div className="space-y-1">
                  <p className="ai-panel__section-label">Partial acceptance</p>
                  <p className="ai-panel__section-copy">
                    Review sentence-level parts or exact highlighted ranges.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="ai-panel__badge ai-panel__badge--accepted">
                    {acceptedSegmentCount} accepted
                  </span>
                  <span className="ai-panel__badge ai-panel__badge--rejected">
                    {rejectedSegmentCount} rejected
                  </span>
                  <span className="ai-panel__badge">{pendingSegmentCount} pending</span>
                </div>
              </summary>

              <div className="ai-details__body space-y-4">
                <div className="ai-scroll space-y-3">
                  {visibleReviewSegments.map((segment, index) => {
                    const decision = segment.decision;
                    return (
                      <article
                        key={segment.id}
                        className={[
                          'ai-review-segment',
                          decision === 'accepted'
                            ? 'ai-review-segment--accepted'
                            : decision === 'rejected'
                              ? 'ai-review-segment--rejected'
                              : '',
                        ].join(' ')}
                      >
                        <div className="ai-panel__section-header ai-panel__section-header--tight">
                          <div className="min-w-0 space-y-1">
                            <p className="ai-panel__section-label">Part {index + 1}</p>
                            <p className="text-sm leading-6 text-[color:var(--text)]">
                              {segment.content.trim()}
                            </p>
                          </div>
                          <div className="ai-panel__toolbar-actions">
                            <Button
                              aria-label={
                                decision === 'accepted'
                                  ? `Accepted part ${index + 1}`
                                  : `Accept part ${index + 1}`
                              }
                              className={compactButtonClassName}
                              onClick={() =>
                                setSegmentDecision(
                                  segment.id,
                                  decision === 'accepted' ? null : 'accepted',
                                )
                              }
                              variant={decision === 'accepted' ? 'primary' : 'secondary'}
                            >
                              {decision === 'accepted' ? 'Accepted' : 'Accept'}
                            </Button>
                            <Button
                              aria-label={
                                decision === 'rejected'
                                  ? `Rejected part ${index + 1}`
                                  : `Reject part ${index + 1}`
                              }
                              className={compactGhostButtonClassName}
                              onClick={() =>
                                setSegmentDecision(
                                  segment.id,
                                  decision === 'rejected' ? null : 'rejected',
                                )
                              }
                              variant={decision === 'rejected' ? 'danger' : 'ghost'}
                            >
                              {decision === 'rejected' ? 'Rejected' : 'Reject'}
                            </Button>
                            {decision ? (
                              <Button
                                aria-label={`Reset part ${index + 1}`}
                                className={compactGhostButtonClassName}
                                onClick={() => setSegmentDecision(segment.id, null)}
                                variant="ghost"
                              >
                                Reset
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="ai-card ai-card--soft">
                  <div className="ai-panel__section-header ai-panel__section-header--tight">
                    <div className="space-y-1">
                      <p className="ai-panel__section-label">Accepted output</p>
                      <p className="ai-panel__section-copy">
                        Only accepted parts will be applied to the document.
                      </p>
                    </div>
                    <Button
                      className={compactGhostButtonClassName}
                      disabled={acceptedSegmentCount === 0 && rejectedSegmentCount === 0}
                      onClick={clearSegmentDecisions}
                      variant="ghost"
                    >
                      Clear decisions
                    </Button>
                  </div>

                  <div className="ai-output-preview editor-copy">
                    {acceptedSuggestion || 'No accepted parts yet.'}
                  </div>

                  <div className="ai-panel__button-grid ai-panel__button-grid--accepted">
                    <Button
                      className={compactButtonClassName}
                      disabled={!canApplyAcceptedParts || !hasSelectionContext}
                      onClick={() => applyAcceptedParts('replace-selection')}
                      variant="secondary"
                    >
                      Replace selection
                    </Button>
                    <Button
                      className={compactButtonClassName}
                      disabled={!canApplyAcceptedParts}
                      onClick={() => applyAcceptedParts('replace-draft')}
                      variant="secondary"
                    >
                      Replace draft
                    </Button>
                    <Button
                      aria-label="Append accepted below"
                      className={compactButtonClassName}
                      disabled={!canApplyAcceptedParts}
                      onClick={() => applyAcceptedParts('append')}
                      variant="secondary"
                    >
                      Append accepted
                    </Button>
                  </div>
                </div>
              </div>
            </details>
          ) : null}
        </section>
      ) : (
        <section className="ai-card ai-card--soft">
          <div className="ai-panel__section-header ai-panel__section-header--tight">
            <div className="space-y-1">
              <p className="ai-panel__section-label">Suggestion workspace</p>
              <p className="ai-panel__section-copy">
                Generate a response to review, edit, partially accept, and apply through the collaborative editor.
              </p>
            </div>
          </div>

          <div className="ai-panel__hint-grid">
            <div className="ai-panel__hint-card">
              <p className="ai-panel__hint-title">Draft</p>
              <p className="ai-panel__hint-copy">Create a new rewrite, summary, or expansion from the selected scope.</p>
            </div>
            <div className="ai-panel__hint-card">
              <p className="ai-panel__hint-title">Review</p>
              <p className="ai-panel__hint-copy">Edit the suggestion directly or approve only the exact fragments you want.</p>
            </div>
            <div className="ai-panel__hint-card">
              <p className="ai-panel__hint-title">Apply</p>
              <p className="ai-panel__hint-copy">Replace the selection, replace the draft, or append the approved output below.</p>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="ai-panel__section-header ai-panel__section-header--tight">
          <div className="space-y-1">
            <p className="ai-panel__section-label">Assistant history</p>
            <p className="ai-panel__section-copy">
              Prompt, context, model, and apply decisions for this document.
            </p>
          </div>
          <span className="ai-panel__badge">{history.length} entries</span>
        </div>

        {historyError ? (
          <div className="space-y-3">
            <StatusBanner title={historyError} tone="danger" />
            <Button className={compactButtonClassName} onClick={onRetryHistory} variant="secondary">
              Retry history
            </Button>
          </div>
        ) : isLoadingHistory ? (
          <div className="ai-card ai-card--soft">
            <p className="ai-panel__microcopy">Loading assistant history...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="ai-card ai-card--soft">
            <p className="ai-panel__microcopy">No assistant requests yet for this document.</p>
          </div>
        ) : (
          <div className="ai-scroll space-y-3">
            {history.map((item) => (
              <details className="ai-history-card" key={item.id}>
                <summary className="ai-history-card__summary">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-[color:var(--text)]">
                      {item.username}
                    </p>
                    <p className="ai-panel__section-copy">
                      {truncateInline(item.prompt, 88)}
                    </p>
                    <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                      {formatRelativeTimestamp(item.created_at)}
                    </p>
                  </div>
                  <span
                    className={[
                      'rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]',
                      historyStatusClasses(item.status),
                    ].join(' ')}
                  >
                    {item.status ?? 'generated'}
                  </span>
                </summary>

                <div className="ai-history-card__body">
                  {(item.context_scope || item.context_preview) ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="ai-panel__section-label">Input context</p>
                        {item.context_scope ? (
                          <span className="ai-panel__badge">{item.context_scope}</span>
                        ) : null}
                      </div>
                      <div className="ai-history-block">
                        {item.context_preview?.trim() || 'No context preview was captured.'}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <p className="ai-panel__section-label">Prompt</p>
                    <div className="ai-history-block">{item.prompt}</div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="ai-panel__section-label">Response</p>
                      {item.response ? (
                        <Button
                          className={compactGhostButtonClassName}
                          onClick={() => void copyText(item.response)}
                          variant="ghost"
                        >
                          Copy response
                        </Button>
                      ) : null}
                    </div>
                    <div className="ai-history-block editor-copy">
                      {item.response?.trim() || 'No response recorded.'}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em] text-[color:var(--text-soft)]">
                    <span>{formatCalendarTimestamp(item.created_at)}</span>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
