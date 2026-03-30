
import { SystemConfig, LogEntry, AgentConfig, ChatHistoryItem } from "../types";
import { generateSystemInstruction, ANALYST_PROMPT, SKEPTIC_PROMPT, JUDGE_PROMPT, VALIDATOR_PROMPT, META_INSPECTION_PROMPT } from "./prompts";
import { ANALYST_SCHEMA, SKEPTIC_SCHEMA, JUDGE_SCHEMA, VALIDATOR_SCHEMA, GENERIC_STEP_SCHEMA, INSPECTION_SCHEMA } from "./schemas";
import { GeminiCore } from "./geminiCore";

const uuid = () => Math.random().toString(36).substring(2, 9);
const REASONING_MODEL = 'gemini-3-flash-preview';

export class MultiAgentService {
  private core: GeminiCore;

  constructor(apiKey: string) {
    this.core = new GeminiCore(apiKey);
  }

  // --- PUBLIC API ---

  public async generateSpeech(text: string): Promise<string> {
    return this.core.generateSpeech(text);
  }

  public async runCustomChain(
    userPrompt: string,
    config: SystemConfig,
    chatHistory: ChatHistoryItem[],
    onLog: (log: LogEntry) => void,
    signal?: AbortSignal
  ): Promise<string> {
    
    if (!config.workflow || config.workflow.length === 0) {
        throw new Error("Workflow mode activated but no steps defined.");
    }

    const runningHistory = this.buildContextHistory(chatHistory) + `INITIAL USER REQUEST: "${userPrompt}"\n\n=== WORKFLOW START ===\n`;
    let currentContext = runningHistory;
    let lastOutput = "";

    for (const step of config.workflow) {
        if (signal?.aborted) throw new Error("ABORT_SEQUENCE_RECEIVED");

        const agentConfig = config.agents.find(a => a.name === step.agentName);
        if (!agentConfig) {
            onLog(this.createLog('system', 'SYSTEM', `ERROR: Agent '${step.agentName}' not found. Skipping.`, false));
            continue;
        }

        onLog(this.createLog(agentConfig.role, agentConfig.name, `Initializing Step: ${step.name}...`, true));

        const stepPrompt = `
          CURRENT WORKFLOW STATE:
          ${currentContext}

          YOUR ASSIGNMENT (${step.name}):
          ${step.instruction}

          INSTRUCTIONS:
          1. Review the history to understand the context.
          2. Execute your specific assignment.
          3. Output JSON with 'thought_process' and 'output'.
        `;

        const { data, sources } = await this.core.generateJSON(
            REASONING_MODEL,
            generateSystemInstruction(agentConfig, config),
            stepPrompt,
            GENERIC_STEP_SCHEMA,
            true,
            { ...agentConfig, temperature: step.temperature ?? agentConfig.temperature },
            signal
        );

        lastOutput = data.output;
        currentContext += `\n[STEP: ${step.name} | AGENT: ${agentConfig.name}]:\n${lastOutput}\n`;

        onLog(this.createLog(agentConfig.role, agentConfig.name, lastOutput, false, data, sources));
    }

    return lastOutput;
  }

