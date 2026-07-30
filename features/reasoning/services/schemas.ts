import { Type, Schema } from '@google/genai';

export const ANALYST_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    evidence_summary: {
      type: Type.STRING,
      description: 'Concise evidence and uncertainty summary; never hidden chain-of-thought.',
    },
    factual_answer: { type: Type.STRING, description: 'The proposed answer.' },
    confidence: {
      type: Type.NUMBER,
      description: 'Uncalibrated model confidence from 0 to 100.',
    },
  },
  required: ['evidence_summary', 'factual_answer', 'confidence'],
};

export const SKEPTIC_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    analysis: { type: Type.STRING, description: 'Critique of the input.' },
    has_flaws: { type: Type.BOOLEAN, description: 'True if errors exist.' },
    flaws: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Specific, actionable errors.',
    },
    correction: { type: Type.STRING, description: 'Proposed correction.' },
  },
  required: ['analysis', 'has_flaws', 'flaws', 'correction'],
};

export const JUDGE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    debate_summary: { type: Type.STRING, description: 'Brief recap of the debate.' },
    final_verdict: {
      type: Type.STRING,
      description: 'Evidence-calibrated answer for the user.',
    },
    is_conclusive: {
      type: Type.BOOLEAN,
      description: 'Whether the available evidence supports a conclusive answer.',
    },
  },
  required: ['debate_summary', 'final_verdict', 'is_conclusive'],
};

export const VALIDATOR_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    verification_status: {
      type: Type.STRING,
      enum: ['CONFIRMED', 'CORRECTED', 'UNVERIFIED'],
    },
    reasoning: {
      type: Type.STRING,
      description: 'Concise explanation tied to external evidence.',
    },
    final_output: {
      type: Type.STRING,
      description: 'Final answer after external validation.',
    },
  },
  required: ['verification_status', 'reasoning', 'final_output'],
};

export const GENERIC_STEP_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    work_summary: {
      type: Type.STRING,
      description: 'Concise summary of work performed; never hidden chain-of-thought.',
    },
    output: { type: Type.STRING, description: 'Result of this workflow step.' },
  },
  required: ['work_summary', 'output'],
};

export const INSPECTION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    response: {
      type: Type.STRING,
      description: 'Direct answer about the agent or system state.',
    },
    internal_state: {
      type: Type.STRING,
      description: 'High-level technical status without hidden reasoning.',
    },
  },
  required: ['response', 'internal_state'],
};
