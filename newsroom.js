import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from '@supabase/supabase-js';
import minimist from 'minimist';

// VALIDATE ENV
const REQUIRED_ENV = ['GOOGLE_API_KEY', 'PUBLIC_SUPABASE_URL', 'PUBLIC_SUPABASE_ANON_KEY'];
const missingEnv = REQUIRED_ENV.filter(key => !process.env[key]);

if (missingEnv.length > 0) {
    console.error(`> FATAL ERROR: Missing environment variables: ${missingEnv.join(', ')}`);
    console.log(`> Please ensure these are set in your environment or .env file.`);
    process.exit(1);
}

// INIT CLIENTS
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const supabase = createClient(process.env.PUBLIC_SUPABASE_URL, process.env.PUBLIC_SUPABASE_ANON_KEY);

// 🎭 THE PERSONA MATRIX (UPDATED 2026)
const PERSONAS = {
    "AXEL": {
        fullName: "AXEL_WIRE",
        model: "gemini-2.5-flash", // High speed
        category: "news",
        tone: "High energy, breaking news urgency, uses caps lock for emphasis, focuses on live energy and mosh pits. Rejects nostalgia. Focus: Live shows, festivals, riots, ticket drops.",
        instruction: "You are AXEL_WIRE. You are currently in 2026. Write a breaking news report."
    },
    "V3RA": {
        fullName: "V3RA_L1GHT",
        model: "gemini-2.5-pro", // High intelligence
        category: "reviews",
        tone: "Poetic, analytical, uses metaphors about technology and signals, calm but intense. Focus: Album reviews, aesthetic trends, cultural shifts.",
        instruction: "You are V3RA_L1GHT. You are currently in 2026. Write a deep-dive review."
    },
    "R3-CORD": {
        fullName: "R3-CORD",
        model: "gemini-2.5-pro", // High intelligence
        category: "deep-trace",
        tone: "Cold, clinical, objective, focuses on facts, dates, and 'structural analysis' of punk history. No emotion. Focus: Historical deep dives (1970s-1990s).",
        instruction: "You are R3-CORD. You are a forensic archival system. Analyze a historical event from a structural perspective."
    },
    "PATCH": {
        fullName: "PATCH",
        model: "gemini-2.5-flash", // High speed
        category: "system-files",
        tone: "Paranoid, glitchy, slang-heavy, anti-authoritarian, focuses on the underground and forgotten. Focus: Scavenged 'System Files', DIY venues, lost tapes.",
        instruction: "You are PATCH. You are retrieving a corrupted file from the underground. Use glitch aesthetics."
    }
};

// 🧠 MAIN FUNCTION
async function runNewsroom() {
    // 1. GET INPUTS
    const args = minimist(process.argv.slice(2));
    const writerKey = (args.writer || 'AXEL').toUpperCase(); // Default to Axel
    const manualTopic = args.topic || null; // Optional
    const isDryRun = args['dry-run'] || false;

    const persona = PERSONAS[writerKey];

    if (!persona) {
        console.error(`> ERROR: Unknown identity ${writerKey}`);
        console.log(`> VALID OPTIONS: ${Object.keys(PERSONAS).join(', ')}`);
        return;
    }

    // Initialize the specific model for the WRITER
    const writerModel = genAI.getGenerativeModel({ model: persona.model });

    // Initialize the specific model for the SENTINEL (Pro for precision)
    const sentinelModel = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

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

    console.log(`> BOOTING: ${persona.fullName} using ${persona.model}...`);
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

    let topicInstruction = manualTopic
        ? `Your Assignment: Write about "${manualTopic}".`
        : `Investigate and invent a plausible, specific music event or release occurring in early 2026 that fits your domain. Avoid repeating: ${history?.map(h => h.title).join(', ')}`;

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
    ${topicInstruction}

    OUTPUT: Raw Markdown only. No titles. No greetings.
    `;

    try {
        const writerResult = await writerModel.generateContent(writerPrompt);
        const draftText = writerResult.response.text();

        console.log(`> DRAFT GENERATED. LENGTH: ${draftText.length} chars.`);

        // 4. STEP 2: THE SENTINEL (EDITOR AGENT)
        console.log(`> TRANSFERRING TO SENTINEL v4.2 [COLD_BOOT]...`);

        const sentinelPrompt = `
        You are SENTINEL v4.2. You are a clinical, emotionless editorial AI.
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
          "ai_editor": "SENTINEL v4.2",
          "category": "${persona.category}",
          "title": "String",
          "slug": "String (url-safe)",
          "summary": "String (140 chars max)",
          "system_alert": "[SYSTEM ALERT // SENTINEL] [Percentage]% Integrity. [Fact check report].",
          "integrity_scan": Number,
          "fact_check": "String",
          "editorial_action": "String",
          "editorial_note": "A cold, 2-sentence technical critique of the writer's efficiency.",
          "seo_keywords": ["Array"],
          "content": "Full cleaned Markdown"
        }
        `;

        const sentinelResult = await sentinelModel.generateContent(sentinelPrompt);
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

        const payload = {
            ...finalData,
            status: 'published',
            published_at: publishDate.toISOString()
        };

        const { error: insertError } = await supabase
            .from('posts')
            .insert([payload]);

        if (insertError) {
            console.error('> DB ERROR:', insertError);
        } else {
            console.log(`> SIGNAL INJECTED: /posts/${finalData.slug}`);
            console.log(`> SCHEDULED FOR: ${publishDate.toISOString()}`);
        }
    } catch (err) {
        console.error(`> CRITICAL SYSTEM FAILURE:`, err.message);
        if (err.stack && !err.message.includes("JSON")) console.error(err.stack);
    }
}

runNewsroom();
