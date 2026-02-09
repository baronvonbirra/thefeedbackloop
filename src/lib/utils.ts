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

  // 1. Remove the header prefix if present: [SYSTEM ALERT // SENTINEL v4.2] or [SYSTEM ALERT]
  // Robust enough to handle space or underscore before version
  let content = alert.replace(/^\[SYSTEM ALERT(?:\s*\/\/\s*SENTINEL[\s_]v[\d.]+)?\]\s*/i, '').trim();

  // 2. Extract Integrity Scan (handle space or underscore, and decimals)
  const integrityMatch = content.match(/INTEGRITY[\s_]SCAN:\s*(\d+(?:\.\d+)?%?)/i);
  let integrity: number | undefined = undefined;
  if (integrityMatch) {
    integrity = parseFloat(integrityMatch[1]);
    // Remove the integrity scan part from content
    content = content.replace(integrityMatch[0], '').trim();
    // Clean up potential leading punctuation/space
    content = content.replace(/^[.\s,]+/, '').trim();
  }

  // 3. Extract Fact-Check
  // Look for FACT-CHECK: and capture everything until the next marker or end of string
  const nextMarkerLookahead = /(?=(?:ACTION:|NOTE:|INTEGRITY[\s_]SCAN:|\]\s*\[|$))/i;

  const factCheckMatch = content.match(new RegExp(`FACT-CHECK:\\s*(.*?)${nextMarkerLookahead.source}`, 'si'));
  let factCheck: string | undefined = undefined;
  if (factCheckMatch) {
    factCheck = factCheckMatch[1].trim();
    content = content.replace(factCheckMatch[0], '').trim();
  }

  // 4. Extract Action or Note
  const actionMatch = content.match(/(?:ACTION|NOTE):\s*(.*)/si);
  let action: string | undefined = undefined;
  if (actionMatch) {
    action = actionMatch[1].trim();
    content = content.replace(actionMatch[0], '').trim();
  }

  // 5. Fallback: Any remaining content becomes Action
  if (content.length > 0) {
    const remaining = content.trim().replace(/^[.\s,]+|[.\s,]+$/g, '');
    if (remaining.length > 0) {
      if (!action) {
        action = content.trim();
      } else {
        action = action + " " + content.trim();
      }
    }
  }

  return { integrity, factCheck, action };
}

/**
 * Generates the best available image URL for a post with a multi-tier fallback system.
 * 1. Supabase Storage (with placeholder repair and filename-to-URL conversion)
 * 2. Pollinations AI (as a final generative fallback, replacing local filesystem)
 */
export function getPostImageUrl(post: any) {
  const defaultFallback = 'https://image.pollinations.ai/prompt/static%20noise%20CRT%20screen%20glitch%20cyberpunk%20aesthetic?width=800&height=600&nologo=true';
  if (!post) return defaultFallback;

  const placeholderHost = 'your-project-id.supabase.co';
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const actualHost = supabaseUrl && !supabaseUrl.includes(placeholderHost) ? new URL(supabaseUrl).host : null;

  let url = post.image_url;

  // 1. If we have a URL or filename, process it
  if (url && typeof url === 'string') {
    // Repair placeholder URLs if they are full URLs
    if (url.includes(placeholderHost) && actualHost) {
      url = url.replace(placeholderHost, actualHost);
    }

    // If it's a full URL, return it
    if (url.startsWith('http')) {
      return url;
    }

    // If it's just a filename (e.g. "my-post-123.png"), construct the Supabase Storage URL
    // We specifically match the pollination pattern {slug}-{timestamp}.png or any alphanumeric filename
    const isFilename = /^[a-zA-Z0-9._-]+\.(png|jpg|jpeg|webp)$/i.test(url);

    if (isFilename && supabaseUrl && !supabaseUrl.includes(placeholderHost)) {
      const cleanBaseUrl = supabaseUrl.replace(/\/$/, '');
      return `${cleanBaseUrl}/storage/v1/object/public/blog-images/${url}`;
    }
  }

  // 2. Final Fallback: Pollinations AI generative URL
  // (Replacing the deprecated /images/posts/ local folder)
  const prompt = encodeURIComponent(`ISO_GHO5T cyberpunk aesthetic, 32-bit pixel art, CRT scanlines, ${post.title}`);
  return `https://image.pollinations.ai/prompt/${prompt}?width=1024&height=1024&nologo=true&model=flux`;
}
