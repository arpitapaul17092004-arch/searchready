import { parsePage, type ParsedPage } from "./dom";

/**
 * SearchReady core analysis engine.
 *
 * Deliberately rule-based and transparent (per product principles):
 * every score maps to visible checks so users can see exactly why a
 * page scored the way it did. No black-box AI scoring.
 */

export type Impact = "high" | "medium" | "low";
export type Category = "seo" | "ai" | "entity";

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  fix: string;
  impact: Impact;
  category: Category;
  passed: boolean;
}

export interface AnalysisStats {
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  h1Count: number;
  h2Count: number;
  questionHeadingCount: number;
  wordCount: number;
  hasDirectAnswer: boolean;
  hasFaq: boolean;
  hasStructuredData: boolean;
  imageCount: number;
  imagesWithAlt: number;
  jsonLdTypes: string[];
  hasSameAs: boolean;
  namedAuthor: boolean;
  siteName: string | null;
}

export interface AnalysisResult {
  url: string;
  finalUrl: string;
  analyzedAt: string;
  overallScore: number;
  seoScore: number;
  aiAnswerScore: number;
  entityScore: number;
  checklist: ChecklistItem[];
  summary: string;
  stats: AnalysisStats;
}

interface Signal {
  passed: boolean;
  weight: number;
}

/** Count words in a text block. */
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Detect a "direct answer" block: a 40–80 word paragraph early in the body. */
export function checkDirectAnswer(page: ParsedPage): boolean {
  const paragraphs = page.allTexts("p").filter((t) => t.length > 0);
  // AI engines quote self-contained short paragraphs; look at the first 6.
  const candidates = paragraphs.slice(0, 6);
  return candidates.some((p) => {
    const words = wordCount(p);
    return words >= 40 && words <= 80;
  });
}

/** FAQ detection: FAQPage JSON-LD, >=2 question-mark headings, or details/summary blocks. */
export function checkFaq(page: ParsedPage, html: string): boolean {
  const hasFaqSchema =
    html.includes('"FAQPage"') || html.includes("'FAQPage'") || html.includes("FAQPage");
  const questionHeadings = page
    .allTexts("h1, h2, h3")
    .filter((t) => t.endsWith("?"));
  const hasDetailsBlocks = page.count("details summary") >= 2;
  return hasFaqSchema || questionHeadings.length >= 2 || hasDetailsBlocks;
}

function questionHeadingCount(page: ParsedPage): number {
  return page.allTexts("h1, h2, h3").filter((t) => t.endsWith("?")).length;
}

function hasStructuredData(html: string): boolean {
  return /application\/ld\+json/i.test(html);
}

function checkHeadingStructure(page: ParsedPage): boolean {
  const h1 = page.count("h1");
  const h2 = page.count("h2");
  const h3 = page.count("h3");
  return h1 === 1 && (h2 >= 2 || (h2 >= 1 && h3 >= 2));
}

function robotsAllowsIndexing(page: ParsedPage): boolean {
  const robots = (page.attrOf('meta[name="robots"]', "content") ?? "").toLowerCase();
  return !robots.includes("noindex");
}

function imageAltCoverage(page: ParsedPage): { total: number; withAlt: number } {
  const total = page.count("img");
  const withAlt = page.count("img[alt]");
  return { total, withAlt };
}

// --- Entity SEO helpers ---------------------------------------------
// Entity SEO = making the page understandable as being *about* specific,
// identifiable entities (brand, author, topic) for knowledge graphs.

/** schema.org types that declare a real-world entity on the page. */
const ENTITY_SCHEMA_TYPES = [
  "Organization",
  "Person",
  "LocalBusiness",
  "Article",
  "NewsArticle",
  "BlogPosting",
  "Product",
  "FAQPage",
  "WebSite",
  "WebPage",
  "AboutPage",
  "ContactPage",
  "BreadcrumbList",
  "HowTo",
  "Event",
  "Place",
];

