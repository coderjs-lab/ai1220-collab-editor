import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '../../services/api';
import type {
  AiContextScope,
  AiDecisionStatus,
  AiFeature,
  AiRewriteTone,
  AiSummaryFormat,
  AiSummaryLength,
  ApiAiHistoryItem,
} from '../../types/api';

const DEFAULT_FEATURE: AiFeature = 'rewrite';
const DEFAULT_CONTEXT: AiContextScope = 'section';

function truncate(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function buildContextPreview(
  context: AiContextScope,
  selectionText: string,
  documentPlainText: string,
) {
  const normalizedSelection = selectionText.trim();
  const normalizedDocument = documentPlainText.trim();

  if (context === 'selection' && normalizedSelection) {
    return truncate(normalizedSelection, 900);
  }

  if (context === 'section' && normalizedSelection) {
    const index = normalizedDocument.toLowerCase().indexOf(normalizedSelection.toLowerCase());
    if (index >= 0) {
      const start = Math.max(0, index - 700);
      const end = Math.min(
        normalizedDocument.length,
        index + normalizedSelection.length + 700,
      );
      return truncate(normalizedDocument.slice(start, end), 1400);
    }
  }

  return truncate(normalizedDocument || normalizedSelection || 'Document is empty.', 1700);
}

export function useDocumentAi(
  documentId: string | null,
  selectionText: string,
  documentPlainText: string,
) {
  const [feature, setFeature] = useState<AiFeature>(DEFAULT_FEATURE);
  const [prompt, setPrompt] = useState('');
  const [context, setContext] = useState<AiContextScope>(DEFAULT_CONTEXT);
  const [tone, setTone] = useState<AiRewriteTone>('professional');
  const [summaryLength, setSummaryLength] = useState<AiSummaryLength>('short');
  const [summaryFormat, setSummaryFormat] = useState<AiSummaryFormat>('paragraph');
  const [promptError, setPromptError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState('');
  const [initialSuggestion, setInitialSuggestion] = useState('');
  const [suggestionSourceText, setSuggestionSourceText] = useState('');
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [lastModel, setLastModel] = useState<string | null>(null);
  const [activeInteractionId, setActiveInteractionId] = useState<number | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [history, setHistory] = useState<ApiAiHistoryItem[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyReloadKey, setHistoryReloadKey] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  const hasSelectionContext = selectionText.trim().length > 0;
  const isSuggestionEdited =
    suggestion.trim().length > 0 && suggestion.trim() !== initialSuggestion.trim();

  const fallbackContextPreview = useMemo(
    () => buildContextPreview(context, selectionText, documentPlainText),
    [context, selectionText, documentPlainText],
  );

  useEffect(() => {
    setFeature(DEFAULT_FEATURE);
    setPrompt('');
    setContext(DEFAULT_CONTEXT);
    setTone('professional');
    setSummaryLength('short');
    setSummaryFormat('paragraph');
    setPromptError(null);
    setSuggestion('');
    setInitialSuggestion('');
    setSuggestionSourceText('');
    setLastPrompt(null);
    setLastModel(null);
    setActiveInteractionId(null);
    setIsSuggesting(false);
    setSuggestError(null);
    setHistory([]);
    setHistoryError(null);
    setIsLoadingHistory(false);
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, [documentId]);

  useEffect(() => {
    if (!hasSelectionContext && context === 'selection') {
      setContext(DEFAULT_CONTEXT);
    }
  }, [hasSelectionContext, context]);

  useEffect(() => {
    if (!documentId) {
      return;
    }

    let alive = true;
    setIsLoadingHistory(true);
    setHistoryError(null);

    api.ai
      .history(documentId)
      .then((response) => {
        if (!alive) {
          return;
        }

        const sortedHistory = [...response.history].sort(
          (left, right) =>
            new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
        );

        setHistory(sortedHistory);
      })
      .catch((error) => {
        if (!alive) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          return;
        }

        setHistoryError(
          error instanceof ApiError ? error.error : 'Could not load assistant history.',
        );
      })
      .finally(() => {
        if (alive) {
          setIsLoadingHistory(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [documentId, historyReloadKey]);

  async function submitSuggestion() {
    if (!documentId) {
      return false;
    }

    if (feature === 'custom' && !prompt.trim()) {
      setPromptError('Enter an instruction before asking the assistant.');
      return false;
    }

    setPromptError(null);
    setSuggestError(null);
    setIsSuggesting(true);
    setSuggestion('');
    setInitialSuggestion('');
    setActiveInteractionId(null);
    setLastModel(null);
    setSuggestionSourceText(fallbackContextPreview);

    const nextPrompt = prompt.trim();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let latestSuggestion = '';
    let streamFailed = false;

    try {
      await api.ai.streamSuggestion(
        documentId,
        {
          feature,
          prompt: nextPrompt || undefined,
          context,
          context_text: context === 'selection' && hasSelectionContext ? selectionText : undefined,
          tone: feature === 'rewrite' ? tone : undefined,
          summary_length: feature === 'summarize' ? summaryLength : undefined,
          summary_format: feature === 'summarize' ? summaryFormat : undefined,
        },
        {
          onMeta: (meta) => {
            setActiveInteractionId(meta.interaction_id);
            setLastModel(meta.model);
            setSuggestionSourceText(meta.context_preview || fallbackContextPreview);
          },
          onChunk: (text) => {
            latestSuggestion += text;
            setSuggestion(latestSuggestion);
            setInitialSuggestion(latestSuggestion);
          },
          onDone: () => {
            setLastPrompt(nextPrompt || null);
          },
          onError: (message, partial) => {
            streamFailed = true;
            if (partial) {
              latestSuggestion = partial;
              setSuggestion(partial);
              setInitialSuggestion(partial);
            }
            setSuggestError(message);
          },
        },
        { signal: controller.signal },
      );

      if (!streamFailed) {
        setHistoryReloadKey((current) => current + 1);
      }
      return !streamFailed;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setSuggestError(
          latestSuggestion
            ? 'Generation cancelled. The partial suggestion is still available.'
            : 'Generation cancelled.',
        );
      } else if (error instanceof ApiError) {
        setSuggestError(error.error);
      } else {
        setSuggestError('Could not reach the assistant right now.');
      }
      return false;
    } finally {
      setIsSuggesting(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setHistoryReloadKey((current) => current + 1);
    }
  }

  function cancelSuggestion() {
    abortControllerRef.current?.abort();
  }

  function reloadHistory() {
    setHistoryReloadKey((current) => current + 1);
  }

  async function recordDecision(status: AiDecisionStatus) {
    if (!documentId || !activeInteractionId) {
      return false;
    }

    try {
      await api.ai.recordDecision(documentId, activeInteractionId, { status });
      setHistoryReloadKey((current) => current + 1);
      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        setSuggestError(error.error);
      } else {
        setSuggestError('Could not update AI interaction history.');
      }
      return false;
    }
  }

  function clearSuggestion() {
    setSuggestion('');
    setInitialSuggestion('');
    setSuggestionSourceText('');
    setLastPrompt(null);
    setLastModel(null);
    setActiveInteractionId(null);
    setSuggestError(null);
  }

  return {
    feature,
    setFeature,
    prompt,
    setPrompt,
    promptError,
    context,
    setContext,
    tone,
    setTone,
    summaryLength,
    setSummaryLength,
    summaryFormat,
    setSummaryFormat,
    suggestion,
    setSuggestion,
    initialSuggestion,
    suggestionSourceText,
    lastPrompt,
    lastModel,
    activeInteractionId,
    isSuggestionEdited,
    hasSelectionContext,
    isSuggesting,
    suggestError,
    submitSuggestion,
    cancelSuggestion,
    clearSuggestion,
    recordDecision,
    history,
    historyError,
    isLoadingHistory,
    reloadHistory,
  };
}