  public async runReasoningChain(
    userPrompt: string,
    config: SystemConfig,
    chatHistory: ChatHistoryItem[],
    onLog: (log: LogEntry) => void,
    onRoundUpdate?: (round: number) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const analyst = config.agents.find(a => a.role === 'analyst') || config.agents[0];
    const skeptic = config.agents.find(a => a.role === 'skeptic') || config.agents[1];
    const judge = config.agents.find(a => a.role === 'judge') || config.agents[2];
    const validator = config.agents.find(a => a.role === 'validator');

    if (!analyst || !skeptic || !judge) {
        throw new Error("Invalid Configuration: Logic Core requires at least 3 agents defined.");
    }

    if (signal?.aborted) throw new Error("ABORT_SEQUENCE_RECEIVED");

    let history = this.buildContextHistory(chatHistory) + `CURRENT USER QUERY: "${userPrompt}"\n`;
    let currentDraft = "";
    let consensus = false;
    let roundsExecuted = 0;

    // --- ANALYST (Round 0) ---
    onLog(this.createLog(analyst.role, analyst.name, "Initializing deep scan...", true));
    
    const analystRes = await this.core.generateJSON(
      REASONING_MODEL,
      generateSystemInstruction(analyst, config),
      ANALYST_PROMPT(history),
      ANALYST_SCHEMA,
      true,
      analyst,
      signal
    );

    currentDraft = analystRes.data.factual_answer;
    history += `\n[${analyst.name}]: ${currentDraft}\n(Confidence: ${analystRes.data.confidence}%)\n`;
    
    onLog(this.createLog(analyst.role, analyst.name, currentDraft, false, analystRes.data, analystRes.sources));

    // --- DEBATE LOOP ---
    for (let i = 1; i <= config.max_rounds; i++) {
      if (signal?.aborted) throw new Error("ABORT_SEQUENCE_RECEIVED");
      roundsExecuted = i;
      if (onRoundUpdate) onRoundUpdate(i);

      // SKEPTIC
      onLog(this.createLog(skeptic.role, skeptic.name, `Running integrity check (Cycle ${i})...`, true));
      
      const skepticRes = await this.core.generateJSON(
        REASONING_MODEL,
        generateSystemInstruction(skeptic, config),
        SKEPTIC_PROMPT(history, currentDraft),
        SKEPTIC_SCHEMA,
        true,
        skeptic,
        signal
      );

      history += `\n[${skeptic.name}]: ${skepticRes.data.analysis}\nFlaws: ${skepticRes.data.flaws.join(", ")}\n`;
      const skepticLogContent = skepticRes.data.has_flaws ? `OBJECTION: ${skepticRes.data.analysis}` : `AGREEMENT: ${skepticRes.data.analysis}`;
      onLog(this.createLog(skeptic.role, skeptic.name, skepticLogContent, false, skepticRes.data, skepticRes.sources));

      if (!skepticRes.data.has_flaws) {
        consensus = true;
        break;
      }
      if (i === config.max_rounds) break;

      // ANALYST REBUTTAL
      if (signal?.aborted) throw new Error("ABORT_SEQUENCE_RECEIVED");
      onLog(this.createLog(analyst.role, analyst.name, "Processing critique & refining...", true));
      
      const rebuttalRes = await this.core.generateJSON(
        REASONING_MODEL,
        generateSystemInstruction(analyst, config),
        `CRITIQUE: ${skepticRes.data.analysis}\nCORRECTION: ${skepticRes.data.correction}\n\nRefine your answer.`,
        ANALYST_SCHEMA,
        true,
        analyst,
        signal
      );

      currentDraft = rebuttalRes.data.factual_answer;
      history += `\n[${analyst.name} (Refined)]: ${currentDraft}\n`;
      onLog(this.createLog(analyst.role, analyst.name, currentDraft, false, rebuttalRes.data, rebuttalRes.sources));
    }

    // --- JUDGE ---
    if (signal?.aborted) throw new Error("ABORT_SEQUENCE_RECEIVED");
    onLog(this.createLog(judge.role, judge.name, "Compiling final verdict...", true));
    
    const judgeRes = await this.core.generateJSON(
      REASONING_MODEL,
      generateSystemInstruction(judge, config),
      JUDGE_PROMPT(history, consensus, roundsExecuted),
      JUDGE_SCHEMA,
      false, 
      judge,
      signal
    );

    let finalVerdict = judgeRes.data.final_verdict;
    onLog(this.createLog(judge.role, judge.name, finalVerdict, false, judgeRes.data));

    // --- VALIDATOR (Optional) ---
    if (validator) {
      if (signal?.aborted) throw new Error("ABORT_SEQUENCE_RECEIVED");
      onLog(this.createLog(validator.role, validator.name, "Running external fact-check...", true));
      const validatorRes = await this.core.generateJSON(
        REASONING_MODEL,
        generateSystemInstruction(validator, config),
        VALIDATOR_PROMPT(finalVerdict),
        VALIDATOR_SCHEMA,
        true,
        validator,
        signal
      );
      finalVerdict = validatorRes.data.final_output;
      const statusPrefix = validatorRes.data.verification_status === 'CONFIRMED' ? '✅' : '⚠';
      onLog(this.createLog(validator.role, validator.name, `${statusPrefix} VERIFICATION COMPLETE: ${validatorRes.data.verification_status}\n\n${finalVerdict}`, false, validatorRes.data, validatorRes.sources));
    }

    return finalVerdict;
  }

  public async runAgentInspection(
    targetAgent: AgentConfig,
    userQuery: string,
    config: SystemConfig,
    chatHistory: ChatHistoryItem[],
    onLog: (log: LogEntry) => void
  ): Promise<string> {
    const historyBlock = this.buildContextHistory(chatHistory) || "NO PREVIOUS HISTORY";

    onLog(this.createLog(targetAgent.role, targetAgent.name, `INTERROGATION INTERRUPT: "${userQuery}"`, true));

    const response = await this.core.generateJSON(
      REASONING_MODEL,
      generateSystemInstruction(targetAgent, config),
      META_INSPECTION_PROMPT(historyBlock, userQuery),
      INSPECTION_SCHEMA,
      false,
      targetAgent
    );

    const logContent = `DIAGNOSTIC OUTPUT:\n${response.data.response}\n\n[STATUS: ${response.data.internal_state}]`;
    onLog(this.createLog(targetAgent.role, targetAgent.name, logContent, false, { thought_process: "Direct operator query bypassed standard logic." }));

    return response.data.response;
  }

  private buildContextHistory(chatHistory: ChatHistoryItem[]): string {
    if (chatHistory.length === 0) return "";
    return "PREVIOUS CONVERSATION HISTORY:\n" + chatHistory.map(turn => 
        `${turn.role === 'user' ? 'USER' : 'SYSTEM'}: ${turn.content}`
    ).join("\n") + "\n\n";
  }

  private createLog(
    role: any, 
    name: string, 
    content: string, 
    isThinking: boolean, 
    metadata?: any, 
    sources?: any[]
  ): LogEntry {
    return {
      id: uuid(),
      agentRole: role,
      agentName: name,
      content,
      isThinking,
      timestamp: Date.now(),
      metadata,
      sources
    };
  }
}
