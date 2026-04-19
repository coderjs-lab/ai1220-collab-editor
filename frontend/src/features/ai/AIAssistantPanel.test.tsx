import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AIAssistantPanel } from './AIAssistantPanel';

function buildProps() {
  return {
    canInvoke: true,
    canApplySuggestion: true,
    canUndoAiApply: false,
    hasSelectionContext: true,
    feature: 'rewrite' as const,
    prompt: '',
    promptError: null,
    context: 'section' as const,
    tone: 'professional' as const,
    summaryLength: 'short' as const,
    summaryFormat: 'paragraph' as const,
    suggestion: 'Improved draft copy for testing.',
    suggestionSourceText: 'Original draft copy for testing.',
    lastPrompt: 'Make this clearer',
    lastModel: 'draftboard-stub-v1',
    isSuggesting: false,
    suggestError: null,
    history: [],
    historyError: null,
    isLoadingHistory: false,
    onFeatureChange: vi.fn(),
    onPromptChange: vi.fn(),
    onContextChange: vi.fn(),
    onToneChange: vi.fn(),
    onSummaryLengthChange: vi.fn(),
    onSummaryFormatChange: vi.fn(),
    onSuggestionChange: vi.fn(),
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    onRetryHistory: vi.fn(),
    onReplaceDraft: vi.fn(),
    onReplaceSelection: vi.fn(),
    onAppendSuggestion: vi.fn(),
    onApplyAcceptedParts: vi.fn(),
    onApplySelectedFragment: vi.fn(),
    onRejectSuggestion: vi.fn(),
    onUndoApply: vi.fn(),
    onDismissSuggestion: vi.fn(),
  };
}

describe('AIAssistantPanel', () => {
  it('disables selection context when the editor has no active selection', () => {
    render(<AIAssistantPanel {...buildProps()} hasSelectionContext={false} />);

    expect(screen.getByRole('option', { name: 'Selection' })).toBeDisabled();
  });

  it('applies the selected fragment from the editable suggestion textarea', () => {
    const props = buildProps();
    render(<AIAssistantPanel {...props} />);

    const textarea = screen.getByLabelText('Suggestion') as HTMLTextAreaElement;
    textarea.setSelectionRange(0, 8);
    fireEvent.mouseUp(textarea);
    fireEvent.click(screen.getByRole('button', { name: 'Apply selected fragment' }));

    expect(props.onApplySelectedFragment).toHaveBeenCalledWith('Improved');
  });

  it('accepts only the highlighted substring inside a suggestion', () => {
    const props = buildProps();
    props.suggestion = 'Alpha beta gamma.';

    render(<AIAssistantPanel {...props} />);

    const textarea = screen.getByLabelText('Suggestion') as HTMLTextAreaElement;
    textarea.setSelectionRange(6, 10);
    fireEvent.mouseUp(textarea);

    fireEvent.click(screen.getByRole('button', { name: 'Accept selected text' }));
    fireEvent.click(screen.getByRole('button', { name: 'Append accepted below' }));

    expect(props.onApplyAcceptedParts).toHaveBeenCalledWith('beta', 'append');
  });

  it('applies only the accepted suggestion parts', () => {
    const props = buildProps();
    props.suggestion = 'First approved sentence. Second rejected sentence.';

    render(<AIAssistantPanel {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Accept part 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reject part 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Append accepted below' }));

    expect(props.onApplyAcceptedParts).toHaveBeenCalledWith(
      'First approved sentence.',
      'append',
    );
  });
});
