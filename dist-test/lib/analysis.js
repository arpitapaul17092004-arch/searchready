"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDirectAnswer = checkDirectAnswer;
exports.checkFaq = checkFaq;
exports.generateSummary = generateSummary;
exports.analyzeHtml = analyzeHtml;
const dom_1 = require("./dom");
/** Count words in a text block. */
function wordCount(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
}
/** Detect a "direct answer" block: a 40–80 word paragraph early in the body. */
function checkDirectAnswer(page) {
    const paragraphs = page.allTexts("p").filter((t) => t.length > 0);
    // AI engines quote self-contained short paragraphs; look at the first 6.
    const candidates = paragraphs.slice(0, 6);
    return candidates.some((p) => {
        const words = wordCount(p);
        return words >= 40 && words <= 80;
    });
}
/** FAQ detection: FAQPage JSON-LD, >=2 question-mark headings, or details/summary blocks. */
function checkFaq(page, html) {
    const hasFaqSchema = html.includes('"FAQPage"') || html.includes("'FAQPage'") || html.includes("FAQPage");
    const questionHeadings = page
        .allTexts("h1, h2, h3")
        .filter((t) => t.endsWith("?"));
    const hasDetailsBlocks = page.count("details summary") >= 2;
    return hasFaqSchema || questionHeadings.length >= 2 || hasDetailsBlocks;
}
function questionHeadingCount(page) {
    return page.allTexts("h1, h2, h3").filter((t) => t.endsWith("?")).length;
}
function hasStructuredData(html) {
    return /application\/ld\+json/i.test(html);
}
function checkHeadingStructure(page) {
    const h1 = page.count("h1");
    const h2 = page.count("h2");
    const h3 = page.count("h3");
    return h1 === 1 && (h2 >= 2 || (h2 >= 1 && h3 >= 2));
}
function robotsAllowsIndexing(page) {
    const robots = (page.attrOf('meta[name="robots"]', "content") ?? "").toLowerCase();
    return !robots.includes("noindex");
}
function imageAltCoverage(page) {
    const total = page.count("img");
    const withAlt = page.count("img[alt]");
    return { total, withAlt };
}
function hasEntityClarity(page, html) {
    const author = page.attrOf('meta[name="author"]', "content") ??
        page.attrOf('meta[property="article:author"]', "content");
    const organization = page.attrOf('meta[property="og:site_name"]', "content");
    const hasJsonLdIdentity = /"Organization"/.test(html) || /"Person"/.test(html) || /"about"/.test(html);
    return Boolean(author?.trim() || organization?.trim() || hasJsonLdIdentity);
}
function hasListsOrTables(page) {
    return page.count("ul li, ol li, table") >= 3;
}
function generateSummary(overallScore) {
    if (overallScore >= 85) {
        return "Excellent — this page is well-optimized for both traditional search and AI answer engines. Polish the remaining checklist items to stay ahead.";
    }
    if (overallScore >= 65) {
        return "Good foundation. Your page covers many visibility signals, but the prioritized checklist below contains concrete fixes that would meaningfully improve both SEO and AI-answer readiness.";
    }
    if (overallScore >= 40) {
        return "Needs work. Several important visibility signals are missing. Work through the high-impact checklist items first — they move both your search ranking and your chances of appearing in AI answers.";
    }
    return "Poor readiness. This page is missing most of the signals both search engines and AI answer engines rely on. Start with the high-impact items in the checklist, then re-analyze.";
}
/**
 * Analyze raw HTML. Kept as a pure function (no network) so it can be
 * unit-tested against fixtures and reused by any caller.
 */
