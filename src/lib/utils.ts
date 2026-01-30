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

/**
 * Parses a system alert string to extract integrity scan %, fact-check, and action.
 */
export function parseSystemAlert(alert: string | undefined) {
  if (!alert) return { integrity: undefined, factCheck: undefined, action: undefined };

  const integrityMatch = alert.match(/Integrity Scan:\s*(\d+)%/i);
  const factCheckMatch = alert.match(/Fact-Check:\s*(.*?)(?=Action:|$)/is);
  const actionMatch = alert.match(/Action:\s*(.*)/is);

  return {
    integrity: integrityMatch ? parseInt(integrityMatch[1], 10) : undefined,
    factCheck: factCheckMatch ? factCheckMatch[1].trim() : undefined,
    action: actionMatch ? actionMatch[1].trim() : undefined
  };
}
