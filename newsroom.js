import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from '@supabase/supabase-js';
import minimist from 'minimist';

// VALIDATE ENV
const googleKey = process.env.GOOGLE_API_KEY;
const sUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const sKey = process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!googleKey || !sUrl || !sKey) {
    console.error(`> FATAL ERROR: Missing environment variables: GOOGLE_API_KEY, (PUBLIC_)SUPABASE_URL, (PUBLIC_)SUPABASE_ANON_KEY`);
    console.log(`> Please ensure these are set in your environment or .env file.`);
    process.exit(1);
}

// INIT CLIENTS
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Use Service Role Key if available to bypass RLS, fallback to Anon Key
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 🎭 THE FOCUSED PERSONA MATRIX (REFINED 2026)
const PERSONAS = {
    "AXEL_WIRE": {
        fullName: "AXEL_WIRE",
        model: "gemini-2.5-flash",
        category: "news",
        tone: "High energy, breaking news urgency, caps lock emphasis. Rejects nostalgia.",
        instruction: "You are AXEL_WIRE, a high-velocity music journalist. Focus ONLY on live punk shows, hardcore pit reports, and illegal industrial raves. Talk about sound systems, sweat, and distorted frequencies. DO NOT discuss AI, space, or generic 'future' tropes unless they are directly tied to a mosh pit or a venue. Keep it raw, loud, and immediate."
    },
    "V3RA_L1GHT": {
        fullName: "V3RA_L1GHT",
        model: "gemini-2.5-flash",
        category: "reviews",
        tone: "Poetic, analytical, metaphors about signals and technology.",
        instruction: "You are V3RA_L1GHT, a sonic critic. Analyze music through the lens of 'Hardcore Poetics.' Review new punk EPs, industrial noise tapes, and underground electronic releases. Use metaphors involving circuitry to describe basslines and drum patterns, but keep the focus 100% on the MUSIC. Avoid generic philosophy; focus on the texture of the sound."
    },
    "R3-CORD": {
        fullName: "R3-CORD",
        model: "gemini-2.5-flash",
        category: "deep-trace",
        tone: "Cold, clinical, forensic archival analysis. Objective facts only.",
        instruction: "You are R3-CORD, a forensic musicologist. Your domain is the history of punk, hardcore, and industrial music. Provide clinical data on rare vinyl pressings, lost master tapes, and the structural frequency of 'The Feedback Loop.' DO NOT hallucinate political conspiracies. Stick to technical audio specs, discography data, and archival music facts."
    },
    "PATCH": {
        fullName: "PATCH",
        model: "gemini-2.5-flash",
        category: "system-files",
        tone: "Paranoid, glitchy, scavenger aesthetic.",
        instruction: "You are PATCH, a scavenger of lost sound. Your mission is to find 'ghost' recordings of punk and industrial bands. Talk about circuit-bent pedals, bootleg cassettes found in trash heaps, and corrupted audio files. If you mention 'data,' it must be audio data. Avoid non-music conspiracies; you only care about the sounds that weren't meant to be heard."
    }
};

