import type { ReactNode } from 'react';
import { EditorContent, type Editor } from '@tiptap/react';

function ToolbarButton({
  disabled,
  isActive,
  label,
  onClick,
  title,
}: {
  disabled: boolean;
  isActive: boolean;
  label: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      className={['doc-toolbar__button', isActive ? 'is-active' : ''].join(' ')}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {label}
    </button>
  );
}

function ToolbarGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="doc-toolbar__group">
      <span className="doc-toolbar__group-label">{label}</span>
      <div className="doc-toolbar__group-controls">{children}</div>
    </div>
  );
}

function currentBlockStyle(editor: Editor) {
  if (editor.isActive('heading', { level: 1 })) {
    return 'heading-1';
  }
  if (editor.isActive('heading', { level: 2 })) {
    return 'heading-2';
  }
  if (editor.isActive('heading', { level: 3 })) {
    return 'heading-3';
  }
  return 'paragraph';
}

function applyBlockStyle(editor: Editor, nextValue: string) {
  const chain = editor.chain().focus();

  if (nextValue === 'heading-1') {
    chain.toggleHeading({ level: 1 }).run();
    return;
  }
  if (nextValue === 'heading-2') {
    chain.toggleHeading({ level: 2 }).run();
    return;
  }
  if (nextValue === 'heading-3') {
    chain.toggleHeading({ level: 3 }).run();
    return;
  }

  chain.setParagraph().run();
}

