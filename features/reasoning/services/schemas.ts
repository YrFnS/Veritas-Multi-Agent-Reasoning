import { Type, Schema } from "@google/genai";

export const ANALYST_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    thought_process: { type: Type.STRING, description: "Hidden reasoning steps" },
    factual_answer: { type: Type.STRING, description: "The proposed truth" },
    confidence: { type: Type.NUMBER, description: "0-100 certainty score" },
  },
  required: ["thought_process", "factual_answer", "confidence"],
};

export const SKEPTIC_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    analysis: { type: Type.STRING, description: "Critique of the input" },
    has_flaws: { type: Type.BOOLEAN, description: "True if errors exist" },
    flaws: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of specific errors" },
    correction: { type: Type.STRING, description: "Proposed fix" },
  },
  required: ["analysis", "has_flaws", "flaws", "correction"],
};

export const JUDGE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    debate_summary: { type: Type.STRING, description: "Brief recap of the argument" },
    final_verdict: { type: Type.STRING, description: "The absolute final answer for the user" },
    is_conclusive: { type: Type.BOOLEAN },
  },
  required: ["debate_summary", "final_verdict"],
};

export const VALIDATOR_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    verification_status: { type: Type.STRING, enum: ["CONFIRMED", "CORRECTED"] },
    reasoning: { type: Type.STRING, description: "Why was it confirmed or corrected?" },
    final_output: { type: Type.STRING, description: "The final text to display" }
  },
  required: ["verification_status", "reasoning", "final_output"]
};

export const GENERIC_STEP_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    thought_process: { type: Type.STRING, description: "Internal reasoning before generation" },
    output: { type: Type.STRING, description: "The result of the step task" },
    meta_data: { type: Type.OBJECT, description: "Any additional structured data required" }
  },
  required: ["thought_process", "output"]
};

export const INSPECTION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    response: { type: Type.STRING, description: "Direct answer to the operator's query about internal state" },
    internal_state: { type: Type.STRING, description: "Technical summary of current mode or logic vectors" }
  },
  required: ["response", "internal_state"]
};