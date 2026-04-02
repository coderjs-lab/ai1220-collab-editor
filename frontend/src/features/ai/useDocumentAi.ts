import { useEffect, useState } from 'react';
import { api, ApiError } from '../../services/api';
import type { ApiAiHistoryItem } from '../../types/api';

export type AiContextScope = 'selection' | 'section' | 'document';

const DEFAULT_CONTEXT: AiContextScope = 'document';

export function useDocumentAi(documentId: string | null) {
  const [prompt, setPrompt] = useState('');
  const [context, setContext] = useState<AiContextScope>(DEFAULT_CONTEXT);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [history, setHistory] = useState<ApiAiHistoryItem[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyReloadKey, setHistoryReloadKey] = useState(0);

  useEffect(() => {
    setPrompt('');
    setContext(DEFAULT_CONTEXT);
    setPromptError(null);
    setSuggestion(null);
    setLastPrompt(null);
    setIsSuggesting(false);
    setSuggestError(null);
    setHistory([]);
    setHistoryError(null);
    setIsLoadingHistory(false);
  }, [documentId]);

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

    const nextPrompt = prompt.trim();
    if (!nextPrompt) {
      setPromptError('Enter a prompt before asking the assistant.');
      return false;
    }

    setPromptError(null);
    setSuggestError(null);
    setIsSuggesting(true);

    try {
      const response = await api.ai.suggest(documentId, {
        prompt: nextPrompt,
        context,
      });

      setSuggestion(response.suggestion);
      setLastPrompt(nextPrompt);
      setPrompt('');
      setHistoryReloadKey((current) => current + 1);
      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        setSuggestError(error.error);
      } else {
        setSuggestError('Could not reach the assistant right now.');
      }
      return false;
    } finally {
      setIsSuggesting(false);
    }
  }

  function reloadHistory() {
    setHistoryReloadKey((current) => current + 1);
  }

  function clearSuggestion() {
    setSuggestion(null);
    setLastPrompt(null);
    setSuggestError(null);
  }

  return {
    prompt,
    setPrompt,
    promptError,
    context,
    setContext,
    suggestion,
    lastPrompt,
    isSuggesting,
    suggestError,
    submitSuggestion,
    clearSuggestion,
    history,
    historyError,
    isLoadingHistory,
    reloadHistory,
  };
}
