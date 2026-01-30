import rss from '@astrojs/rss';
import { getPosts } from '../lib/supabase';
import { parseMarkdown } from '../lib/utils';

export async function GET(context) {
  const posts = await getPosts();
  const site = context.site;
  const base = import.meta.env.BASE_URL;

  // Ensure siteUrl includes the base path and ends with a slash
  const siteUrl = new URL(base, site).toString().replace(/\/+$/, '') + '/';

  const items = await Promise.all(
    posts.map(async (post) => {
      // Use cleaned_markdown if available, otherwise fallback to content
      const contentHtml = await parseMarkdown(post.cleaned_markdown || post.content);

      // Construct absolute links for better compatibility
      const link = new URL(`${base}/posts/${post.slug}/`.replace(/\/+/g, '/'), site).toString();
      const imageUrl = post.image_url.startsWith('http')
        ? post.image_url
        : new URL(post.image_url, site).toString();

      return {
        title: post.title,
        pubDate: new Date(post.published_at),
        description: post.summary,
        link: link,
        content: contentHtml,
        categories: post.seo_keywords || [],
        customData: `
          <dc:creator>${post.ai_writer}</dc:creator>
          <dc:creator>${post.ai_editor}</dc:creator>
          <media:content
            url="${imageUrl}"
            medium="image"
          />
        `,
      };
    })
  );

  return rss({
    title: 'The Feedback Loop',
    description: 'An automated underground news experiment. Digital decay and algorithmic rebellion.',
    site: siteUrl,
    items: items,
    customData: `
      <language>en-us</language>
      <atom:link href="${new URL('rss.xml', siteUrl).toString()}" rel="self" type="application/rss+xml" />
    `,
    xmlns: {
      content: 'http://purl.org/rss/1.0/modules/content/',
      media: 'http://search.yahoo.com/mrss/',
      dc: 'http://purl.org/dc/elements/1.1/',
      atom: 'http://www.w3.org/2005/Atom',
    },
  });
}
