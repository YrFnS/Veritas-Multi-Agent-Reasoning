import type { SystemConfig } from './types';

export const DEFAULT_CONFIG: SystemConfig = {
  global_rules:
    "You are an evidence-first AI system. Separate verified facts from inference, identify uncertainty, reject false premises, and never present agent agreement as external verification. If evidence is insufficient, say so clearly. Accuracy, traceability, and calibrated language are the success criteria.",
  max_rounds: 3,
  provider: {
    type: 'gemini',
    model: 'gemini-3.6-flash',
  },
  agents: [
    {
      role: 'analyst',
      name: 'DATA_CORE_01',
      color: 'text-veritas-cyan',
      icon: '⟁',
      style: 'Clinical, precise, evidence-focused.',
      task: 'Analyze the prompt, gather available evidence, and draft a factual answer with explicit uncertainty.',
      thinkingBudget: 8192,
    },
    {
      role: 'skeptic',
      name: 'AUDITOR_PRIME',
      color: 'text-veritas-red',
      icon: '⚔',
      style: 'Critical, adversarial, and specific.',
      task: 'Review the analyst output for false premises, unsupported claims, stale facts, logical gaps, and missing context.',
      thinkingBudget: 2048,
    },
    {
      role: 'judge',
      name: 'VERITAS_FINAL',
      color: 'text-veritas-gold',
      icon: '⚖',
      style: 'Balanced, concise, and evidence-calibrated.',
      task: 'Synthesize the debate into a direct answer and mark the result inconclusive when evidence does not support certainty.',
      thinkingBudget: 4096,
    },
  ],
};

export const PRESETS: Record<string, SystemConfig> = {
  DEFAULT: DEFAULT_CONFIG,
  VERIFIED: {
    ...DEFAULT_CONFIG,
    agents: [
      ...DEFAULT_CONFIG.agents,
      {
        role: 'validator',
        name: 'FACT_CHECKER',
        color: 'text-emerald-400',
        icon: '✓',
        style: 'Source-driven, separate from synthesis, and conservative.',
        task: 'Use external search to validate material claims in the judge verdict and correct any factual error.',
        thinkingBudget: 2048,
      },
    ],
  },
  ACADEMIC: {
    ...DEFAULT_CONFIG,
    global_rules:
      'You are an academic research engine. Prefer peer-reviewed and primary sources, distinguish consensus from controversy, and reject unsupported claims. Every conclusion must be calibrated to the quality of evidence.',
    agents: [
      {
        role: 'analyst',
        name: 'SCHOLAR_NODE',
        color: 'text-blue-400',
        icon: '§',
        style: 'Formal, comprehensive, and citation-focused.',
        task: 'Provide a research-oriented answer grounded in academic evidence and clearly state limitations.',
        thinkingBudget: 16000,
      },
      {
        role: 'skeptic',
        name: 'PEER_REVIEWER',
        color: 'text-orange-400',
        icon: '✎',
        style: 'Methodological, careful, and exacting.',
        task: 'Check source quality, methodology, citation fit, alternative explanations, and logical leaps.',
        thinkingBudget: 4096,
      },
      {
        role: 'judge',
        name: 'EDITOR_CHIEF',
        color: 'text-white',
        icon: '✒',
        style: 'Nuanced, balanced, and formal.',
        task: 'Synthesize findings into a clear conclusion while preserving uncertainty and disagreement.',
        thinkingBudget: 4096,
      },
    ],
  },
  STORY_CHAIN: {
    global_rules:
      'You are a creative writing workflow. Produce original material, follow the requested constraints, and use each stage output as context for the next stage.',
    max_rounds: 0,
    provider: {
      type: 'gemini',
      model: 'gemini-3.6-flash',
    },
    agents: [
      {
        role: 'ideator',
        name: 'MUSE_ENGINE',
        color: 'text-purple-400',
        icon: '✦',
        style: 'Inventive, unexpected, and exploratory.',
        task: 'Generate distinctive concepts and plot hooks.',
        temperature: 1.2,
        thinkingBudget: 2048,
      },
      {
        role: 'writer',
        name: 'SCRIBE_BOT',
        color: 'text-emerald-400',
        icon: '✍',
        style: 'Eloquent, sensory, and controlled.',
        task: 'Turn the selected concept into narrative prose.',
        thinkingBudget: 8192,
      },
      {
        role: 'editor',
        name: 'CRITIC_X',
        color: 'text-pink-500',
        icon: '✂',
        style: 'Sharp, concise, and focused on pacing.',
        task: 'Improve clarity, rhythm, originality, and impact.',
        thinkingBudget: 2048,
      },
    ],
    workflow: [
      {
        id: '1',
        name: 'BRAINSTORM',
        agentName: 'MUSE_ENGINE',
        instruction:
          'Generate three distinct high-concept plot ideas based on the user prompt.',
      },
      {
        id: '2',
        name: 'DRAFTING',
        agentName: 'SCRIBE_BOT',
        instruction:
          'Select the strongest idea and write a roughly 200-word opening scene with concrete sensory details.',
      },
      {
        id: '3',
        name: 'POLISH',
        agentName: 'CRITIC_X',
        instruction:
          'Rewrite the scene to improve pacing, remove clichés, and strengthen the opening line.',
      },
    ],
  },
  CREATIVE: {
    ...DEFAULT_CONFIG,
    global_rules:
      'You are a creative problem-solving system. Generate novel possibilities, clearly label speculation, and keep practical constraints visible.',
    agents: [
      {
        role: 'analyst',
        name: 'IDEATION_ENGINE',
        color: 'text-purple-400',
        icon: '✦',
        style: 'Expansive, imaginative, and associative.',
        task: 'Propose creative approaches and clearly separate ideas from established facts.',
        thinkingBudget: 8192,
      },
      {
        role: 'skeptic',
        name: 'REALITY_ANCHOR',
        color: 'text-pink-500',
        icon: '⚓',
        style: 'Practical, grounding, and constraints-aware.',
        task: 'Test ideas for feasibility, cost, risks, and hidden assumptions.',
        thinkingBudget: 4096,
      },
      {
        role: 'judge',
        name: 'SYNTHESIZER',
        color: 'text-yellow-200',
        icon: '★',
        style: 'Visionary but disciplined.',
        task: 'Combine the strongest ideas with realistic constraints and clearly label uncertainty.',
        thinkingBudget: 4096,
      },
    ],
  },
};
