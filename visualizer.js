// visualizer.js
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. SETUP CLIENTS
// Use names consistent with the project's environment variables.
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
// Preferred: Service Role Key for uploads. Fallback: Anon Key.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;
const googleApiKey = process.env.GOOGLE_API_KEY;

if (!supabaseUrl || !supabaseKey || !googleApiKey) {
    console.error("> FATAL ERROR: Missing environment variables (PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, or GOOGLE_API_KEY)");
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
    // We use the text model to 'direct' the image model
    const directorModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 🎨 WRITER-SPECIFIC AESTHETIC OVERRIDES
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

async function runVisualizer() {
    console.log("> BOOTING ISO_GHO5T VISUAL PROTOCOL [V3: WRITER MAPPING]...");

    // 2. FIND TARGET: Get the newest post that DOES NOT have an image yet.
    const { data: posts, error } = await supabase
        .from('posts')
        .select('id, title, summary, slug, ai_writer')
        .is('image_url', null)
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

    try {
        // 3. CONSTRUCT THE PROMPT VIA DIRECTOR
        const customPrompt = await generateVisualPrompt(post);
        console.log(`> ISO_GHO5T DIRECTOR CHOSE: ${customPrompt}`);

        const encodedPrompt = encodeURIComponent(customPrompt);

        // Use Pollinations.ai (Fast, free, good for this aesthetic)
        const generationUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}`;

        console.log(`> SENDING SIGNAL TO GENERATOR NODES...`);

        // 4. FETCH RAW IMAGE DATA
        const response = await fetch(generationUrl);
        if (!response.ok) throw new Error(`Generation failed: ${response.statusText}`);

        const arrayBuffer = await response.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);
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

        // 7. LINK IMAGE TO POST
        console.log(`> UPDATING DATABASE RECORD [ID: ${post.id}]...`);
        const { error: updateError } = await supabase
            .from('posts')
            .update({ image_url: finalUrl })
            .eq('id', post.id);

        if (updateError) throw updateError;

        console.log("> PROTOCOL COMPLETE. VISUALIZATION ACTIVE.");

    } catch (err) {
        // SAFETY MATCH: Log error but don't crash.
        // We don't update image_url so it will be retried.
        console.error(`> CRITICAL FAILURE IN ISO_GHO5T:`, err.message);
    }
}

runVisualizer();
