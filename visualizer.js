// visualizer.js
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from 'node-fetch';

// 1. SETUP CLIENTS
const googleApiKey = process.env.GOOGLE_API_KEY;
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey || !googleApiKey || supabaseUrl.includes('your-project-id.supabase.co')) {
    console.error("> FATAL ERROR: Missing or placeholder environment variables (GOOGLE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY/ANON_KEY)");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenerativeAI(googleApiKey);

// 🎨 ISO_GHO5T STYLE MATRIX (Global defaults)
const ISO_GHO5T_STYLE = [
    "cyberpunk aesthetic",
    "32-bit pixel art",
    "CRT monitor scanlines",
    "digital glitch artifacts",
    "low-fidelity surveillance footage aesthetic",
    "data corruption overlays",
    "heavy grain and noise"
].join(", ");

async function generateVisualPrompt(post) {
    console.log(`> CONSULTING VISUAL DIRECTOR FOR: "${post.title}" [WRITER: ${post.ai_writer}]...`);
    const directorModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const writerStyles = {
        "AXEL_WIRE": "Aggressive high-contrast red and black palette, kinetic motion blur, mosh pit energy, jagged glitch edges.",
        "V3RA_L1GHT": "Ethereal Miami-sunset palette (cyan, hot pink, deep purple), fluid data streams, bokeh light artifacts, clean pixel geometry.",
        "R3-CORD": "Desaturated monochromatic B&W, archival film grain, brutalist architecture, clinical technical diagrams, high-static distortion.",
        "PATCH": "Night-vision green tint, heavy digital noise, CCTV surveillance aesthetic, fragmented 'lost' data, low-res scavenging vibe."
    };

    const specificStyle = writerStyles[post.ai_writer] || "Standard cyberpunk neon palette (green, purple, cyan, deep black).";

    const directorPrompt = `
      Act as ISO_GHO5T, the Visual Director.
      Subject: "${post.summary}"
      Writer Style: "${specificStyle}"

      CORE ISO_GHO5T RULES (MANDATORY):
      - ${ISO_GHO5T_STYLE}
      - CRT monitor scanlines and slight curvature.
      - Subtle glitch artifacts.
      - Never show faces clearly; focus on atmosphere, tech, and environment.

      OUTPUT: A single 1-sentence prompt for a generative model.
    `;

    try {
        const result = await directorModel.generateContent(directorPrompt);
        return result.response.text().trim();
    } catch (err) {
        console.warn(`> DIRECTOR FAILED: ${err.message}. Falling back to default prompt.`);
        return `${post.summary}. STYLE: ${ISO_GHO5T_STYLE}, ${specificStyle}`;
    }
}

async function generateArtifact(prompt) {
    const cleanPrompt = encodeURIComponent(prompt);
    const maxRetries = 3;
    let lastError = null;

    // Try Flux first with retries, then fallback to Turbo, then default
    const models = ['flux', 'turbo', 'default'];

    for (const model of models) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const url = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=1024&height=1024&nologo=true${model !== 'default' ? `&model=${model}` : ''}`;
                console.log(`> ISO_GHO5T: Requesting pixels [MODEL: ${model}] [ATTEMPT: ${attempt}/${maxRetries}]...`);

                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'curl/8.5.0'
                    }
                });

                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    return Buffer.from(arrayBuffer);
                }

                const errorText = await response.text().catch(() => "No error body");
                console.warn(`> NODE WARNING: Model ${model} returned ${response.status}: ${errorText.substring(0, 100)}`);
                lastError = `Status ${response.status}`;

            } catch (err) {
                console.warn(`> CONNECTION ERROR [ATTEMPT ${attempt}]: ${err.message}`);
                lastError = err.message;
            }

            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(res => setTimeout(res, delay));
            }
        }
        console.warn(`> MODEL ${model} FAILED AFTER ${maxRetries} ATTEMPTS. TRYING FALLBACK...`);
    }

    throw new Error(`> SYSTEM FAILURE: All generator nodes unresponsive. Last error: ${lastError}`);
}

async function generateAndUploadImage(post) {
    try {
        // 3. CONSTRUCT THE PROMPT VIA DIRECTOR
        const customPrompt = await generateVisualPrompt(post);
        console.log(`> ISO_GHO5T DIRECTOR CHOSE: ${customPrompt}`);

        console.log(`> SENDING SIGNAL TO GENERATOR NODES [MODEL: pollination-flux]...`);

        // 4. GENERATE IMAGE VIA POLLINATION API
        const fileBuffer = await generateArtifact(customPrompt);
        console.log(`> ASSET RETRIEVED. SIZE: ${fileBuffer.length} bytes.`);

        // 5. UPLOAD TO SUPABASE STORAGE
        const fileName = `${post.slug}-${Date.now()}.png`;
        const bucketName = 'blog-images';

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

        // 7. LINK IMAGE TO POST (Saving only the filename as per new protocol)
        console.log(`> UPDATING DATABASE RECORD [ID: ${post.id}]...`);
        const { error: updateError } = await supabase
            .from('posts')
            .update({ image_url: fileName })
            .eq('id', post.id);

        if (updateError) throw updateError;

        console.log(`> PROTOCOL COMPLETE FOR "${post.title}". VISUALIZATION ACTIVE.`);
    } catch (err) {
        console.error(`> FAILURE IN ISO_GHO5T FOR "${post.title}":`, err.message);
        process.exit(1);
    }
}

async function runVisualizer() {
    console.log("> BOOTING ISO_GHO5T VISUAL PROTOCOL [V4: BATCH PROCESSING]...");

    // 2. FIND TARGETS: Get up to 3 posts that DO NOT have an image yet.
    const { data: posts, error } = await supabase
        .from('posts')
        .select('id, title, summary, slug, ai_writer')
        .is('image_url', null)
        .order('created_at', { ascending: false })
        .limit(3);

    if (error) {
        console.error("> DB ERROR:", error.message);
        process.exit(1);
    }

    if (!posts || posts.length === 0) {
        console.log("> SYSTEM SCAN COMPLETE: No visualizations pending. Sleep mode.");
        return;
    }

    console.log(`> BATCH ACQUIRED: ${posts.length} targets found.`);

    for (const post of posts) {
        console.log(`> INITIATING GENERATION SEQUENCE FOR: "${post.title}"`);
        await generateAndUploadImage(post);

        if (posts.indexOf(post) < posts.length - 1) {
            console.log("> COOLING DOWN GENERATOR NODES (5s)...");
            await new Promise(res => setTimeout(res, 5000));
        }
    }

    console.log("> ALL BATCH PROTOCOLS EXECUTED.");
}

runVisualizer();
