"use strict";
/**
 * Content Template Generator — produces a ready-to-use outline
 * optimized for both classic search and AI answer engines.
 * Rule-based and deterministic.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTemplate = generateTemplate;
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function generateTemplate(rawTopic) {
    const topic = rawTopic.trim().replace(/\s+/g, " ").slice(0, 120);
    const t = capitalize(topic);
    const metaDescription = `${t}: what it is, how it works, why it matters, and how to get started — a practical, up-to-date guide with answers to common questions.`.slice(0, 158);
    const sections = [
        {
            heading: `What is ${topic}?`,
            purpose: "Define the entity clearly — this is what AI engines quote first.",
            directAnswerPrompt: "40–80 words defining the topic in plain language. No history, no fluff — just the definition and one differentiating fact.",
            bulletPoints: [
                "One-sentence definition a 12-year-old could repeat",
                "Category it belongs to (e.g. 'a marketing tactic', 'a software category')",
                "One concrete example",
            ],
        },
        {
            heading: `How does ${topic} work?`,
            purpose: "Explain the mechanism — question-form headings match real queries.",
            directAnswerPrompt: "A 40–80 word summary of the mechanism, then a numbered step-by-step breakdown.",
            bulletPoints: [
                "3–6 numbered steps",
                "One sentence per step, concrete verbs",
                "Mention what makes it succeed or fail",
            ],
        },
        {
            heading: `Why does ${topic} matter?`,
            purpose: "Give the stakes and benefits — supports 'why' queries.",
            directAnswerPrompt: "2–3 quantified benefits in a short paragraph plus a bullet list.",
            bulletPoints: ["Benefit + number if available", "Who benefits most", "Cost of ignoring it"],
        },
        {
            heading: `${t} vs. alternatives`,
            purpose: "Comparison content is heavily cited by AI engines.",
            directAnswerPrompt: "One-sentence verdict on when to choose it, followed by a comparison table.",
            bulletPoints: [
                "Table: rows = options, columns = key criteria",
                "Clear 'choose X when...' guidance",
            ],
        },
        {
            heading: `How to get started with ${topic}`,
            purpose: "Actionable next steps — high engagement, wins featured snippets.",
            directAnswerPrompt: "The single fastest first step in one sentence, then a checklist.",
            bulletPoints: ["First 3 actions in priority order", "Common beginner mistake to avoid"],
        },
    ];
    const faq = [
        {
            question: `Is ${topic} worth it?`,
            answerHint: "One-paragraph honest verdict with a rule of thumb for when it pays off.",
        },
        {
            question: `How long does ${topic} take?`,
            answerHint: "Give realistic time ranges for setup and for results.",
        },
        {
            question: `How much does ${topic} cost?`,
            answerHint: "Typical ranges; if it varies, say what drives the variance.",
        },
        {
            question: `What are common mistakes with ${topic}?`,
            answerHint: "3 mistakes with one-line fixes each.",
        },
    ];
    return {
        topic,
        title: `${t}: Complete Guide (What It Is, How It Works, and Why It Matters)`.slice(0, 65),
        metaDescription,
        introAnswerBlock: "Write your 40–80 word direct answer here. It must stand alone: a reader who sees only this paragraph should understand the topic. AI engines (ChatGPT, Perplexity, AI Overviews) overwhelmingly quote self-contained short answers near the top of the page.",
        sections,
        faq,
        keyEntities: [
            `Primary entity: ${topic}`,
            "Related entities: list 5–8 concrete things people mention alongside the topic (tools, people, standards)",
            "Attributes: price/cost, time, difficulty, alternatives",
        ],
        tips: [
            "Put the direct answer immediately after the H1 — before any backstory.",
            "Phrase headings as the exact questions users type.",
            "Mark up the FAQ with FAQPage JSON-LD.",
            "Add Organization or Person JSON-LD for entity clarity.",
            "Keep paragraphs short — 40–80 word blocks get quoted.",
            "Re-analyze the published page with SearchReady to verify your score.",
        ],
    };
}
