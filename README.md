# VERITAS // MULTI-AGENT REASONING

Veritas is a browser-based multi-agent reasoning interface. It coordinates specialized agents that draft, challenge, synthesize, and optionally validate an answer while keeping the result's evidence status visible.

Veritas is designed to **reduce unsupported claims**, not to guarantee truth or eliminate hallucinations. A result is labeled **Verified** only when a validator runs with external search, reports confirmation, and returns usable source metadata. Internal agent agreement alone is labeled **Unverified**.

## Reasoning modes

### Standard debate

1. **Analyst** resolves the user's intent, gathers available evidence, and creates a draft.
2. **Skeptic** tests the draft for false premises, unsupported claims, stale facts, and logical gaps.
3. **Judge** synthesizes the debate and marks the answer inconclusive when the evidence is insufficient.
4. **Validator** is optional. In the `VERIFIED` preset it performs a separate source-backed check.

### Custom workflows

Custom workflows can connect one or more agents in a linear sequence. Workflow output is intentionally labeled **Unverified** unless a future workflow adds an explicit evidence-validation stage.

### Agent diagnostics

Use `@AgentName: question` to ask an agent about its role, configuration, or previous output. Diagnostic answers are not independently validated.

## Evidence statuses

| Status | Meaning |
|---|---|
| `verified` | A source-backed validator confirmed the answer and returned external source metadata. |
| `corrected` | A source-backed validator found a material problem, corrected it, and returned external source metadata. |
| `unverified` | The answer may have internal consensus, but source-backed validation did not complete or was inconclusive. |
| `disputed` | Material skeptic objections remained unresolved. |
| `insufficient_evidence` | The judge determined that the available evidence was not conclusive. |

The validator can explicitly return `UNVERIFIED` when evidence is missing, contradictory, or too weak. The verdict card shows consensus, validator execution, source-check status, source count, provider, model, warnings, and safe validation links. It never displays “Authenticity Verified” merely because agents agreed.

## Providers

Veritas currently supports:

- **Gemini** through `@google/genai`
- **OpenRouter** through its Chat Completions API

The default reasoning model is pinned to `gemini-3.6-flash` rather than a moving `latest` alias.

Provider keys are separate. A Gemini key is never used as an OpenRouter fallback, and vice versa. OpenRouter currently uses strict JSON Schema output, but its adapter does not yet implement Veritas web-search grounding. Validator runs are therefore skipped and clearly marked when OpenRouter is selected.

## API-key security

This repository is currently a client-only BYOK application. Keys entered in the configuration editor are stored in the current browser profile's `localStorage`.

- Do not use this mode on shared or untrusted devices.
- Do not place provider keys in Vite environment variables for a hosted build.
- Production deployments should move provider calls and keys to a server-side API or backend-for-frontend.
- Use the **Forget** action in the configuration editor to remove a saved key.

## Reliability safeguards

The correctness foundation includes:

- runtime validation for every model response;
- rejection of malformed or truncated JSON instead of heuristic “healing”;
- full original-query, draft, debate-history, critique, and correction context during analyst revisions;
- source metadata required at the outcome layer before a result can be labeled verified or corrected;
- safe `http`/`https` citation normalization and duplicate removal;
- variable-agent configuration validation with case-insensitive references;
- explicit cancellation state and abortable retry delays;
- provider capability checks and visible warnings;
- no hidden-chain-of-thought display—the UI presents concise evidence, debate, validation, or work summaries instead.

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

The regression suite verifies configuration flexibility, case-insensitive references, provider-key isolation, malformed-response rejection, safe source handling, abortable retries, full revision context, and truthful verdict transitions.

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
├── components/          agent, log, verdict, configuration, and control UI
├── hooks/               reasoning state, command history, voice, speech, and sound
├── services/
│   ├── geminiService.ts orchestration for debate, workflows, and diagnostics
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
- Source metadata proves that a source was returned, not automatically that every claim is supported; claim-level citation mapping is planned for the next verification phase.
- Tailwind is still loaded at runtime; a compiled Tailwind build is planned for a later performance-focused change.

## Keyboard shortcuts

- `Enter`: execute
- `Shift+Enter`: insert a new line
- `Ctrl/Cmd + K`: clear context
- `Ctrl/Cmd + E`: export the transcript
- `Ctrl + Up/Down`: navigate command history
