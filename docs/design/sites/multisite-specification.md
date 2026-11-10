# Three-Site Website Architecture — Functional Specification

**Project:** Strat17 / Puckle / Switchplay  
**Scope:** Public website architecture — initial three-site setup  
**Status:** Ready for Copilot engineering review; not approved for implementation  
**Replaces:** V1 and subsequent amendments in chat


## 1. Purpose

The existing Next.js project contains both a public-facing website and the underlying learning application. We now need **three distinct public-facing websites**, one for each product, while retaining **one repository, one underlying application and shared infrastructure**.

This first phase is deliberately narrow: make all three websites independently accessible and ready to evolve. **Do not redesign, rewrite or otherwise differentiate their content yet**, apart from the brand name shown in the header.

The three websites will later serve different audiences:

| Website | Domain | Future focus | Header brand in this phase |
|---|---|---|---|
| Strat17 | `strat17.com` | General creator/follower learning platform | `strat17` |
| Puckle | `puckle.co` | Maths tuition and learning | `puckle` |
| Switchplay | `switchplay.ie` | Basketball clubs and coaching | `switchplay` |

Use the actual existing header typography/capitalisation conventions where appropriate; the requirement is that the **correct brand name** appears on each site.

## 2. Required outcome of Phase 1

1. Each of the three domains serves its own website, including its homepage **and all associated public website pages**.
2. All three websites start as **complete, independently editable copies** of the existing public website.
3. Initially, the **only intended visible difference** between the sites is the brand name in the top-left header.
4. Existing public website content, imagery, interactions, forms, links, layout and responsive behaviour are otherwise preserved.
5. Existing authenticated learning-application behaviour is unchanged.
6. Work on a page or form for one website can subsequently proceed without requiring changes to equivalent pages or forms on the others.

The existing website is the reference implementation for all initial copies. Its creator/follower content may therefore appear temporarily on Puckle and Switchplay; that content will be rewritten in later phases. This is intentional, not an instruction to design those websites now.

## 3. Independent website pages and components

**Each website must have its own copies of its public-facing pages and page-specific code**, including, as applicable:

- Homepage, About page, Contact page, and every other existing public website page.
- Headers, footers, navigation, and public-site layouts.
- Creator signup and follower signup forms, plus their associated UI and validation code where page-specific.
- Page-specific styles and presentation components.

We explicitly prefer **some duplication of this small public website** over a shared marketing-page system that requires product-dependent conditionals, feature flags or complex configuration.

The copies must be genuinely independent: for example, a later redesign of Puckle's About page or signup form must not inadvertently alter the Strat17 or Switchplay equivalents. They need not retain the same page sets forever; a later website may add or remove public pages without forcing the others to do likewise.

This independence does **not** require copying the entire Next.js application, application components, database connection code, authentication infrastructure or other underlying systems.

If common assets or low-level utilities remain shared initially, Copilot should identify any risk that changing one could unexpectedly affect all three sites. **Do not introduce new abstractions just to eliminate modest duplication.**

## 4. Domains and navigation

For any supported public website route:

- Requests under `strat17.com` show the Strat17 version.
- Requests under `puckle.co` show the Puckle version.
- Requests under `switchplay.ie` show the Switchplay version.

Requirements:

- Each site's homepage is available at `/` on its own domain.
- Corresponding current public pages are available under the same appropriate paths on each domain; **inspect and retain the actual existing route paths**, rather than assuming particular ones.
- A direct link to a public page works without first visiting the homepage.
- Internal navigation and browser refreshes retain the correct website identity.
- Existing forms, anchors, redirects and links continue to work; investigate any hard-coded site/domain references.
- The bare domains and `www` variants should resolve consistently; Copilot should recommend the simplest canonical-domain handling.
- There must be a reliable, practical way to inspect all three website variants in local development without needing to deploy each change.
- Existing local development and Vercel preview workflows must not be broken.

**Keep domain-based website routing straightforward.** We do not want a general multi-brand framework, a feature-flag system or elaborate configuration machinery.

## 5. Forms and backend boundaries

All existing website forms must continue to work **as they do today** during Phase 1. Their content and behaviour should not be rewritten as part of the duplication.

The three websites must nevertheless be free to diverge later in **all aspects** of their forms:

