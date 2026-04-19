export function htmlToText(value: string) {
  if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
    const parser = new window.DOMParser();
    const document = parser.parseFromString(value, 'text/html');
    return document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatRelativeTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatCalendarTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(date);
}

export function excerptText(value: string, maxLength = 120) {
  const compact = htmlToText(value);
  if (!compact) {
    return 'Empty document';
  }

  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength).trimEnd()}...`;
}

export function countWords(value: string) {
  const compact = htmlToText(value);
  if (!compact) {
    return 0;
  }

  return compact.split(/\s+/).length;
}

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function plainTextToHtml(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '<p></p>';
  }

  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

export function formatCount(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}
