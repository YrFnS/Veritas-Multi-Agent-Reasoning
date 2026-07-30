import type { JsonSchema } from '../types.js';

const Type = {
  OBJECT: 'object',
  ARRAY: 'array',
  STRING: 'string',
  NUMBER: 'number',
  INTEGER: 'integer',
  BOOLEAN: 'boolean',
  NULL: 'null',
} as const;

export const ANALYST_SCHEMA: JsonSchema = {
  type: Type.OBJECT,
  properties: {
    evidence_summary: {
      type: Type.STRING,
      description:
        'Concise evidence and uncertainty summary; never hidden chain-of-thought.',
    },
    factual_answer: {
      type: Type.STRING,
      description: 'The proposed answer.',
    },
    confidence: {
      type: Type.NUMBER,
      description: 'Uncalibrated model confidence from 0 to 100.',
    },
  },
  required: ['evidence_summary', 'factual_answer', 'confidence'],
  additionalProperties: false,
};

export const SKEPTIC_SCHEMA: JsonSchema = {
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
  additionalProperties: false,
};

export const JUDGE_SCHEMA: JsonSchema = {
  type: Type.OBJECT,
  properties: {
    debate_summary: {
      type: Type.STRING,
      description: 'Brief recap of the debate.',
    },
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
  additionalProperties: false,
};

export const VALIDATOR_SCHEMA: JsonSchema = {
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
  additionalProperties: false,
};

export const CLAIM_EXTRACTION_SCHEMA: JsonSchema = {
  type: Type.OBJECT,
  properties: {
    claims: {
      type: Type.ARRAY,
      description: 'At most six atomic material claims from the proposed answer.',
      maxItems: 6,
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: 'Stable identifier such as C1, C2, or C3.',
          },
          text: {
            type: Type.STRING,
            description:
              'One atomic factual claim that can be checked independently.',
          },
          importance: {
            type: Type.STRING,
            enum: ['primary', 'supporting'],
          },
          verifiable: {
            type: Type.BOOLEAN,
            description:
              'False for opinions, advice, or claims that cannot be externally checked.',
          },
        },
        required: ['id', 'text', 'importance', 'verifiable'],
        additionalProperties: false,
      },
    },
  },
  required: ['claims'],
  additionalProperties: false,
};

export const CLAIM_VERIFICATION_SCHEMA: JsonSchema = {
  type: Type.OBJECT,
  properties: {
    status: {
      type: Type.STRING,
      enum: [
        'SUPPORTED',
        'CONTRADICTED',
        'MIXED',
        'NOT_FOUND',
        'NOT_VERIFIABLE',
      ],
    },
    rationale: {
      type: Type.STRING,
      description: 'Concise evidence-based explanation for the status.',
    },
    corrected_claim: {
      type: Type.STRING,
      description:
        'Corrected atomic claim when contradicted; otherwise an empty string.',
    },
  },
  required: ['status', 'rationale', 'corrected_claim'],
  additionalProperties: false,
};

export const CLAIM_SYNTHESIS_SCHEMA: JsonSchema = {
  type: Type.OBJECT,
  properties: {
    reasoning: {
      type: Type.STRING,
      description: 'Brief account of supported, corrected, and unresolved claims.',
    },
    final_output: {
      type: Type.STRING,
      description:
        'Rewritten user-facing answer aligned with the claim verification report.',
    },
  },
  required: ['reasoning', 'final_output'],
  additionalProperties: false,
};

export const GENERIC_STEP_SCHEMA: JsonSchema = {
  type: Type.OBJECT,
  properties: {
    work_summary: {
      type: Type.STRING,
      description:
        'Concise summary of work performed; never hidden chain-of-thought.',
    },
    output: { type: Type.STRING, description: 'Result of this workflow step.' },
  },
  required: ['work_summary', 'output'],
  additionalProperties: false,
};

export const INSPECTION_SCHEMA: JsonSchema = {
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
  additionalProperties: false,
};
