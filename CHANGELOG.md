# Changelog

All notable changes to SearchReady are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/); the project uses
MAJOR.MINOR.PATCH versioning.

## [1.3.0] — 2026-09-19

### Added

- **Feedback page** (`/feedback`, linked from the footer) for live-user
  testing — backed by Netlify Forms; submissions land in the Netlify
  dashboard (free tier, 100/month).
- **Concurrent burst load check** in the post-deploy audit: 20 parallel
  users × 3 rounds, in addition to the sequential 60-request check.
- Feedback-form smoke test in the Live Check workflow.

## [1.2.0] — 2026-09-18

### Added

- **Entity AEO + Entity GEO** — the entity dimension now spans three
  pillars: Entity SEO (identity), Entity AEO (answer attribution: the
  direct-answer block names the brand/author; author entity in structured
  data), and Entity GEO (generative citability: definitional sentence
  near the top; og:title/og:type machine-readable metadata).
- Four new checklist items with their own badges (Entity AEO, Entity GEO)
  and four new stats fields (`hasAnswerAttribution`, `hasSchemaAuthor`,
  `hasEntityDefinition`, `hasOgEntityMetadata`).

### Changed

- Entity check weights rebalanced across the three pillars
  (SEO 62 / AEO 20 / GEO 18, still totalling 100).

## [1.1.0] — 2026-09-18

### Added

- **Entity SEO score** — a dedicated Entity dimension (typed schema.org
  entity schema, named author, sameAs identity links, brand-name
  consistency, about/mentions relationships) shown as a fourth score
  card, with entity items in the checklist and an Entity column in the
  dashboard.
- `entityScore` in history (localStorage and Supabase, via migration
  `0002_add_entity_score`).
- Overall score is now the mean of the SEO, AI-answer, and Entity scores.

## [1.0.1] — 2026-09-18

### Changed

- Continuous deployment from GitHub is live: pushes to `main`
  auto-deploy. Removed the one-off `netlify-deploy.yml` workflow and
  documented the flow in the README.

## [1.0.0] — 2026-09-18

### Added

- Initial delivery: URL analyzer (SEO + AI-answer readiness scoring),
  content template generator, dashboard with local history, Supabase
  auth (demo mode), security hardening (CSP, SSRF guard, rate limiting),
  CI with tests + secret scanning + audits, and Netlify deployment.
