const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const applyFormatting = (value: string) => {
  let output = value;
  output = output.replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>');
  output = output.replace(/__(.+?)__/gs, '<u>$1</u>');
  output = output.replace(/_(.+?)_/gs, '<em>$1</em>');
  output = output.replace(/~~(.+?)~~/gs, '<s>$1</s>');
  return output;
};

const autoLink = (value: string) => {
  const linkPattern = /(qortal:\/\/[^\s<]+|APP\/[^\s<]+|[a-zA-Z]+:\/\/[^\s<]+)/g;
  return value.replace(linkPattern, (match) => {
    const safeHref = match;
    return `<a href="${safeHref}" class="text-sky-300 underline" target="_blank" rel="noopener noreferrer">${match}</a>`;
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
    .replace(/~~(.+?)~~/gs, '$1');
