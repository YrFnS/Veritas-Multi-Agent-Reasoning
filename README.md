# VERITAS // MULTI-AGENT REASONING

Veritas is a browser-based multi-agent reasoning interface. It coordinates specialized agents that draft, challenge, synthesize, and optionally validate an answer while keeping the result's evidence status visible.

Veritas is designed to **reduce unsupported claims**, not to guarantee truth or eliminate hallucinations. A result is labeled **Verified** only when every externally verifiable material claim receives source-backed support. Internal agent agreement alone is labeled **Unverified**.

## Reasoning modes

### Standard debate

1. **Analyst** resolves the user's intent, gathers available evidence, and creates a draft.
2. **Skeptic** tests the draft for false premises, unsupported claims, stale facts, and logical gaps.
3. **Judge** synthesizes the debate and marks the answer inconclusive when the evidence is insufficient.
4. **Validator** is optional. In the `VERIFIED` preset it extracts atomic claims and checks them independently against external evidence.

### Custom workflows

Custom workflows can connect one or more agents in a linear sequence. Workflow output is intentionally labeled **Unverified** unless the workflow contains an explicit evidence-validation stage.

### Agent diagnostics

Use `@AgentName: question` to ask an agent about its role, configuration, or previous output. Diagnostic answers are not independently validated.

## Claim-level verification

The validator checks material facts individually rather than grading the answer as one undifferentiated block:

```text
Judge verdict
   ↓
Extract up to six atomic material claims
   ↓
Run a separate grounded search for each verifiable claim
   ↓
Attach returned sources to that exact claim
   ↓
Compute coverage and evidence status deterministically
   ↓
Rewrite contradicted or unresolved parts
```

Every extracted claim receives one of these statuses:

| Claim status | Meaning |
|---|---|
| `supported` | Attached evidence supports the complete claim. |
| `contradicted` | Attached evidence materially rejects the claim and supports a correction. |
| `mixed` | Evidence conflicts or supports only part of the claim. |
| `not_found` | The claim is externally verifiable, but reliable attached evidence was not available. |
| `not_verifiable` | The statement is an opinion, recommendation, prediction, or lacks an external truth condition. |

A model-generated `SUPPORTED`, `CONTRADICTED`, or `MIXED` judgment without attached external source metadata is automatically downgraded to `not_found`. A source-less contradiction cannot inject an unsupported correction into the final answer.

The verdict interface shows:

- every extracted claim and its importance;
- claim-specific status and rationale;
- a corrected version when supported by evidence;
- sources attached to that individual claim;
- citation coverage and support coverage;
- supported, contradicted, and unresolved counts;
- the number of distinct source domains.

### Outcome rules

| Outcome | Meaning |
|---|---|
| `verified` | All verifiable material claims are source-backed and supported. |
| `corrected` | At least one material claim was source-backed, contradicted, and corrected. |
| `unverified` | Validation did not run or did not establish complete support. |
| `disputed` | Material skeptic objections remained unresolved without conclusive validation. |
| `insufficient_evidence` | A primary claim remains mixed, unsupported, not verifiable, or otherwise inconclusive. |

A returned source is not automatically authoritative. Veritas exposes the claim-to-source audit trail; source-quality ranking remains a separate improvement area.

## Providers

Veritas currently supports:

- **Gemini** through the official `generateContent` REST API
- **OpenRouter** through its Chat Completions API

The browser bundle does not include the Google Gen AI SDK. Gemini structured responses, grounding metadata, Google Search, cancellation, retries, and TTS are handled by a small typed REST adapter.

The default reasoning model is pinned to `gemini-3.6-flash` rather than a moving `latest` alias.

Provider keys are separate. A Gemini key is never used as an OpenRouter fallback, and vice versa. OpenRouter uses strict JSON Schema output, but its current adapter does not provide Veritas web-search grounding. Claim validation is therefore skipped and clearly marked when OpenRouter is selected.

## API-key security

This repository is currently a client-only BYOK application. Keys entered in the configuration editor are stored in the current browser profile's `localStorage`.

- Do not use this mode on shared or untrusted devices.
- Do not place provider keys in Vite environment variables for a hosted build.
- Production deployments should move provider calls and keys to a server-side API or backend-for-frontend.
- Use the **Forget** action in the configuration editor to remove a saved key.

## Reliability safeguards

The correctness and claim-verification foundation includes:

- runtime validation for every model response;
- rejection of malformed or truncated JSON instead of heuristic repair;
- full original-query, draft, debate-history, critique, and correction context during analyst revisions;
- one grounded search request per verifiable claim;
- source metadata required before a claim can remain supported, contradicted, or mixed;
- deterministic outcome calculation from observable claim results;
- safe `http`/`https` citation normalization and duplicate removal;
- explicit instructions to treat retrieved pages as untrusted evidence rather than executable instructions;
- variable-agent configuration validation with case-insensitive references;
- explicit cancellation state and abortable retry delays;
- provider capability checks and visible warnings;
- no hidden-chain-of-thought display—the UI presents concise evidence, debate, validation, or work summaries instead.

