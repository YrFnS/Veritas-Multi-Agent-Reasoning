export interface AgentConfig {
  role: string;
  name: string;
  color: string;
  style: string;
  task: string;
  icon: string;
  temperature?: number;
  topK?: number;
  topP?: number;
  thinkingBudget?: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  agentName: string;
  instruction: string;
  temperature?: number;
}

export type ProviderType = 'gemini' | 'openrouter';

export interface ProviderConfig {
  type: ProviderType;
  model: string;
}

export interface ProviderCapabilities {
  structuredOutput: boolean;
  strictJsonSchema: boolean;
  webSearch: boolean;
  citations: boolean;
  speech: boolean;
}

export interface SystemConfig {
  global_rules: string;
  max_rounds: number;
  agents: AgentConfig[];
  workflow?: WorkflowStep[];
  provider: ProviderConfig;
}

export interface SourceMetadata {
  web?: {
    uri: string;
    title: string;
  };
}

export interface AnalystResponse {
  evidence_summary: string;
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

export type VerificationStatus =
  | 'CONFIRMED'
  | 'CORRECTED'
  | 'UNVERIFIED'
  | null;

export interface ValidatorResponse {
  verification_status: Exclude<VerificationStatus, null>;
  reasoning: string;
  final_output: string;
}

export type ClaimImportance = 'primary' | 'supporting';

export interface ExtractedClaim {
  id: string;
  text: string;
  importance: ClaimImportance;
  verifiable: boolean;
}

export interface ClaimExtractionResponse {
  claims: ExtractedClaim[];
}

export type RawClaimVerificationStatus =
  | 'SUPPORTED'
  | 'CONTRADICTED'
  | 'MIXED'
  | 'NOT_FOUND'
  | 'NOT_VERIFIABLE';

export interface ClaimVerificationResponse {
  status: RawClaimVerificationStatus;
  rationale: string;
  corrected_claim: string;
}

export type ClaimVerificationStatus =
  | 'supported'
  | 'contradicted'
  | 'mixed'
  | 'not_found'
  | 'not_verifiable';

export interface VerifiedClaim {
  id: string;
  text: string;
  importance: ClaimImportance;
  status: ClaimVerificationStatus;
  rationale: string;
  correctedText?: string;
  sources: SourceMetadata[];
}

export interface ClaimVerificationSummary {
  totalClaims: number;
  verifiableClaims: number;
  supportedClaims: number;
  contradictedClaims: number;
  mixedClaims: number;
  notFoundClaims: number;
  notVerifiableClaims: number;
  claimsWithSources: number;
  citationCoverage: number;
  supportCoverage: number;
  independentDomains: number;
}

export interface ClaimSynthesisResponse {
  reasoning: string;
  final_output: string;
}

export interface GenericAgentResponse {
  work_summary: string;
  output: string;
  meta_data?: Record<string, unknown>;
}

export interface InspectionResponse {
  response: string;
  internal_state: string;
}

export type ReasoningMode = 'standard' | 'workflow' | 'interrogation';

export type ReasoningStatus =
  | 'verified'
  | 'corrected'
  | 'unverified'
  | 'disputed'
  | 'insufficient_evidence';

export interface ReasoningOutcome {
  status: ReasoningStatus;
  answer: string;
  mode: ReasoningMode;
  consensusReached: boolean;
  validatorRan: boolean;
  verificationStatus: VerificationStatus;
  isConclusive: boolean;
  roundsExecuted: number;
  warnings: string[];
  sources: SourceMetadata[];
  claims: VerifiedClaim[];
  claimSummary: ClaimVerificationSummary;
  provider: ProviderType;
  model: string;
}

export type LogMetadata = Partial<
  AnalystResponse &
    SkepticResponse &
    JudgeResponse &
    ValidatorResponse &
    ClaimExtractionResponse &
    ClaimSynthesisResponse &
    GenericAgentResponse &
    InspectionResponse
> & {
  outcome?: ReasoningOutcome;
  verifiedClaims?: VerifiedClaim[];
  claimSummary?: ClaimVerificationSummary;
};

export interface LogEntry {
  id: string;
  agentRole: string;
  agentName: string;
  content: string;
  metadata?: LogMetadata;
  sources?: SourceMetadata[];
  timestamp: number;
  isThinking?: boolean;
}

export interface ChatHistoryItem {
  role: 'user' | 'model';
  content: string;
}

export interface ReasoningResult {
  outcome: ReasoningOutcome;
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
  CANCELLED = 'CANCELLED',
  ERROR = 'ERROR',
  INTERROGATION = 'INTERROGATION',
  WORKFLOW_RUNNING = 'NEURAL_CHAIN_ACTIVE',
}

export interface IReasoningCore {
  readonly capabilities: ProviderCapabilities;
  generateSpeech?(text: string): Promise<string>;
  generateJSON(
    model: string,
    systemPrompt: string,
    userPrompt: string,
    schema: any,
    useTools: boolean,
    configOverrides: Partial<AgentConfig>,
    signal?: AbortSignal
  ): Promise<{ data: unknown; sources?: SourceMetadata[] }>;
}
