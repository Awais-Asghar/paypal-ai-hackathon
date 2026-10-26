# PayPal AI Hackathon: Brief

Collected from https://paypalaihackathon.devpost.com (Overview, Rules, Resources, FAQs, Updates and sponsor pages) on 2026-10-21. The Official Rules govern if anything here disagrees with them: https://paypalaihackathon.devpost.com/rules

## Key dates (Pacific Time)

| What | When |
|---|---|
| Submission period | Oct 1, 2026 9:15 am → **Nov 12, 2026 12:00 pm PT** (the webinars said 2 pm; trust the rules page: **12:00 pm**) |
| Judging | Dec 1 → Dec 15, 2026 |
| Winners announced | ~Dec 21, 2026 |

About 18,100 participants were registered on Oct 21. The event is online and global.

## The one hard requirement

The project must **meaningfully use both PayPal and AI**. PayPal has to be central: "adding a PayPal button to an unrelated app is not enough." Build with the **free PayPal sandbox**. Any AI model or tool is allowed.

PayPal-family services count: Venmo, Braintree, Xoom, Honey, Zettle, Paidy, Hyperwallet and others. Many are region-gated or need business review, so check before relying on one.

## Submission checklist

Status 2026-10-26: everything is built and written; what's left is the owner pasting and submitting on Devpost (see CLAUDE.md "Owner steps left").

