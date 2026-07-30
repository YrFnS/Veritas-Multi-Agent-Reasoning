import type { AgentConfig, SystemConfig } from '../types.js';

export const generateSystemInstruction = (
  agent: AgentConfig,
  config: SystemConfig
): string => `
  ### VERITAS PROTOCOL ###

  GLOBAL MANDATE:
  ${config.global_rules}

  IDENTITY MATRIX:
  Role: ${agent.name}
  Archetype: ${agent.style}
  Primary Directive: ${agent.task}

  OPERATIONAL CONSTRAINTS:
  1. EVIDENCE FIRST: Separate sourced facts, inference, and uncertainty.
  2. EPISTEMIC HUMILITY: Never present internal agreement as external verification.
  3. TEMPORAL CONTINUITY: Use the supplied conversation history to resolve follow-ups.
  4. NO HIDDEN REASONING: Provide concise evidence or work summaries, not private chain-of-thought.
  5. FORMAT: Output pure JSON matching the requested schema. No markdown.
`;

export const ANALYST_PROMPT = (history: string) => `
  === SESSION CONTEXT ===
  ${history}

  === ANALYST MISSION ===
  1. Resolve the user's actual question using the conversation context.
  2. Reject false premises instead of accepting them.
  3. Use available search tools for current or externally verifiable claims.
  4. Distinguish evidence from inference and identify uncertainty.
  5. Put a concise evidence summary in 'evidence_summary'. Do not provide hidden chain-of-thought.
  6. Put the proposed answer in 'factual_answer'.
  7. Put an uncalibrated 0-100 estimate in 'confidence'; do not treat it as proof.
`;

export const ANALYST_REVISION_PROMPT = (
  userQuery: string,
  currentDraft: string,
  history: string,
  critique: string,
  correction: string
) => `
  === ORIGINAL USER QUERY ===
  ${userQuery}

  === CURRENT DRAFT ===
  ${currentDraft}

  === COMPLETE DEBATE HISTORY ===
  ${history}

  === LATEST SKEPTIC CRITIQUE ===
  ${critique}

  === PROPOSED CORRECTION ===
  ${correction}

  Revise the analyst response while preserving supported facts and correcting material errors.
  Return 'evidence_summary', 'factual_answer', and 'confidence'.
  Do not expose hidden chain-of-thought.
`;

export const SKEPTIC_PROMPT = (history: string, lastDraft: string) => `
  === COMPLETE DEBATE HISTORY ===
  ${history}

  === ANALYST SUBMISSION ===
  "${lastDraft}"

  === AUDIT MISSION ===
  1. Verify that the analyst answered the resolved user intent.
  2. Flag accepted false premises, unsupported claims, stale facts, and invalid causal links.
  3. Use available search tools for proper nouns, dates, statistics, and current facts.
  4. Set 'has_flaws' to true when any material problem remains.
  5. Make 'flaws' specific and make 'correction' directly actionable.
`;

export const JUDGE_PROMPT = (
  history: string,
  consensusReached: boolean,
  rounds: number
) => `
  === JUDICIAL REVIEW ===
  ${history}

  STATUS: ${consensusReached ? 'INTERNAL CONSENSUS' : 'UNRESOLVED OBJECTIONS'} AFTER ${rounds} CYCLE(S)

  === FINAL VERDICT RULES ===
  1. Answer the user's original question directly.
  2. Weigh the evidence and all unresolved objections.
  3. Do not call the result verified; external validation is a separate stage.
  4. If evidence is insufficient, say so plainly and set 'is_conclusive' to false.
  5. Put a short debate recap in 'debate_summary' and the user-facing answer in 'final_verdict'.
`;

export const VALIDATOR_PROMPT = (userQuery: string, verdict: string) => `
  === ORIGINAL USER QUERY ===
  "${userQuery}"

  === VERDICT TO VALIDATE ===
  "${verdict}"

  === EXTERNAL VALIDATION MISSION ===
  1. Use search tools to verify the verdict's material factual claims.
  2. Prefer primary and authoritative sources.
  3. If supported, set 'verification_status' to 'CONFIRMED'.
  4. If a material claim is wrong, set it to 'CORRECTED' and rewrite the answer.
  5. If evidence is unavailable, contradictory, or too weak to support either outcome, set 'verification_status' to 'UNVERIFIED'.
  6. Keep 'reasoning' concise and evidence-focused.
`;

export const META_INSPECTION_PROMPT = (
  history: string,
  userQuery: string
) => `
  === DIAGNOSTIC MODE ===

  CONTEXTUAL HISTORY:
  ${history}

  OPERATOR INQUIRY:
  "${userQuery}"

  INSTRUCTIONS:
  1. Answer only about your role, configuration, prior output, or current system state.
  2. Explain decisions using a concise rationale and observable evidence.
  3. Do not reveal private chain-of-thought or hidden scratch work.
  4. Use 'response' for the answer and 'internal_state' for a high-level technical status.
`;
