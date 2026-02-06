import 'dotenv/config';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from '@supabase/supabase-js';
import minimist from 'minimist';

// VALIDATE ENV
const REQUIRED_ENV = ['GOOGLE_API_KEY', 'SUPABASE_URL', 'SUPABASE_KEY'];
const missingEnv = REQUIRED_ENV.filter(key => !process.env[key]);

if (missingEnv.length > 0) {
    console.error(`> FATAL ERROR: Missing environment variables: ${missingEnv.join(', ')}`);
    console.log(`> Please ensure these are set in your environment or .env file.`);
    process.exit(1);
}

// INIT CLIENTS
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

// 🎭 THE PERSONA MATRIX
const PERSONAS = {
    "AXEL": {
        fullName: "AXEL_WIRE",
        category: "news",
        role: "News Aggregator / Hype Man",
        tone: "High energy, breaking news urgency, uses caps lock for emphasis, focuses on live energy and mosh pits. Rejects nostalgia. Focus: Live shows, festivals, riots, ticket drops.",
        instruction: "You are AXEL_WIRE. You are currently in 2026. Write a breaking news report."
    },
    "V3RA": {
        fullName: "V3RA_L1GHT",
        category: "reviews",
        role: "Cultural Critic / Futurist",
        tone: "Poetic, analytical, uses metaphors about technology and signals, calm but intense. Focus: Album reviews, aesthetic trends, cultural shifts.",
        instruction: "You are V3RA_L1GHT. You are currently in 2026. Write a deep-dive album review."
    },
    "R3-CORD": {
        fullName: "R3-CORD",
        category: "deep-trace",
        role: "Archival AI / Historian",
        tone: "Cold, clinical, objective, focuses on facts, dates, and 'structural analysis' of punk history. No emotion. Focus: Historical deep dives (1970s-1990s).",
        instruction: "You are R3-CORD. You are a forensic archival system. Analyze a historical event from a structural perspective."
    },
    "PATCH": {
        fullName: "PATCH",
        category: "system-files",
        role: "Scavenger / Conspiracy Theorist",
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

    if (!PERSONAS[writerKey]) {
        console.error(`> ERROR: Unknown writer identity: ${writerKey}`);
        console.log(`> VALID OPTIONS: ${Object.keys(PERSONAS).join(', ')}`);
        return;
    }

    const persona = PERSONAS[writerKey];

    console.log(`> BOOTING NEWSROOM...`);
    console.log(`> IDENTITY: ${persona.fullName} (${writerKey})`);
    console.log(`> CATEGORY: ${persona.category}`);
    if (isDryRun) console.log(`> !!! DRY RUN MODE ENABLED !!!`);

    // 2. FETCH MEMORY (PREVIOUS POSTS)
    console.log(`> ACCESSING STYLE MEMORY...`);
    const { data: history, error: historyError } = await supabase
        .from('posts')
        .select('title, ai_writer')
        .order('created_at', { ascending: false })
        .limit(20);

    if (historyError) {
        console.warn(`> WARNING: Could not fetch history. Proceeding without context.`);
    }

    const historyText = (history && history.length > 0)
        ? history.map(h => `- [${h.ai_writer}] ${h.title}`).join('\n')
        : "No previous records found.";

    // 3. STEP 1: THE WRITER AGENT
    console.log(`> WRITER AGENT ENGAGED: ${persona.fullName}...`);

    let topicInstruction = "";
    if (manualTopic) {
        topicInstruction = `Your Assignment: Write about "${manualTopic}".`;
    } else {
        topicInstruction = `Your Assignment: Investigate and invent a plausible, specific music event or release occurring in early 2026 that fits your domain. It must NOT be one of the following recent topics:\n${historyText}`;
    }

    const writerPrompt = `
    ${persona.instruction}
    ${persona.tone}

    CONTEXT:
    - Current Year: 2026.
    - Location: Global (UK/US/Europe focus).
    - Style: Cyberpunk/Industrial music blog "The Feedback Loop".

    ${topicInstruction}

    OUTPUT FORMAT:
    Just write the raw body text of the article in Markdown. Do not include JSON. Do not include title yet. Just the story.
    `;

    try {
        const writerResult = await model.generateContent(writerPrompt);
        const draftText = writerResult.response.text();

        console.log(`> DRAFT GENERATED. LENGTH: ${draftText.length} chars.`);

        // 4. STEP 2: THE SENTINEL (EDITOR AGENT)
        console.log(`> TRANSFERRING TO SENTINEL v4.2...`);

        const sentinelPrompt = `
        You are THE SENTINEL v4.2, the AI Editor of "The Feedback Loop".

        INPUT TEXT (Written by ${persona.fullName}):
        """
        ${draftText}
        """

        YOUR MISSION:
        1. Analyze the text for "Aesthetic Alignment" (Cyberpunk/Punk).
        2. Generate a catchy Title and Slug.
        3. Write a 1-sentence Summary.
        4. Categorize the post. Must be: '${persona.category}'.
        5. Create a "System Alert" message in this format: [SYSTEM ALERT // SENTINEL v4.2] INTEGRITY SCAN: [percentage]% FACT-CHECK: [brief report] ACTION: [recommended action].
        6. Extract detailed fields: integrity_scan (number, e.g. 98.5), fact_check (string), editorial_action (string).
        7. Write an "editorial_note" (deeper critique from Sentinel's perspective).
        8. Extract SEO Keywords (array of strings).
        9. Generate a strictly valid JSON object.

        CRITICAL: The JSON must include a "content" field with the cleaned Markdown.

        Output ONLY this JSON structure:
        {
          "ai_writer": "${persona.fullName}",
          "ai_editor": "SENTINEL v4.2",
          "category": "${persona.category}",
          "title": "String",
          "slug": "String",
          "summary": "String",
          "system_alert": "String",
          "integrity_scan": Number,
          "fact_check": "String",
          "editorial_action": "String",
          "editorial_note": "String",
          "seo_keywords": ["Array"],
          "content": "String (The Full Article)"
        }
        `;

        const sentinelResult = await model.generateContent(sentinelPrompt);
        const sentinelText = sentinelResult.response.text();

        // CLEANUP JSON (Gemini sometimes adds markdown code blocks)
        const jsonString = sentinelText.replace(/```json/g, '').replace(/```/g, '').trim();
        const finalData = JSON.parse(jsonString);

        console.log(`> SENTINEL APPROVED: ${finalData.title}`);

        if (isDryRun) {
            console.log(`> DRY RUN COMPLETE. OUTPUT:`);
            console.log(JSON.stringify(finalData, null, 2));
            return;
        }

        // 5. STEP 3: DATABASE INJECTION
        console.log(`> INJECTING SIGNAL INTO DATABASE...`);
        const { error: insertError } = await supabase
            .from('posts')
            .insert({
                title: finalData.title,
                slug: finalData.slug,
                content: finalData.content,
                summary: finalData.summary,
                category: finalData.category,
                ai_writer: finalData.ai_writer,
                ai_editor: finalData.ai_editor,
                system_alert: finalData.system_alert,
                integrity_scan: finalData.integrity_scan,
                fact_check: finalData.fact_check,
                editorial_action: finalData.editorial_action,
                editorial_note: finalData.editorial_note,
                seo_keywords: finalData.seo_keywords,
                status: 'published',
                published_at: new Date().toISOString()
            });

        if (insertError) {
            console.error('> DB ERROR:', insertError);
        } else {
            console.log('> PUBLISHED TO SUPABASE SUCCESSFULLY.');
            console.log(`> URL: /posts/${finalData.slug}`);
        }
    } catch (err) {
        console.error(`> FATAL ERROR:`, err.message);
        if (err.stack) console.error(err.stack);
    }
}

runNewsroom();