function analyzeHtml(html, url, finalUrl = url) {
    const page = (0, dom_1.parsePage)(html);
    const rawHtml = html; // structured-data checks run on the original markup
    page.remove("script, style, noscript, template");
    const title = page.textOf("head title") || null;
    const titleLength = title?.length ?? 0;
    const metaDescription = page.attrOf('meta[name="description"]', "content")?.trim() || null;
    const metaDescLength = metaDescription?.length ?? 0;
    const canonical = page.attrOf('link[rel="canonical"]', "href");
    const lang = page.attrOf("html[lang]", "lang");
    const viewport = page.attrOf('meta[name="viewport"]', "content");
    const directAnswer = checkDirectAnswer(page);
    const faq = checkFaq(page, rawHtml);
    const structured = hasStructuredData(rawHtml);
    const headingStructure = checkHeadingStructure(page);
    const indexable = robotsAllowsIndexing(page);
    const { total: imageTotal, withAlt: imageWithAlt } = imageAltCoverage(page);
    const imagesOk = imageTotal === 0 ? false : imageWithAlt / imageTotal >= 0.8;
    const entityClarity = hasEntityClarity(page, rawHtml);
    const listsTables = hasListsOrTables(page);
    const qHeadings = questionHeadingCount(page);
    const words = wordCount(page.bodyText());
    const wordsOk = words >= 300;
    // --- SEO score signals (transparent weights, total = 100) ---
    const seoSignals = {
        title: { passed: titleLength >= 30 && titleLength <= 65, weight: 18 },
        metaDescription: { passed: metaDescLength >= 70 && metaDescLength <= 160, weight: 14 },
        h1: { passed: page.count("h1") === 1, weight: 14 },
        headingStructure: { passed: headingStructure, weight: 12 },
        canonical: { passed: Boolean(canonical), weight: 8 },
        images: { passed: imagesOk, weight: 10 },
        lang: { passed: Boolean(lang), weight: 5 },
        viewport: { passed: Boolean(viewport), weight: 5 },
        indexable: { passed: indexable, weight: 6 },
        contentDepth: { passed: wordsOk, weight: 8 },
    };
    // --- AI-answer score signals (total = 100) ---
    const aiSignals = {
        directAnswer: { passed: directAnswer, weight: 25 },
        faq: { passed: faq, weight: 22 },
        structuredData: { passed: structured, weight: 15 },
        questionHeadings: { passed: qHeadings >= 3, weight: 14 },
        listsTables: { passed: listsTables, weight: 10 },
        entityClarity: { passed: entityClarity, weight: 8 },
        contentDepth: { passed: words >= 600, weight: 6 },
    };
    const scoreOf = (signals) => {
        const total = Object.values(signals).reduce((s, sig) => s + sig.weight, 0);
        const earned = Object.values(signals).reduce((s, sig) => s + (sig.passed ? sig.weight : 0), 0);
        return Math.round((earned / total) * 100);
    };
    const seoScore = scoreOf(seoSignals);
    const aiAnswerScore = scoreOf(aiSignals);
    const overallScore = Math.round((seoScore + aiAnswerScore) / 2);
    // --- Checklist ---
    const checklist = [
        {
            id: "title",
            title: "Compelling title tag (30–65 characters)",
            description: title
                ? `Found a ${titleLength}-character title. Search engines show ~60 characters; AI systems use it to understand the topic.`
                : "No <title> tag was found.",
            fix: "Write a specific title with the primary keyword near the front.",
            impact: "high",
            category: "seo",
            passed: seoSignals.title.passed,
        },
        {
            id: "meta-description",
            title: "Meta description (70–160 characters)",
            description: metaDescription
                ? `Found a ${metaDescLength}-character meta description.`
                : "No meta description was found.",
            fix: "Summarize the page's answer in one or two sentences, matching search intent.",
            impact: "medium",
            category: "seo",
            passed: seoSignals.metaDescription.passed,
        },
        {
            id: "h1",
            title: "Exactly one clear H1",
            description: `Found ${page.count("h1")} H1 tag(s).`,
            fix: "Use a single H1 that states the page topic in plain language.",
            impact: "high",
            category: "seo",
            passed: seoSignals.h1.passed,
        },
        {
            id: "heading-structure",
            title: "Logical heading structure (H1 → H2s → H3s)",
            description: `Found ${page.count("h2")} H2 and ${page.count("h3")} H3 headings.`,
            fix: "Break the content into scannable sections with descriptive H2/H3 headings.",
            impact: "medium",
            category: "seo",
            passed: seoSignals.headingStructure.passed,
        },
        {
            id: "direct-answer",
            title: "Direct short answer block (40–80 words)",
            description: directAnswer
                ? "A self-contained 40–80 word answer paragraph was found near the top of the page."
                : "No self-contained short answer was found near the top of the page. AI engines overwhelmingly quote pages that answer the question immediately.",
            fix: "Add a single paragraph right after the H1 that answers the core question in 40–80 words, with no fluff.",
            impact: "high",
            category: "ai",
            passed: directAnswer,
        },
        {
            id: "faq",
            title: "FAQ section",
            description: faq
                ? "FAQ signals found (FAQ schema, question headings, or expandable Q&A blocks)."
                : "No FAQ section detected.",
            fix: "Add an FAQ section with 3–6 real questions your audience asks, ideally marked up with FAQPage structured data.",
            impact: "high",
            category: "ai",
            passed: faq,
        },
        {
            id: "structured-data",
            title: "Structured data (schema.org JSON-LD)",
            description: structured
                ? "JSON-LD structured data found."
                : "No JSON-LD structured data found. Machines use it to identify who/what the page is about.",
            fix: "Add Article/FAQPage/Organization JSON-LD describing the page, author, and entity.",
            impact: "medium",
            category: "ai",
            passed: structured,
        },
        {
            id: "question-headings",
            title: "Question-based headings (3+)",
            description: `Found ${qHeadings} heading(s) phrased as questions.`,
            fix: "Rewrite some section headings as the exact questions users ask (e.g. 'How much does X cost?').",
            impact: "medium",
            category: "ai",
            passed: aiSignals.questionHeadings.passed,
        },
        {
            id: "canonical",
            title: "Canonical URL",
            description: canonical
                ? "A canonical link was found."
                : "No canonical link was found, which risks duplicate-content dilution.",
            fix: "Add <link rel=\"canonical\"> pointing at the preferred version of the page.",
            impact: "low",
            category: "seo",
            passed: seoSignals.canonical.passed,
        },
        {
            id: "images",
            title: "Descriptive image alt text (80%+ coverage)",
            description: imageTotal === 0
                ? "No images found on the page."
                : `${imageWithAlt} of ${imageTotal} images have alt text.`,
            fix: "Describe each image's content or purpose in its alt attribute.",
            impact: "low",
            category: "seo",
            passed: seoSignals.images.passed,
        },
        {
            id: "entity-clarity",
            title: "Entity clarity (author / organization signals)",
            description: entityClarity
                ? "Author or organization identity signals were found."
                : "No author or organization identity found — AI engines favor content with a clear, attributable source.",
            fix: "Add meta author tags, an about-the-author block, or Organization JSON-LD.",
            impact: "medium",
            category: "ai",
            passed: entityClarity,
        },
        {
            id: "content-depth",
            title: "Sufficient content depth (300+ words)",
            description: `The page body contains roughly ${words} words.`,
            fix: "Expand thin pages with substantive, well-structured content (600+ words for AI-answer eligibility).",
            impact: "medium",
            category: "seo",
            passed: wordsOk,
        },
    ];
    const stats = {
        title,
        titleLength,
        metaDescription,
        h1Count: page.count("h1"),
        h2Count: page.count("h2"),
        questionHeadingCount: qHeadings,
        wordCount: words,
        hasDirectAnswer: directAnswer,
        hasFaq: faq,
        hasStructuredData: structured,
        imageCount: imageTotal,
        imagesWithAlt: imageWithAlt,
    };
    return {
        url,
        finalUrl,
        analyzedAt: new Date().toISOString(),
        overallScore,
        seoScore,
        aiAnswerScore,
        checklist,
        summary: generateSummary(overallScore),
        stats,
    };
}
