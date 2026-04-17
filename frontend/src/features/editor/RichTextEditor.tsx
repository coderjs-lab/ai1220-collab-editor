import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';

const EMPTY_DOCUMENT_HTML = '<p></p>';

function normalizeContent(value: string) {
  const trimmed = value.trim();
  return trimmed || EMPTY_DOCUMENT_HTML;
}

function ToolbarButton({
  isActive,
  label,
  onClick,
}: {
  isActive: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        'rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition',
        isActive
          ? 'border-[color:var(--border-strong)] bg-[color:var(--teal-soft)] text-teal-950'
          : 'border-[color:var(--border)] bg-white/70 text-[color:var(--text-soft)] hover:bg-white hover:text-[color:var(--text)]',
      ].join(' ')}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

interface RichTextEditorProps {
  value: string;
  editable: boolean;
  onChange: (nextValue: string) => void;
  onBlur?: () => void;
}

export function RichTextEditor({
  value,
  editable,
  onChange,
  onBlur,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit],
    content: normalizeContent(value),
    editable,
    editorProps: {
      attributes: {
        class:
          'rich-editor__content min-h-[22rem] px-5 py-4 text-[16px] leading-8 text-[color:var(--text)] focus:outline-none',
        'data-testid': 'rich-text-editor',
      },
    },
    onUpdate({ editor: currentEditor }) {
      onChange(currentEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(editable);
  }, [editable, editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const nextValue = normalizeContent(value);
    if (normalizeContent(editor.getHTML()) !== nextValue) {
      editor.commands.setContent(nextValue, false);
    }
  }, [editor, value]);

  const actions = editor
    ? [
        {
          label: 'P',
          isActive: editor.isActive('paragraph'),
          onClick: () => editor.chain().focus().setParagraph().run(),
        },
        {
          label: 'H1',
          isActive: editor.isActive('heading', { level: 1 }),
          onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        },
        {
          label: 'H2',
          isActive: editor.isActive('heading', { level: 2 }),
          onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        },
        {
          label: 'Bold',
          isActive: editor.isActive('bold'),
          onClick: () => editor.chain().focus().toggleBold().run(),
        },
        {
          label: 'Italic',
          isActive: editor.isActive('italic'),
          onClick: () => editor.chain().focus().toggleItalic().run(),
        },
        {
          label: 'Bullets',
          isActive: editor.isActive('bulletList'),
          onClick: () => editor.chain().focus().toggleBulletList().run(),
        },
        {
          label: 'Numbers',
          isActive: editor.isActive('orderedList'),
          onClick: () => editor.chain().focus().toggleOrderedList().run(),
        },
        {
          label: 'Code',
          isActive: editor.isActive('codeBlock'),
          onClick: () => editor.chain().focus().toggleCodeBlock().run(),
        },
      ]
    : [];

  return (
    <div className="rounded-[28px] border border-[color:var(--border)] bg-white/90 shadow-[0_18px_42px_rgba(31,37,42,0.05)]">
      <div className="flex flex-wrap gap-2 border-b border-[color:var(--border)] px-4 py-3">
        {actions.map((action) => (
          <ToolbarButton
            key={action.label}
            isActive={action.isActive}
            label={action.label}
            onClick={action.onClick}
          />
        ))}
      </div>

      <div onBlurCapture={onBlur}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
