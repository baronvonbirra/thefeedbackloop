import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_KEY || import.meta.env.SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface Post {
  id: number;
  created_at: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: string;
  image_url: string;
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
    console.error('Error fetching posts:', error);
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
    console.error(`Error fetching post with slug ${slug}:`, error);
    return null;
  }

  return data as Post;
}
