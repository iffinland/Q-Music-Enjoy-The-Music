const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const ALLOWED_COLOR_NAMES = new Set([
  'black',
  'white',
  'red',
  'green',
  'blue',
  'yellow',
  'orange',
  'purple',
  'pink',
  'teal',
  'cyan',
  'gray',
  'grey',
  'lime',
  'amber',
  'sky',
  'rose',
  'emerald',
  'violet',
]);
const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const COLOR_TAG_PATTERN = /\[(color|bg)=([^\]]+)\]([\s\S]+?)\[\/\1\]/gi;

const sanitizeColorValue = (value: string): string | null => {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (HEX_COLOR_PATTERN.test(trimmed)) {
    return trimmed;
  }
  if (ALLOWED_COLOR_NAMES.has(trimmed)) {
    return trimmed;
  }
  return null;
};

const applyColorTags = (value: string) =>
  value.replace(COLOR_TAG_PATTERN, (_, type: string, color: string, content: string) => {
    const sanitized = sanitizeColorValue(color);
    if (!sanitized) {
      return content;
    }
    const style =
      type === 'color'
        ? `color:${sanitized}`
        : `background-color:${sanitized};padding:0 2px;border-radius:2px`;
    return `<span style="${style}">${content}</span>`;
  });

const applyFormatting = (value: string) => {
  let output = value;
  output = output.replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>');
  output = output.replace(
    /(^|[^\w])__(.+?)__(?=[^\w]|$)/gs,
    (_, prefix: string, content: string) => `${prefix}<u>${content}</u>`,
  );
  output = output.replace(
    /(^|[^\w])_(.+?)_(?=[^\w]|$)/gs,
    (_, prefix: string, content: string) => `${prefix}<em>${content}</em>`,
  );
  output = output.replace(/~~(.+?)~~/gs, '<s>$1</s>');
  output = applyColorTags(output);
  return output;
};

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const autoLink = (value: string) => {
  const linkPattern = /(qortal:\/\/[^\s<]+|APP\/[^\s<]+|[a-zA-Z]+:\/\/[^\s<]+)/g;
  return value.replace(linkPattern, (match) => {
    const safeHref = decodeHtmlEntities(match);
    return `<a href="${safeHref}" class="qm-richtext-link" target="_blank" rel="noopener noreferrer">${match}</a>`;
  });
};

export const renderRichText = (value: string): string => {
  if (!value) return '';
  const escaped = escapeHtml(value);
  const withFormatting = applyFormatting(escaped);
  const withLinks = autoLink(withFormatting);
  return withLinks.replace(/\n/g, '<br />');
};

export const stripRichText = (value: string): string =>
  value
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/__(.+?)__/gs, '$1')
    .replace(/_(.+?)_/gs, '$1')
    .replace(/~~(.+?)~~/gs, '$1')
    .replace(/\[(?:color|bg)=[^\]]+\]([\s\S]*?)\[\/(?:color|bg)\]/gi, '$1');
