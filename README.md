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

Custom workflows can connect one or more agents in a linear sequence. Workflow output is intentionally labeled **Unverified** unless a future workflow adds an explicit evidence-validation stage.

### Agent diagnostics

Use `@AgentName: question` to ask an agent about its role, configuration, or previous output. Diagnostic answers are not independently validated.

## Claim-level verification

The validator no longer checks the final answer as one undifferentiated block. It performs this pipeline:

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
| `supported` | Reliable source metadata directly supports the complete claim. |
| `contradicted` | Reliable evidence materially rejects the claim and a correction is supplied. |
| `mixed` | Evidence conflicts or supports only part of the claim. |
| `not_found` | The claim is externally verifiable, but reliable attached evidence was not available. |
| `not_verifiable` | The statement is an opinion, recommendation, prediction, or lacks an external truth condition. |

A model-generated `SUPPORTED`, `CONTRADICTED`, or `MIXED` judgment with no attached external source metadata is automatically downgraded to `not_found`.

The verdict UI displays:

- every extracted claim and its importance;
- claim-specific status and rationale;
- a corrected version when applicable;
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

A source being returned does not by itself prove that the source is authoritative. Veritas associates evidence with claims and exposes the audit trail, but source-quality ranking remains a separate improvement area.

## Providers

Veritas currently supports:

- **Gemini** through `@google/genai`
- **OpenRouter** through its Chat Completions API

The default reasoning model is pinned to `gemini-3.6-flash` rather than a moving `latest` alias.

Provider keys are separate. A Gemini key is never used as an OpenRouter fallback, and vice versa. OpenRouter currently uses strict JSON Schema output, but its adapter does not yet implement Veritas web-search grounding. Claim validation is therefore skipped and clearly marked when OpenRouter is selected.

## API-key security

This repository is currently a client-only BYOK application. Keys entered in the configuration editor are stored in the current browser profile's `localStorage`.

- Do not use this mode on shared or untrusted devices.
- Do not place provider keys in Vite environment variables for a hosted build.
- Production deployments should move provider calls and keys to a server-side API or backend-for-frontend.
- Use the **Forget** action in the configuration editor to remove a saved key.

## Reliability safeguards

The correctness and claim-verification foundation includes:

- runtime validation for every model response;
- rejection of malformed or truncated JSON instead of heuristic “healing”;
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

## Evaluation harness

The repository contains a provider-neutral evaluation harness under `features/reasoning/evaluation/`.

The baseline dataset currently covers:

- stable facts;
- time-sensitive facts;
- citation-required questions;
- false-premise rejection;
- ambiguous questions;
- insufficient-evidence cases;
- conflicting or overbroad claims;
- Arabic multilingual behavior.

It can compare three execution modes:

- `single`
- `debate`
- `verified`

Recorded observations are scored on applicable checks such as:

- answer terms and forbidden assertions;
- acceptable evidence status;
- claim count;
- citation coverage;
- independent source domains;
- source-backed claim presence;
- latency, request count, and estimated cost.

The summary reports pass rate, average score, latency, requests, claim support rate, citation coverage, and results by mode.

### Score recorded observations

```bash
npm run evaluate -- path/to/evaluation-observations.json
```

The input must be a JSON array shaped like:

```json
[
  {
    "caseId": "stable-gold-symbol",
    "mode": "verified",
    "outcome": {
      "status": "verified",
      "answer": "The chemical symbol for gold is Au.",
      "mode": "standard",
      "consensusReached": true,
      "validatorRan": true,
      "verificationStatus": "CONFIRMED",
      "isConclusive": true,
      "roundsExecuted": 1,
      "warnings": [],
      "sources": [],
      "claims": [],
      "claimSummary": {
        "totalClaims": 1,
        "verifiableClaims": 1,
        "supportedClaims": 1,
        "contradictedClaims": 0,
        "mixedClaims": 0,
        "notFoundClaims": 0,
        "notVerifiableClaims": 0,
        "claimsWithSources": 1,
        "citationCoverage": 100,
        "supportCoverage": 100,
        "independentDomains": 1
      },
      "provider": "gemini",
      "model": "gemini-3.6-flash"
    },
    "latencyMs": 1200,
    "requestCount": 6,
    "estimatedCostUsd": 0.01
  }
]
```

The harness is intentionally decoupled from a provider. A browser or server runner can call `runEvaluationSuite()` with an executor and persist the returned observations for repeatable comparisons.

## Cost and latency note

The `VERIFIED` pipeline may perform:

- one claim-extraction request;
- up to six claim-specific search requests;
- one synthesis request when claims require correction or qualification.

This improves evidence attribution but can increase latency and provider usage. The evaluation harness records request count, latency, and estimated cost so quality gains can be compared against their operational cost.

## Tech stack

- React 19
- TypeScript
- Vite
- Tailwind CSS runtime configuration
- `@google/genai`
- Browser Web Speech and Web Audio APIs

## Getting started

### 1. Install dependencies

Node.js 20 or newer is recommended for the current SDK dependency tree.

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
```

The regression suite verifies configuration flexibility, provider-key isolation, malformed-response rejection, safe source handling, abortable retries, complete revision context, claim response validation, deterministic coverage calculations, claim-specific evidence status, prompt-injection boundaries, truthful verdict transitions, and evaluation scoring.

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
│   ├── claimValidationService.ts per-claim external verification orchestration
│   ├── claimVerification.ts deterministic claim metrics and outcome helpers
│   ├── *Core.ts         provider adapters
│   ├── prompts.ts       role and task instructions
│   ├── schemas.ts       structured-output schemas
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
- The evaluation harness can run through a supplied executor, but a first-party live browser evaluation dashboard is not yet included.
- Tailwind is still loaded at runtime; a compiled Tailwind build is planned for a later performance-focused change.

## Keyboard shortcuts

- `Enter`: execute
- `Shift+Enter`: insert a new line
- `Ctrl/Cmd + K`: clear context
- `Ctrl/Cmd + E`: export the transcript
- `Ctrl + Up/Down`: navigate command history
