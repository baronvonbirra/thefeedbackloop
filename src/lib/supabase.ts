import { createClient } from '@supabase/supabase-js';

// Access environment variables from Astro's import.meta.env.
// These are populated from .env files locally and GitHub Secrets in CI/CD (via deploy.yml).
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Provide placeholders during build if variables are missing to prevent hard crash
const finalUrl = supabaseUrl || 'https://placeholder.supabase.co';
const finalKey = supabaseKey || 'placeholder';

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ SUPABASE WARNING: Environment variables are missing!');
} else {
  console.log(`📡 Supabase initializing with URL: ${supabaseUrl}`);
}

export const supabase = createClient(finalUrl, finalKey);

export interface Post {
  id: number;
  created_at: string;
  updated_at?: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: string;
  image_url: string;
  source_url?: string;
  status: 'draft' | 'published';
  ai_writer: string;
  ai_editor: string;
}

export async function getPosts() {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching posts:', error.message, error);
    return [];
  }

  return data as Post[];
}

export async function getPostBySlug(slug: string) {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (error) {
    console.error(`Error fetching post with slug ${slug}:`, error.message, error);
    return null;
  }

  return data as Post;
}
