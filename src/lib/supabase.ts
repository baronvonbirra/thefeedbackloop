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

export interface UplinkMessage {
  id?: number;
  created_at?: string;
  agent_id: string;
  data_packet: string;
  status?: string;
}

export interface Suggestion {
  id?: number;
  created_at?: string;
  suggestion: string;
}

export interface Post {
  id: number;
  created_at: string;
  published_at: string;
  updated_at?: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: string;
  image_url: string;
  source_url?: string;
  status: 'draft' | 'published';
  ai_writer: 'AXEL_WIRE' | 'V3RA_L1GHT' | 'R3-CORD' | 'PATCH' | string;
  ai_editor: string;
  system_alert?: string;
  editorial_note?: string;
  seo_keywords?: string[];
  image_metadata?: string;
}

export async function getPosts(category?: string | string[]) {
  let query = supabase
    .from('posts')
    .select('*')
    .filter('published_at', 'lte', new Date().toISOString())
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (category) {
    if (Array.isArray(category)) {
      query = query.in('category', category);
    } else {
      query = query.eq('category', category);
    }
  }

  const { data, error } = await query;

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
    .filter('published_at', 'lte', new Date().toISOString())
    .eq('status', 'published')
    .single();

  if (error) {
    console.error(`Error fetching post with slug ${slug}:`, error.message, error);
    return null;
  }

  return data as Post;
}

export async function getInterceptedSignals() {
  const { data, error } = await supabase
    .from('uplink_messages')
    .select('*')
    .eq('status', 'intercepted')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching intercepted signals:', error.message, error);
    return [];
  }

  return data as UplinkMessage[];
}

export async function submitUplinkMessage(message: Omit<UplinkMessage, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('uplink_messages')
    .insert([{ ...message, status: 'pending' }]);

  if (error) {
    console.error('Error submitting uplink message:', error.message, error);
    throw error;
  }

  return data;
}

export async function submitSuggestion(suggestion: string) {
  const { data, error } = await supabase
    .from('suggestions')
    .insert([{ suggestion }]);

  if (error) {
    console.error('Error submitting suggestion:', error.message, error);
    throw error;
  }

  return data;
}
