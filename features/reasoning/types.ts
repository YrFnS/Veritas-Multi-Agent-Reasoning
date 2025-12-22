export interface AgentConfig {
  role: string; // Changed from literal union to string to allow custom roles
  name: string;
  color: string;
  style: string;
  task: string;
  icon: string;
  // Optional Generation Overrides
  temperature?: number;
  topK?: number;
  topP?: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  agentName: string; // Must match an agent in the agents array
  instruction: string; // Specific prompt for this step
  temperature?: number; // Optional override for this specific step
}

export interface SystemConfig {
  global_rules: string;
  max_rounds: number;
  agents: AgentConfig[];
  workflow?: WorkflowStep[]; // If present, overrides the standard Analyst/Skeptic/Judge loop
}

export interface SourceMetadata {
  web?: {
    uri: string;
    title: string;
  };
}

export interface LogEntry {
  id: string;
  agentRole: string; // Generalized
  agentName: string;
  content: string; // The main text to display
  metadata?: any; // For structured data (reasoning, flaws, etc.)
  sources?: SourceMetadata[]; // For search grounding
  timestamp: number;
  isThinking?: boolean;
}

export interface ChatHistoryItem {
  role: 'user' | 'model';
  content: string;
}

export interface ReasoningResult {
  finalAnswer: string;
  logs: LogEntry[];
  success: boolean;
}

export enum ProcessState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  AUDITING = 'AUDITING',
  JUDGING = 'JUDGING',
  VALIDATING = 'VALIDATING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
  INTERROGATION = 'INTERROGATION',
  WORKFLOW_RUNNING = 'NEURAL_CHAIN_ACTIVE'
}

// Structured Response Types for Agents
export interface AnalystResponse {
  thought_process: string;
  factual_answer: string;
  confidence: number;
}

export interface SkepticResponse {
  analysis: string;
  has_flaws: boolean;
  flaws: string[];
  correction: string;
}

export interface JudgeResponse {
  debate_summary: string;
  final_verdict: string;
  is_conclusive: boolean;
}

export interface ValidatorResponse {
  verification_status: 'CONFIRMED' | 'CORRECTED';
  reasoning: string;
  final_output: string;
}

export interface GenericAgentResponse {
    thought_process: string;
    output: string;
    meta_data?: any;
}