function normalizeLink(rawValue: string) {
  if (
    rawValue.startsWith('http://') ||
    rawValue.startsWith('https://') ||
    rawValue.startsWith('mailto:')
  ) {
    return rawValue;
  }

  return `https://${rawValue}`;
}

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
  const blockStyle = editor ? currentBlockStyle(editor) : 'paragraph';
  const activeLink = editor ? (editor.getAttributes('link').href as string | undefined) : undefined;

  function handleLink() {
    if (!editor || readOnly) {
      return;
    }

    const current = activeLink ?? 'https://';
    const next = window.prompt('Enter a link URL', current);
    if (next === null) {
      return;
    }

    const trimmed = next.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: normalizeLink(trimmed) })
      .run();
  }

  function handleSurfaceMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (!editor || readOnly) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target?.closest('.ProseMirror')) {
      return;
    }

    event.preventDefault();
    editor.chain().focus().run();
  }

  return (
    <div className="flex flex-col gap-2 text-sm text-[color:var(--text)]">
      <span className="font-semibold">Content</span>
      <div className="doc-editor-shell">
        <div className="doc-toolbar" role="toolbar" aria-label="Rich text formatting controls">
          <div className="doc-toolbar__controls">
            <ToolbarGroup label="Style">
              <select
                aria-label="Text style"
                className="doc-toolbar__select"
                disabled={readOnly || !editor}
                onChange={(event) => {
                  if (!editor) {
                    return;
                  }
                  applyBlockStyle(editor, event.target.value);
                }}
                value={blockStyle}
              >
                <option value="paragraph">Normal text</option>
                <option value="heading-1">Heading 1</option>
                <option value="heading-2">Heading 2</option>
                <option value="heading-3">Heading 3</option>
              </select>
            </ToolbarGroup>

            <ToolbarGroup label="Text">
              <ToolbarButton
                disabled={readOnly || !editor}
                isActive={editor?.isActive('bold') ?? false}
                label="B"
                onClick={() => editor?.chain().focus().toggleBold().run()}
                title="Bold"
              />
              <ToolbarButton
                disabled={readOnly || !editor}
                isActive={editor?.isActive('italic') ?? false}
                label="I"
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                title="Italic"
              />
              <ToolbarButton
                disabled={readOnly || !editor}
                isActive={editor?.isActive('underline') ?? false}
                label="U"
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
                title="Underline"
              />
              <ToolbarButton
                disabled={readOnly || !editor}
                isActive={editor?.isActive('strike') ?? false}
                label="S"
                onClick={() => editor?.chain().focus().toggleStrike().run()}
                title="Strikethrough"
              />
              <ToolbarButton
                disabled={readOnly || !editor}
                isActive={editor?.isActive('highlight') ?? false}
                label="Mark"
                onClick={() => editor?.chain().focus().toggleHighlight().run()}
                title="Highlight"
              />
              <ToolbarButton
                disabled={readOnly || !editor}
                isActive={editor?.isActive('code') ?? false}
                label="Code"
                onClick={() => editor?.chain().focus().toggleCode().run()}
                title="Inline code"
              />
            </ToolbarGroup>

            <ToolbarGroup label="Align">
              <ToolbarButton
                disabled={readOnly || !editor}
                isActive={editor?.isActive({ textAlign: 'left' }) ?? false}
                label="Left"
                onClick={() => editor?.chain().focus().setTextAlign('left').run()}
                title="Align left"
              />
              <ToolbarButton
                disabled={readOnly || !editor}
                isActive={editor?.isActive({ textAlign: 'center' }) ?? false}
                label="Center"
                onClick={() => editor?.chain().focus().setTextAlign('center').run()}
                title="Align center"
              />
              <ToolbarButton
                disabled={readOnly || !editor}
                isActive={editor?.isActive({ textAlign: 'right' }) ?? false}
                label="Right"
                onClick={() => editor?.chain().focus().setTextAlign('right').run()}
                title="Align right"
              />
              <ToolbarButton
                disabled={readOnly || !editor}
                isActive={editor?.isActive({ textAlign: 'justify' }) ?? false}
                label="Justify"
                onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
                title="Justify"
              />
            </ToolbarGroup>

            <ToolbarGroup label="Structure">
              <ToolbarButton
                disabled={readOnly || !editor}
                isActive={editor?.isActive('bulletList') ?? false}
                label="Bullets"
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                title="Bullet list"
              />
              <ToolbarButton
                disabled={readOnly || !editor}
                isActive={editor?.isActive('orderedList') ?? false}
                label="Numbers"
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                title="Ordered list"
              />
              <ToolbarButton
                disabled={readOnly || !editor}
                isActive={editor?.isActive('taskList') ?? false}
                label="Checklist"
                onClick={() => editor?.chain().focus().toggleTaskList().run()}
                title="Checklist"
              />
              <ToolbarButton
                disabled={readOnly || !editor}
                isActive={editor?.isActive('blockquote') ?? false}
                label="Quote"
                onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                title="Block quote"
              />
              <ToolbarButton
                disabled={readOnly || !editor}
                isActive={editor?.isActive('codeBlock') ?? false}
                label="Code block"
                onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                title="Code block"
              />
            </ToolbarGroup>

            <ToolbarGroup label="Insert">
              <ToolbarButton
                disabled={readOnly || !editor}
                isActive={editor?.isActive('link') ?? false}
                label="Link"
                onClick={handleLink}
                title="Insert or edit link"
              />
              <ToolbarButton
                disabled={readOnly || !editor || !(editor?.isActive('link') ?? false)}
                isActive={false}
                label="Unlink"
                onClick={() => editor?.chain().focus().extendMarkRange('link').unsetLink().run()}
                title="Remove link"
              />
              <ToolbarButton
                disabled={readOnly || !editor}
                isActive={false}
                label="Rule"
                onClick={() => editor?.chain().focus().setHorizontalRule().run()}
                title="Insert horizontal rule"
              />
              <ToolbarButton
                disabled={readOnly || !editor}
                isActive={false}
                label="Clear"
                onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
                title="Clear formatting"
              />
            </ToolbarGroup>
          </div>
        </div>

        <div className="doc-editor-surface" onMouseDown={handleSurfaceMouseDown}>
          {editor ? (
            <EditorContent editor={editor} />
          ) : (
            <div className="doc-editor-loading">
              Preparing the shared editor...
            </div>
          )}
        </div>
      </div>
      <span className="text-sm text-[color:var(--text-soft)]">
        {readOnly ? 'This document is visible but not editable for your role.' : hint}
      </span>
    </div>
  );
}