/** Extract @type values from JSON-LD blocks in raw HTML. */
export function extractJsonLdTypes(html: string): string[] {
  const types = new Set<string>();
  const re = /"@type"\s*:\s*(?:"([^"]+)"|\[([^\]]*)\])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[1]) types.add(m[1]);
    if (m[2]) {
      for (const part of m[2].split(",")) {
        const t = part.replace(/["'\s]/g, "");
        if (t) types.add(t);
      }
    }
  }
  return [...types];
}

function hasTypedEntitySchema(jsonLdTypes: string[]): boolean {
  return jsonLdTypes.some((t) => ENTITY_SCHEMA_TYPES.includes(t));
}

/** External identity links: JSON-LD sameAs URLs or twitter:site meta. */
function hasSameAsLinks(html: string, page: ParsedPage): boolean {
  const jsonLdSameAs = /"sameAs"\s*:\s*"https?:\/\/"/.test(html) ||
    /"sameAs"\s*:\s*\[\s*"https?:\/\//.test(html);
  const twitterSite = page.attrOf('meta[name="twitter:site"]', "content");
  return jsonLdSameAs || Boolean(twitterSite?.trim());
}

/** A named human/organizational author for the content. */
function hasNamedAuthor(page: ParsedPage, html: string): boolean {
  const meta =
    page.attrOf('meta[name="author"]', "content") ??
    page.attrOf('meta[property="article:author"]', "content");
  if (meta?.trim()) return true;
  return /"Person"[\s\S]{0,200}?"name"/.test(html);
}

/** JSON-LD about/mentions pointing at recognized entities. */
function hasAboutOrMentions(html: string): boolean {
  return /"(?:about|mentions)"\s*:\s*(?:\{|"|\[)/.test(html);
}

/** Brand name from og:site_name reused in title or H1 — consistent naming. */
function hasBrandConsistency(
  page: ParsedPage,
  title: string | null,
  siteName: string | null,
): boolean {
  if (!siteName || siteName.trim().length < 2) return false;
  const brand = siteName.trim().toLowerCase();
  const h1 = (page.textOf("h1") || "").toLowerCase();
  return (title?.toLowerCase().includes(brand) || h1.includes(brand)) ?? false;
}

function hasListsOrTables(page: ParsedPage): boolean {
  return page.count("ul li, ol li, table") >= 3;
}

export function generateSummary(overallScore: number): string {
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
export function analyzeHtml(html: string, url: string, finalUrl = url): AnalysisResult {
  const page = parsePage(html);
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
  const listsTables = hasListsOrTables(page);
  const qHeadings = questionHeadingCount(page);
  const words = wordCount(page.bodyText());
  const wordsOk = words >= 300;

  // --- Entity SEO signals ---
  const siteName =
    page.attrOf('meta[property="og:site_name"]', "content")?.trim() || null;
  const jsonLdTypes = extractJsonLdTypes(rawHtml);
  const entitySchema = hasTypedEntitySchema(jsonLdTypes);
  const entityAuthor = hasNamedAuthor(page, rawHtml);
  const entitySameAs = hasSameAsLinks(rawHtml, page);
  const entityConsistency = hasBrandConsistency(page, title, siteName);
  const entityAbout = hasAboutOrMentions(rawHtml);

  // --- SEO score signals (transparent weights, total = 100) ---
  const seoSignals: Record<string, Signal> = {
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
  // Entity signals live in their own entity score, so the AI score now
  // weighs answer-shape signals only.
  const aiSignals: Record<string, Signal> = {
    directAnswer: { passed: directAnswer, weight: 27 },
    faq: { passed: faq, weight: 24 },
    structuredData: { passed: structured, weight: 17 },
    questionHeadings: { passed: qHeadings >= 3, weight: 15 },
    listsTables: { passed: listsTables, weight: 11 },
    contentDepth: { passed: words >= 600, weight: 6 },
  };

  // --- Entity SEO score signals (total = 100) ---
  const entitySignals: Record<string, Signal> = {
    entitySchema: { passed: entitySchema, weight: 25 },
    entityAuthor: { passed: entityAuthor, weight: 20 },
    entitySameAs: { passed: entitySameAs, weight: 20 },
    entityConsistency: { passed: entityConsistency, weight: 20 },
    entityAbout: { passed: entityAbout, weight: 15 },
  };

  const scoreOf = (signals: Record<string, Signal>): number => {
    const total = Object.values(signals).reduce((s, sig) => s + sig.weight, 0);
    const earned = Object.values(signals).reduce(
      (s, sig) => s + (sig.passed ? sig.weight : 0),
      0,
    );
    return Math.round((earned / total) * 100);
  };

  const seoScore = scoreOf(seoSignals);
  const aiAnswerScore = scoreOf(aiSignals);
  const entityScore = scoreOf(entitySignals);
  const overallScore = Math.round(
    (seoScore + aiAnswerScore + entityScore) / 3,
  );

  // --- Checklist ---
  const checklist: ChecklistItem[] = [
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
      description:
        imageTotal === 0
          ? "No images found on the page."
          : `${imageWithAlt} of ${imageTotal} images have alt text.`,
      fix: "Describe each image's content or purpose in its alt attribute.",
      impact: "low",
      category: "seo",
      passed: seoSignals.images.passed,
    },
    {
      id: "entity-schema",
      title: "Entity schema (typed JSON-LD)",
      description: entitySchema
        ? `Typed structured data found (${jsonLdTypes.slice(0, 4).join(", ")}${jsonLdTypes.length > 4 ? "…" : ""}).`
        : "No typed entity schema found. Knowledge graphs identify pages through schema.org types like Organization, Person, or Article.",
      fix: "Add JSON-LD with a specific @type (Organization, Person, Article, Product…) describing who is behind the page and what it is about.",
      impact: "high",
      category: "entity",
      passed: entitySchema,
    },
    {
      id: "entity-author",
      title: "Named author entity",
      description: entityAuthor
        ? "A named author (or authoring organization) was found."
        : "No named author found. Content with an attributable author ranks better for entity-based queries and E-E-A-T.",
      fix: "Add an author meta tag or Person JSON-LD with a name, plus a visible about-the-author block.",
      impact: "medium",
      category: "entity",
      passed: entityAuthor,
    },
    {
      id: "entity-sameas",
      title: "Entity identity links (sameAs)",
      description: entitySameAs
        ? "External identity links found (sameAs URLs or twitter:site)."
        : "No sameAs identity links found. These connect your entity to authoritative profiles (social, Wikipedia, Wikidata).",
      fix: "Add a sameAs array in your Organization/Person JSON-LD pointing to your social profiles and other canonical entity references.",
      impact: "medium",
      category: "entity",
      passed: entitySameAs,
    },
    {
      id: "entity-consistency",
      title: "Brand name consistency",
      description: entityConsistency
        ? `The site name${siteName ? ` (${siteName})` : ""} is used consistently in the title or H1.`
        : siteName
          ? `The site name (${siteName}) does not appear in the title or H1 — inconsistent entity naming weakens recognition.`
          : "No site/brand name found (og:site_name missing), so the page's entity is unnamed.",
      fix: "Set og:site_name and reuse the exact brand name in the title tag and H1 so all entity references match.",
      impact: "medium",
      category: "entity",
      passed: entityConsistency,
    },
    {
      id: "entity-about",
      title: "Entity relationships (about / mentions)",
      description: entityAbout
        ? "The structured data links the page to other entities via about/mentions."
        : "No about/mentions relationships found. They tell knowledge graphs what entities the content relates to.",
      fix: "Add about (primary topic) and mentions (related entities) properties to your JSON-LD, referencing entities by URL or @id.",
      impact: "low",
      category: "entity",
      passed: entityAbout,
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

  const stats: AnalysisStats = {
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
    jsonLdTypes,
    hasSameAs: entitySameAs,
    namedAuthor: entityAuthor,
    siteName,
  };

  return {
    url,
    finalUrl,
    analyzedAt: new Date().toISOString(),
    overallScore,
    seoScore,
    aiAnswerScore,
    entityScore,
    checklist,
    summary: generateSummary(overallScore),
    stats,
  };
}