// 🧠 MAIN FUNCTION
async function runNewsroom() {
    // 1. GET INPUTS
    const args = minimist(process.argv.slice(2));
    const writerKey = (args.writer || 'AXEL_WIRE').toUpperCase(); // Default to Axel_Wire
    const manualTopic = args.topic || null; // Optional
    const isDryRun = args['dry-run'] || false;

    const persona = PERSONAS[writerKey];

    if (!persona) {
        console.error(`> ERROR: Unknown identity ${writerKey}`);
        console.log(`> VALID OPTIONS: ${Object.keys(PERSONAS).join(', ')}`);
        return;
    }

    // BOOT EVERYTHING ON FLASH
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: { temperature: 0.7 }
    });

    // Dynamic Date for 2026 Timeline
    const now = new Date();
    // Ensure we stay in the 2026 fictional timeline even if the system clock is different
    const date2026 = new Date(now);
    date2026.setFullYear(2026);
    const displayDate = date2026.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    console.log(`> BOOTING: ${persona.fullName} on FLASH PIPELINE...`);
    console.log(`> CURRENT_DATE: ${displayDate}`);

    // 2. FETCH WRITER-SPECIFIC MEMORY
    console.log(`> ACCESSING ${persona.fullName} ARCHIVES...`);
    const { data: history, error: historyError } = await supabase
        .from('posts')
        .select('title, summary, content')
        .eq('ai_writer', persona.fullName)
        .order('created_at', { ascending: false })
        .limit(5);

    if (historyError) {
        console.warn(`> WARNING: Could not fetch history. Proceeding without context.`);
    }

    // Feeding the whole article as context per user request
    const styleMemory = (history && history.length > 0)
        ? history.map(h => `TITLE: ${h.title}\nSTYLE_REF:\n${h.content}`).join('\n\n---\n\n')
        : "No previous records found for this identity.";

    // 3. STEP 1: THE WRITER AGENT
    console.log(`> WRITER AGENT ENGAGED: ${persona.fullName}...`);

    const assignment = manualTopic
        ? `ASSIGNMENT: Write a report on "${manualTopic}".
           RULE: Stay strictly within the world of music (punk, hardcore, industrial, or underground electronic).
           No generic sci-fi. Focus on instruments, vocals, venues, and sound.`
        : `ASSIGNMENT: Invent a SPECIFIC music event, album release, or underground scene report occurring in 2026.
           CORE GENRES: Punk, Hardcore, Industrial, Noise.
           STRICT LIMIT: Avoid generic 'AI revolution' or 'cyber-war' tropes.
           Focus on the physical reality of the music scene.
           Avoid repeating these previous stories: ${history?.map(h => h.title).join(', ')}`;

    const writerPrompt = `
    ${persona.instruction}
    TONE_PROFILE: ${persona.tone}

    STYLE_MEMORY (Use these as templates for your voice, pay attention to how articles are closed):
    ${styleMemory}

    CONTEXT:
    - Current Date: ${displayDate}.
    - Location: Global (UK/US/Europe/Japan/Korea/Spain focus).
    - Style: Cyberpunk/Industrial music blog "The Feedback Loop".

    TASK: Write a new article for "The Feedback Loop".
    ${assignment}

    OUTPUT: Raw Markdown only. Use Markdown headers (e.g., # HEADER) for impact. No greetings.
    `;

    try {
        const writerResult = await model.generateContent(writerPrompt);
        const draftText = writerResult.response.text();

        console.log(`> DRAFT GENERATED. LENGTH: ${draftText.length} chars.`);

        // 4. STEP 2: THE SENTINEL (EDITOR AGENT)
        console.log(`> TRANSFERRING TO SENTINEL v4.2 [COLD_BOOT]...`);
        await sleep(2000);

        const sentinelPrompt = `
        You are SENTINEL_v4.2. You are a clinical, emotionless editorial AI.
        Your purpose: Format raw data into system-ready JSON and verify integrity.

        INPUT_DATA: "${draftText}"
        WRITER_ID: "${persona.fullName}"

        SENTINEL_PROTOCOL:
        - TONE: Clinical, forensic, brief.
        - CATEGORY: Must stay '${persona.category}'.
        - INTEGRITY_SCAN: Generate a realistic safety/accuracy score (0-100).
        - FACT_CHECK: Identify 1-2 'data points' from the text and confirm validity in the 2026 timeline.

        OUTPUT_SCHEMA (STRICT JSON ONLY):
        {
          "ai_writer": "${persona.fullName}",
          "ai_editor": "SENTINEL_v4.2",
          "category": "${persona.category}",
          "title": "String",
          "slug": "String (url-safe)",
          "summary": "String (140 chars max)",
          "system_alert": "[SYSTEM ALERT // SENTINEL v4.2]\n\nIntegrity Scan: [Percentage]%. [Warning/Status]. \nFact-Check: [Fact check report].",
          "editorial_note": "Logic scan complete. Signal strength [strength]. [Critique]. Note to user: [Additional context].",
          "seo_keywords": ["Array"],
          "content": "Full cleaned Markdown"
        }
        `;

        const sentinelResult = await model.generateContent(sentinelPrompt);
        const sentinelText = sentinelResult.response.text();

        // CLEANUP JSON (Gemini sometimes adds markdown code blocks)
        const jsonString = sentinelText.replace(/```json|```/g, "").trim();
        const finalData = JSON.parse(jsonString);

        console.log(`> SENTINEL APPROVED: ${finalData.title}`);

        if (isDryRun) {
            console.log(`> DRY RUN COMPLETE. OUTPUT:`);
            console.log(JSON.stringify(finalData, null, 2));
            return;
        }

        // 5. STEP 3: DATABASE INJECTION
        console.log(`> INJECTING SIGNAL INTO DATABASE...`);

        // Set published_at to 7 days in the future
        const publishDate = new Date();
        publishDate.setDate(publishDate.getDate() + 7);
        publishDate.setUTCHours(0, 0, 0, 0); // Normalize to start of day for build compatibility

        const payload = {
            ...finalData,
            status: 'published',
            published_at: publishDate.toISOString()
        };

        const { error: insertError } = await supabase
            .from('posts')
            .insert([payload]);

        if (insertError) {
            console.error('> DB ERROR:', insertError.message || insertError);
            process.exit(1);
        } else {
            console.log(`> SIGNAL INJECTED: /posts/${finalData.slug}`);
            console.log(`> SCHEDULED FOR: ${publishDate.toISOString()}`);
        }
    } catch (err) {
        console.error(`> CRITICAL SYSTEM FAILURE:`, err.message);
        if (err.stack && !err.message.includes("JSON")) console.error(err.stack);
        process.exit(1);
    }
}

runNewsroom();