- [x] Registered on Devpost for the hackathon
- [x] PayPal Developer account with sandbox apps (business plus personal test accounts)
- [ ] **Project name** and **elevator pitch** (a few sentences): written in docs/DEVPOST.md, to paste
- [ ] **Project story**: inspiration, how it was built, tools, challenges: written in docs/DEVPOST.md, to paste
- [ ] **Text description** of features and functionality: written in docs/DEVPOST.md, to paste
- [ ] **Tools list**: each AI model or service used and *how* it was used: written in docs/DEVPOST.md, to paste
- [x] **Functional demo**, either a hosted URL *or* complete setup and run instructions in the repo, with any test credentials or sandbox logins judges need. Mockups and static prototypes are disqualifying. Hosted at https://suresend-71bi.onrender.com/judge; logins go in Devpost's judges-only field
- [x] **Public repo** (GitHub, GitLab or Bitbucket) with all source, assets and instructions
- [x] **Open-source LICENSE file** detectable in the repo's About section (MIT)
- [x] **Demo video** under 3:00, public on **YouTube**, showing the project running on its target device. No third-party trademarks or copyrighted music without permission. 2:07, no music: https://youtu.be/JHUiZ52T3pA
- [x] All materials in **English**
- [x] If the project existed before Oct 1, explain what was significantly updated (it didn't: started Oct 21, 2026)
- [ ] Sponsor questions on the form answered, for example the APIMatic plugin question: answers in docs/DEVPOST.md

## Judging

**Stage 1 (pass/fail):** fits the theme and reasonably applies the required PayPal APIs or SDKs.

**Stage 2: five equally weighted criteria.** Ties are broken by criterion order, so Technological Implementation matters most in a tie.

1. **Technological Implementation**: How thoroughly and skillfully does it use the PayPal Developer Platform *and* AI? Is the implementation non-trivial and working?
2. **Design**: Is it a complete, coherent product experience, not just a technical proof of concept?
3. **Potential Impact**: Does it make a credible, specific case for a real problem and a real audience, and does the demo show it solving that problem?
4. **Innovation / Idea**: How novel is it, and how does it differ from existing concepts?
5. **Presentation**: Does the video show it working end to end? Is it clear what problem it solves, who it's for and why it matters?

Judging can include expert panels, peer review or "automated AI-driven analysis". The README and description need to be clear to a skimming reader, human or machine.

## Prizes ($67,500+)

| Category | Prize |
|---|---|
| 1st / 2nd / 3rd | $12,000 / $8,000 / $5,000 |
| Most Creative | $5,000 |
| Most Impactful | $5,000 |
| Best Demo Delivery | $5,000 |
| Best Use of PayPal + AI | $5,000 |
| Best Use of Agentic Commerce | $5,000 |
| Best Use of AG Grid | $5,000 / $2,000 / 3 × $1,000 |
| Best Use of APIMatic | 3 × ($1,000 + 6 months APIMatic Business) |
| Best Use of Bryntum | 3 × $1,000 |
| Best Use of Channel3 | $1,500 |
| Best Use of Render | $1,000 / $750 / $500 in credits |

**Stacking rule:** a project can win at most **one Grand Prize + one Sponsor Prize**, *or* **one Honorable Mention + one Sponsor Prize**. A project is considered for every sponsor prize whose tools it uses.

## Eligibility notes

- Entrants must be above the age of majority. Teams have no size limit and pick one Representative who submits.
- Excluded: residents of Brazil, Quebec, Russia, Crimea, Cuba, Iran, North Korea, and any country comprehensively sanctioned by OFAC. Also PayPal and Devpost staff and their families, judges, and judges' employers.
- **PayPal account availability varies by country.** If you can't create a PayPal or developer account where you live, the FAQ says to ask the PayPal team on Discord. Having an account is a separate question from hackathon eligibility.
- No prior financial or preferential support from PayPal or Devpost for the project.
- Winners must complete an affidavit plus tax forms (W-8BEN for non-US residents).

## Sponsor tools (all optional)

| Sponsor | What it is | Access | Prize hook |
|---|---|---|---|
| **AG Grid** | AG Studio: embedded self-serve dashboards with the Studio Agent Framework (custom agents and tools, swappable harness, your own LLM) | 45-day trial, no key needed for judging. Boilerplate: github.com/paypaldev/hackathon-paypal-ag-grid-boilerplate | Polish counts: custom widgets, theming, layout, custom agents talking to Studio's agents |
| **APIMatic** | Context Plugin that gives coding agents PayPal API context (TS, Python, Java, Ruby, PHP, C#) | Free, PayPal preconfigured. Install via the resource page | **Just use it while building** and answer the form question. 1 month free Basic for everyone who does |
| **Bryntum** | Gantt, Scheduler and Calendar components | 45-day trial (`npm install @bryntum/scheduler@npm:@bryntum/scheduler-trial`) | Timelines driven by payment events; an agent that drives the schedule |
| **Channel3** | One API and MCP server for 100M+ products from 25k+ retailers (prices, variants, availability, buy links) | trychannel3.com/developers. Promo **PAYPAL-HACKATHON-2026** gives 20k credits | Must call the API or MCP as a meaningful part of the product |
| **Render** | Hosting plus **Render Workflows** for orchestrating agents and background jobs | $50 credits: credits-portal-mmdm.onrender.com/claim/paypal-ai-hackathon | Deploy on Render, ideally using Workflows |
| **Elastic** | Elasticsearch, vector and hybrid search, Agent Builder, Workflows, ES\|QL, MCP/A2A | 14-day trial (+30 days on request) or run locally | No cash prize |
| **KERNEL** | Cloud browsers for agents (anti-bot, persistent auth, live view and replay) | $50 credits: dashboard.onkernel.com/hackathon?code=KERNELDEVPOST2026 | No cash prize |
| **Astropods** | Agent OS: declarative agent spec, CLI deploy, observability, guardrails | Free account | No cash prize |
| **Postman** | API platform. PayPal collections at postman.com/paypal, including an agentic commerce workspace | Free | No cash prize |
| **Zapier** | Zapier MCP: agents act across 9,000+ apps, PayPal included | 14-day Pro trial | No cash prize |

## Official PayPal resources

- Developer docs: https://developer.paypal.com · Dashboard: https://developer.paypal.com/dashboard/
- REST API: https://developer.paypal.com/api/rest/ · JS SDK v6: https://developer.paypal.com/sdk/js/
- Checkout, Payments, Pay Later, Subscriptions, Invoicing, Payouts, Disputes, Donations, Webhooks, Payment Links & Buttons (low-code). All are linked from the Devpost Resources page.
- AI: https://docs.paypal.ai · Agent Toolkit quickstart · MCP server quickstart · Agent tools reference
- AI Toolkit (coding-agent plugin): https://github.com/paypal/AI-Toolkit. Claude Code install: `/plugin install paypal@claude-plugins-official`
- Sandbox getting started: https://github.com/paypaldev/getting-started-with-paypal-sandbox
- Example integrations: https://github.com/paypal-examples/docs-examples
- Postman: https://www.postman.com/paypal
- Discord (help, team-finding, sponsor channels): https://discord.gg/sJ2G6DyvSK

## PayPal's own inspiration list (assume many entrants build these)

- **Agents:** shopping agent that checks out for you; assistant that pays contractors when a job is marked complete; agent-to-agent negotiation and settlement.
- **Money movement:** send by phone number; freelancer income dashboard; instant gig payouts; receipt-scan bill splitting; split one donation across causes.
- **Business:** multi-currency freelancer invoicing; creator tipping and memberships; marketplace split payments; small-merchant POS add-on.
- **Consumer:** auto-categorized budgeting; request-money inside chat; simpler checkout for students, families or seniors.
- **Social impact:** accessible donation platform; microloans for the underbanked; recurring nonprofit payouts to field partners; neighbourhood money pools (solar co-op, cleanup fund).

AG Grid and Bryntum publish their own idea lists too (nudge-bot for unpaid invoices, anomaly alerts, dispute triage board, payment-gated rental calendar). Expect duplicates of all of these. Our project, [SureSend](PROJECT.md), was chosen to stand apart from them.
