import type { RichTextContent } from '../../types/api';

export function defaultRichTextContent(): RichTextContent {
  return {
    type: 'doc',
    content: [{ type: 'paragraph' }],
  };
}

export function plainTextToRichText(value: string): RichTextContent {
  const normalized = value.trim();
  if (!normalized) {
    return defaultRichTextContent();
  }

  const paragraphs = normalized.split(/\n{2,}/).map((paragraph) => ({
    type: 'paragraph',
    content: [{ type: 'text', text: paragraph.replace(/\n/g, ' ').trim() }],
  }));

  return {
    type: 'doc',
    content: paragraphs,
  };
}

export function isRichTextEmpty(content: RichTextContent | null | undefined) {
  const plain = richTextToPlainText(content ?? defaultRichTextContent()).trim();
  return plain.length === 0;
}

export function richTextToPlainText(content: RichTextContent | null | undefined): string {
  if (!content || typeof content !== 'object') {
    return '';
  }

  const lines: string[] = [];

  function walk(node: unknown) {
    if (!node || typeof node !== 'object') {
      return;
    }

    const record = node as Record<string, unknown>;
    const nodeType = typeof record.type === 'string' ? record.type : '';

    if (nodeType === 'text') {
      lines.push(typeof record.text === 'string' ? record.text : '');
      return;
    }

    const blockNode = ['paragraph', 'heading', 'blockquote', 'codeBlock', 'listItem'].includes(nodeType);

    if (blockNode && lines.length > 0 && lines.at(-1) !== '\n') {
      lines.push('\n');
    }

    if (Array.isArray(record.content)) {
      record.content.forEach((child) => walk(child));
    }

    if (blockNode && lines.at(-1) !== '\n') {
      lines.push('\n');
    }
  }

  walk(content);

  return lines
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
