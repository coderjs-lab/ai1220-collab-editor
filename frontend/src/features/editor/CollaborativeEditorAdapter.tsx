import { EditorContent, type Editor } from '@tiptap/react';

interface CollaborativeEditorAdapterProps {
  editor: Editor | null;
  hint: string;
  readOnly: boolean;
}

export function CollaborativeEditorAdapter({
  editor,
  hint,
  readOnly,
}: CollaborativeEditorAdapterProps) {
  return (
    <label className="flex flex-col gap-2 text-sm text-[color:var(--text)]">
      <span className="font-semibold">Content</span>
      <div className="min-h-[32rem] rounded-[28px] border border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,247,241,0.98))] px-4 py-3 transition focus-within:border-[color:var(--border-strong)] focus-within:ring-4 focus-within:ring-teal-100">
        {editor ? (
          <EditorContent editor={editor} />
        ) : (
          <div className="flex min-h-[28rem] items-center justify-center text-sm text-[color:var(--text-soft)]">
            Preparing the shared editor...
          </div>
        )}
      </div>
      <span className="text-sm text-[color:var(--text-soft)]">
        {readOnly ? 'This document is visible but not editable for your role.' : hint}
      </span>
    </label>
  );
}
