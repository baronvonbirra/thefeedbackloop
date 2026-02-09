// visualizer.js
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// 1. SETUP CLIENTS
// CRITICAL: Use the SERVICE_ROLE_KEY for storage uploads to bypass RLS policies if needed.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY; // Fallback if specific key isn't set
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 🎨 ISO_GHO5T STYLE MATRIX
// These keywords are appended to every prompt to enforce stylistic consistency.
const ISO_GHO5T_STYLE = [
    "cyberpunk aesthetic",
    "32-bit pixel art",
    "CRT monitor scanlines",
    "digital glitch artifacts",
    "low-fidelity surveillance footage aesthetic",
    "data corruption overlays",
    "heavy grain and noise",
    "restricted neon palette (green, purple, cyan, deep black)"
].join(", ");


async function runVisualizer() {
    console.log("> BOOTING ISO_GHO5T VISUAL PROTOCOL...");

    // 2. FIND TARGET: Get the newest post that DOES NOT have an image yet.
    // We select 'id' for updating, and 'summary'/'slug' for prompt generation.
    const { data: posts, error } = await supabase
        .from('posts')
        .select('id, title, summary, slug')
        .is('image_url', null) // The crucial filter
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error("> DB ERROR:", error.message);
        return;
    }

    if (!posts || posts.length === 0) {
        console.log("> SYSTEM SCAN COMPLETE: No visualizations pending. Sleep mode.");
        return;
    }

    const post = posts[0];
    console.log(`> TARGET ACQUIRED: "${post.title}"`);
    console.log(`> INITIATING GENERATION SEQUENCE...`);

    try {
        // 3. CONSTRUCT THE PROMPT
        // Combine the article summary with the enforced style matrix.
        // We encode it to ensure it passes safely in a URL.
        const rawPrompt = `${post.summary}. STYLE: ${ISO_GHO5T_STYLE}`;
        const encodedPrompt = encodeURIComponent(rawPrompt);

        // Use Pollinations.ai (Fast, free, good for this aesthetic)
        // Adding '/image' ensures it returns binary data, not a redirect site.
        const generationUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}`;

        console.log(`> SENDING SIGNAL TO GENERATOR NODES...`);

        // 4. FETCH RAW IMAGE DATA
        const response = await fetch(generationUrl);
        if (!response.ok) throw new Error(`Generation failed: ${response.statusText}`);

        const arrayBuffer = await response.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);
        console.log(`> ASSET RETRIEVED. SIZE: ${fileBuffer.length} bytes.`);

        // 5. UPLOAD TO SUPABASE STORAGE
        // Create a unique filename using the slug and timestamp
        const fileName = `${post.slug}-${Date.now()}.png`;
        const bucketName = 'blog-images'; // Must match Step 1

        console.log(`> UPLOADING TO STORAGE BUCKET: ${bucketName}/${fileName}...`);

        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from(bucketName)
            .upload(fileName, fileBuffer, {
                contentType: 'image/png',
                upsert: false
            });

        if (uploadError) throw uploadError;

        // 6. GET PUBLIC URL
        const { data: publicUrlData } = supabase
            .storage
            .from(bucketName)
            .getPublicUrl(fileName);

        const finalUrl = publicUrlData.publicUrl;
        console.log(`> ASSET SECURED AT: ${finalUrl}`);

        // 7. LINK IMAGE TO POST
        console.log(`> UPDATING DATABASE RECORD [ID: ${post.id}]...`);
        const { error: updateError } = await supabase
            .from('posts')
            .update({ image_url: finalUrl })
            .eq('id', post.id);

        if (updateError) throw updateError;

        console.log("> PROTOCOL COMPLETE. VISUALIZATION ACTIVE.");

    } catch (err) {
        console.error(`> CRITICAL FAILURE IN ISO_GHO5T:`, err.message);
    }
}

runVisualizer();
