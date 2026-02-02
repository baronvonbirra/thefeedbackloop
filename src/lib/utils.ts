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
  let processed = content.replace(/\\n/g, '\n');

  // Handle Sentinel Interrupts: [[SENTINEL: "message"]]
  processed = processed.replace(/\[\[SENTINEL:\s*"(.*?)"\]\]/g, '<span class="sentinel-interrupt" data-message="$1"></span>');

  return inline ? marked.parseInline(processed) : await marked.parse(processed);
};

/**
 * Parses a system alert string to extract integrity scan %, fact-check, and action.
 */
export function parseSystemAlert(alert: string | undefined) {
  if (!alert) return { integrity: undefined, factCheck: undefined, action: undefined };

  // Improved regex to handle both multiline and bracketed formats
  const integrityMatch = alert.match(/INTEGRITY_SCAN:\s*(\d+)/i);

  // Lookahead to stop at next field marker or closing brackets/end of string
  const lookahead = /(?=\s*(?:ACTION:|FACT-CHECK:|INTEGRITY_SCAN:|\]\s*\[|\]\s*$|$))/si;

  const factCheckMatch = alert.match(new RegExp(`FACT-CHECK:\\s*(.*?)${lookahead.source}`, 'si'));
  const actionMatch = alert.match(new RegExp(`ACTION:\\s*(.*?)${lookahead.source}`, 'si'));

  return {
    integrity: integrityMatch ? parseInt(integrityMatch[1], 10) : undefined,
    factCheck: factCheckMatch ? factCheckMatch[1].trim() : undefined,
    action: actionMatch ? actionMatch[1].trim() : undefined
  };
}
