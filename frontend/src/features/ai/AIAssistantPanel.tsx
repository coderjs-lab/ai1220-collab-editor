import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { SelectField, TextareaField } from '../../components/Field';
import { StatusBanner } from '../../components/StatusBanner';
import type { ApiAiHistoryItem } from '../../types/api';
import { formatCalendarTimestamp, formatRelativeTimestamp } from '../../utils/format';
import type { AiContextScope } from './useDocumentAi';

const contextOptions: Array<{ value: AiContextScope; label: string; hint: string }> = [
  {
    value: 'document',
    label: 'Whole document',
    hint: 'Use the full draft as the assistant context for this request.',
  },
  {
    value: 'section',
    label: 'Section',
    hint: 'Focus the assistant on a smaller section of the draft.',
  },
  {
    value: 'selection',
    label: 'Selection',
    hint: 'Use a narrow excerpt when the text scope is intentionally small.',
  },
];

interface AIAssistantPanelProps {
  canInvoke: boolean;
  canApplySuggestion: boolean;
  prompt: string;
  promptError: string | null;
  context: AiContextScope;
  suggestion: string | null;
  lastPrompt: string | null;
  isSuggesting: boolean;
  suggestError: string | null;
  history: ApiAiHistoryItem[];
  historyError: string | null;
  isLoadingHistory: boolean;
  onPromptChange: (value: string) => void;
  onContextChange: (value: AiContextScope) => void;
  onSubmit: () => void;
  onRetryHistory: () => void;
  onReplaceDraft: (suggestion: string) => void;
  onAppendSuggestion: (suggestion: string) => void;
  onDismissSuggestion: () => void;
}