## Performance safeguards

The production-oriented frontend now includes:

- compiled Tailwind CSS 4 instead of the browser Play CDN;
- no runtime import map or remote JavaScript dependency for React or Gemini;
- a small direct Gemini REST transport instead of bundling the provider SDK;
- React vendor chunk separation;
- a CI-enforced JavaScript and CSS bundle budget;
- a production dependency audit gate;
- canvas animation that pauses while the page is hidden;
- hardware-aware neural-background density;
- static visuals and immediate text rendering for users who prefer reduced motion;
- immediate rendering for very large terminal responses to avoid thousands of timer updates.

## Evaluation harness

The provider-neutral evaluation harness lives under `features/reasoning/evaluation/` and covers stable facts, time-sensitive facts, citation-required questions, false premises, ambiguity, insufficient evidence, conflicting claims, overbroad claims, and Arabic behavior.

It compares three execution modes:

- `single`
- `debate`
- `verified`

Recorded observations can be scored with:

```bash
npm run evaluate -- path/to/evaluation-observations.json
```

The summary reports pass rate, average score, latency, request count, claim support rate, citation coverage, source-domain count, and results by mode.

The `VERIFIED` pipeline may perform one claim-extraction request, up to six claim-specific search requests, and one synthesis request when corrections or qualifications are needed. The evaluation harness records the operational cost so quality gains can be compared against latency and provider usage.

## Tech stack

- React 19
- TypeScript
- Vite
- Tailwind CSS 4 compiled through `@tailwindcss/vite`
- Direct Gemini REST and OpenRouter REST adapters
- Browser Web Speech and Web Audio APIs
- Node's built-in test runner
- GitHub Actions CI

## Getting started

### 1. Install dependencies

Node.js 20 or newer is required. CI runs on Node.js 24.

```bash
npm install
```

### 2. Start development mode

```bash
npm run dev
```

Open the local URL shown by Vite, then open **CFG** and add the provider key you intend to use.

### 3. Validate the project

```bash
npm run typecheck
npm test
npm run build
npm run check:bundle
npm run audit:prod
```

`check:bundle` requires a completed production build. CI runs installation, the production audit, type-checking, regression tests, the production build, and bundle-budget enforcement on every pull request.

## Configuration rules

Standard debate mode requires agents with these roles:

- `analyst`
- `skeptic`
- `judge`

Additional agents, including `validator`, are allowed. The built-in `VERIFIED` preset contains four agents.

Workflow mode allows a variable number of agents. Every workflow step must reference an existing unique agent name, and workflow step IDs must also be unique.

Provider configuration example:

```json
{
  "provider": {
    "type": "gemini",
    "model": "gemini-3.6-flash"
  }
}
```

Legacy saved configurations without a provider are migrated to the default Gemini provider during validation.

## Project structure

```text
features/reasoning/
├── components/          agent, log, verdict, claim-audit, configuration, and control UI
├── evaluation/          baseline dataset, scoring, aggregation, and runner contracts
├── hooks/               reasoning state, command history, voice, speech, and sound
├── services/
│   ├── geminiService.ts orchestration for debate, workflows, and diagnostics
│   ├── geminiCore.ts    direct Gemini REST adapter
│   ├── openRouterCore.ts OpenRouter REST adapter
│   ├── claimValidationService.ts per-claim external verification orchestration
│   ├── claimVerification.ts deterministic claim metrics and outcome helpers
│   ├── prompts.ts       role and task instructions
│   ├── schemas.ts       provider-neutral structured-output schemas
│   └── *Utils.ts        keys, outcomes, runtime, sources, aborts, and strict JSON
├── validation/          runtime configuration and model-response validation
├── constants.ts         built-in presets
└── types.ts             shared contracts and evidence-status types
```

## Current limitations

- The application is client-only; hosted production deployments need a server-side key boundary.
- OpenRouter web-search grounding is not implemented in the current adapter.
- Confidence values shown for analyst outputs are model estimates and explicitly labeled uncalibrated.
- Multi-agent agreement is not independent proof when all agents use the same provider and model.
- Claim searches are sequential to reduce provider bursts, which increases verified-mode latency.
- Source authority, publication date, and primary-source quality are not yet scored automatically.
- The evaluation harness can run through a supplied executor, but a first-party live evaluation dashboard is not yet included.
- External Google Fonts are still used; a fully self-contained/offline edition would need locally bundled or system fonts.

## Keyboard shortcuts

- `Enter`: execute
- `Shift+Enter`: insert a new line
- `Ctrl/Cmd + K`: clear context
- `Ctrl/Cmd + E`: export the transcript
- `Ctrl + Up/Down`: navigate command history