- Appearance, fields, wording and flow.
- Validation and eligibility checks.
- Submission handling and business rules.
- Data properties and database destinations.
- Follow-up actions and communications.

For example, Puckle tuition enquiries may eventually store different information in a different location from creator applications or basketball-club enquiries.

We are **not prescribing three backend handlers now**. If identical copied forms can temporarily use the existing handler without restricting later independence, that is acceptable. Shared infrastructure (such as database connections, email delivery and existing authentication/security utilities) should remain shared where sensible. Do not force future business processes through one configurable signup system simply because all involve forms.

Website enquiries and application-account registration are distinct concepts; **do not redesign account creation or authentication in this phase**.

## 6. Relationship to the existing application

The existing learning application is shared by the product initiatives and must remain intact. This phase is about the **public websites**, not about creating three separate Card/Deck applications.

Do not change the following merely to support three public sites:

- Card, Deck, Creator, Group or media functionality.
- Application data models, collections or existing user data.
- Authentication, roles, permissions or user journeys, except for the minimum routing compatibility needed to preserve current behaviour and subject to review.
- Product-specific content access or curriculum features.

If current public-site routes overlap with application routes, or existing sign-in/sign-up redirects depend on a particular host, Copilot must identify the issue and propose a minimal solution **before implementation**. Do not silently change application behaviour.

## 7. Scope boundaries

### In scope now

- Three website identities and matching public-page routing.
- Independent initial copies of public website pages, forms and related site-specific components/styles.
- Correct header brand for each site.
- Preservation of existing site functionality and underlying application.
- Local verification approach, relevant automated tests and a documented domain/deployment setup plan.

### Out of scope now

- Puckle-specific homepage copy, imagery, maths demos, tuition enquiry workflow or curriculum targeting.
- Switchplay-specific marketing pages or basketball trial registration.
- Rebranding or redesigning the Strat17 content beyond the specified header brand.
- Country detection, pricing, payments and bookings.
- New database schemas, product identifiers on existing application records, or product-specific user-account changes.
- Separate applications, repositories or wholesale infrastructure duplication.
- Production DNS changes or domain cutovers without explicit approval.

## 8. Acceptance criteria

Phase 1 can be accepted when:

1. All three site variants can be opened and tested locally.
2. Each homepage displays the correct header brand and otherwise matches the current website.
3. Every existing public website page is available in each site variant and initially matches the reference version except for the header brand.
4. Navigation, forms, links and refresh/direct-route behaviour work correctly within each website.
5. Pages, forms and site-specific styling can be modified independently without unintended cross-site effects.
6. Existing authenticated application workflows are unaffected.
7. Relevant routing, page and regression tests pass; the result is checked on desktop and mobile, including iPhone.
8. Remaining manual Vercel/domain/DNS steps and any unresolved limitations are clearly documented.

## 9. Copilot handoff — engineering plan only

**Do not implement this specification yet.** First inspect the current repository and prepare a concise engineering plan.

The plan should:

1. Identify the current public website routes, components, forms, styles, link/redirect behaviour and their boundary with the authenticated application.
2. Recommend the **simplest maintainable structure** for independent copies of the public websites within the existing Next.js repository.
3. Recommend how to route the three domains (and local development/preview hostnames) to their respective public pages.
4. Explain which infrastructure should remain shared and where site-specific code will be copied, **without introducing unnecessary abstractions, conditionals or feature flags**.
5. Identify any issues involving authentication, signups, API endpoints, hard-coded URLs, styles, assets, metadata/SEO or hosting configuration that might affect correct routing or future independence.
6. Specify the proposed files/areas to change, the implementation sequence and focused automated/manual tests.
7. Clearly distinguish what can be done in code from manual domain/Vercel/DNS tasks, and flag any decisions requiring our approval.
8. Challenge the specification if repository evidence reveals a simpler solution or an important conflict, rather than guessing or making unilateral scope changes.

**Stop after presenting the engineering plan and questions. Await approval before coding.**

## 10. Guiding principle

**One existing Next.js application and shared infrastructure; three independently editable copies of the small public website; simple routing based on domain.** We favour clarity, freedom to diverge and minimal implementation overhead over premature reuse or architectural sophistication.