export function AIAssistantPanel({
  canInvoke,
  canApplySuggestion,
  prompt,
  promptError,
  context,
  suggestion,
  lastPrompt,
  isSuggesting,
  suggestError,
  history,
  historyError,
  isLoadingHistory,
  onPromptChange,
  onContextChange,
  onSubmit,
  onRetryHistory,
  onReplaceDraft,
  onAppendSuggestion,
  onDismissSuggestion,
}: AIAssistantPanelProps) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    setCopyMessage(null);
  }, [suggestion, history]);

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage('Copied to clipboard.');
    } catch {
      setCopyMessage('Clipboard access is unavailable in this browser.');
    }
  }

  return (
    <section className="shell-card rounded-[32px] p-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[color:var(--text-soft)]">
            Assistant
          </p>
          <span className="rounded-full border border-[color:var(--border-strong)] bg-[color:var(--teal-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-900">
            Beta
          </span>
        </div>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-[color:var(--text)]">
          AI writing help
        </h2>
        <p className="text-sm leading-6 text-[color:var(--text-soft)]">
          Draft, rewrite, summarize, or continue text from inside the editor. Responses are still
          backed by the current beta assistant service.
        </p>
      </div>

      <div className="mt-5">
        <StatusBanner title="Assistant responses are still in beta." tone="warning">
          Expect early-stage outputs while the backend integration is being finalized.
        </StatusBanner>
      </div>

      {copyMessage ? (
        <div className="mt-5">
          <StatusBanner title={copyMessage} tone="success" />
        </div>
      ) : null}

      {canInvoke ? (
        <div className="mt-5 space-y-4 rounded-[24px] border border-[color:var(--border)] bg-white/80 p-4">
          <TextareaField
            className="min-h-[7rem]"
            error={promptError}
            hint="Describe what you want, for example: rewrite this opening in a more formal tone."
            label="Ask the assistant"
            onChange={(event) => onPromptChange(event.target.value)}
            placeholder="Rewrite this paragraph to sound more concise and professional."
            value={prompt}
          />

          <SelectField
            hint={contextOptions.find((option) => option.value === context)?.hint}
            label="Context scope"
            onChange={(event) => onContextChange(event.target.value as AiContextScope)}
            value={context}
          >
            {contextOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>

          <Button disabled={isSuggesting} onClick={onSubmit}>
            {isSuggesting ? 'Generating...' : 'Generate suggestion'}
          </Button>
        </div>
      ) : (
        <div className="mt-5 rounded-[24px] border border-[color:var(--border)] bg-white/80 px-4 py-4 text-sm leading-6 text-[color:var(--text-soft)]">
          You can review assistant history here, but only owners and editors can generate new
          suggestions.
        </div>
      )}

      {suggestError ? (
        <div className="mt-5">
          <StatusBanner title={suggestError} tone="danger" />
        </div>
      ) : null}

      {suggestion ? (
        <div className="mt-5 rounded-[24px] border border-[color:var(--border-strong)] bg-[color:var(--teal-soft)]/55 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[color:var(--text)]">Latest suggestion</p>
              {lastPrompt ? (
                <p className="mt-1 text-sm text-[color:var(--text-soft)]">
                  Prompt: {lastPrompt}
                </p>
              ) : null}
            </div>
            <Button onClick={onDismissSuggestion} variant="ghost">
              Dismiss
            </Button>
          </div>

          <div className="editor-copy mt-4 rounded-[22px] border border-[color:var(--border)] bg-white/90 px-4 py-4 text-[15px] leading-7 whitespace-pre-wrap text-[color:var(--text)]">
            {suggestion}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => void copyText(suggestion)} variant="ghost">
              Copy
            </Button>
            <Button
              disabled={!canApplySuggestion}
              onClick={() => onReplaceDraft(suggestion)}
              variant="secondary"
            >
              Replace draft
            </Button>
            <Button
              disabled={!canApplySuggestion}
              onClick={() => onAppendSuggestion(suggestion)}
              variant="secondary"
            >
              Append below
            </Button>
          </div>

          {!canApplySuggestion ? (
            <p className="mt-3 text-sm text-[color:var(--text-soft)]">
              You can copy this suggestion, but only editable drafts can apply it locally.
            </p>
          ) : (
            <p className="mt-3 text-sm text-[color:var(--text-soft)]">
              Applying a suggestion updates only your local draft. Save when you are ready.
            </p>
          )}
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[color:var(--text)]">Assistant history</p>
            <p className="text-sm text-[color:var(--text-soft)]">
              Previous prompts and generated responses for this document.
            </p>
          </div>
        </div>

        {historyError ? (
          <div className="space-y-3">
            <StatusBanner title={historyError} tone="danger" />
            <Button onClick={onRetryHistory} variant="secondary">
              Retry history
            </Button>
          </div>
        ) : isLoadingHistory ? (
          <div className="rounded-[24px] border border-[color:var(--border)] bg-white/75 px-4 py-5 text-sm leading-6 text-[color:var(--text-soft)]">
            Loading assistant history...
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-[24px] border border-[color:var(--border)] bg-white/75 px-4 py-5 text-sm leading-6 text-[color:var(--text-soft)]">
            No assistant requests yet for this document.
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <article
                key={item.id}
                className="rounded-[24px] border border-[color:var(--border)] bg-white/80 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--text)]">
                      {item.username}
                    </p>
                    <p className="text-sm text-[color:var(--text-soft)]">
                      {formatRelativeTimestamp(item.created_at)}
                    </p>
                  </div>
                  <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                    {formatCalendarTimestamp(item.created_at)}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                      Prompt
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--text)]">{item.prompt}</p>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                        Response
                      </p>
                      {item.response ? (
                        <Button onClick={() => void copyText(item.response)} variant="ghost">
                          Copy response
                        </Button>
                      ) : null}
                    </div>
                    <div className="editor-copy mt-2 rounded-[20px] border border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(249,247,241,0.98))] px-4 py-4 text-[15px] leading-7 whitespace-pre-wrap text-[color:var(--text)]">
                      {item.response?.trim() || 'No response recorded.'}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
