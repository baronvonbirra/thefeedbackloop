import { marked } from 'marked';

export const stripMarkdown = (md: string) => {
  if (!md) return '';
  return md
    .replace(/^#+\s+/gm, '')
    .replace(/[*_~`]{1,3}/g, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '')
    .replace(/^\s*>\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim();
};

/**
 * Parses markdown while handling literal \n characters and optional inline rendering.
 */
export const parseMarkdown = async (content: string | undefined, inline = false) => {
  if (!content) return '';
  const processed = content.replace(/\\n/g, '\n');
  return inline ? marked.parseInline(processed) : await marked.parse(processed);
};
