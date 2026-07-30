import type {
  AgentConfig,
  ChatHistoryItem,
  LogEntry,
  ReasoningOutcome,
  SourceMetadata,
  SystemConfig,
  VerificationStatus,
} from '../types.js';
import {
  ANALYST_PROMPT,
  ANALYST_REVISION_PROMPT,
  JUDGE_PROMPT,
  META_INSPECTION_PROMPT,
  SKEPTIC_PROMPT,
  VALIDATOR_PROMPT,
  generateSystemInstruction,
} from './prompts.js';
import {
  ANALYST_SCHEMA,
  GENERIC_STEP_SCHEMA,
  INSPECTION_SCHEMA,
  JUDGE_SCHEMA,
  SKEPTIC_SCHEMA,
  VALIDATOR_SCHEMA,
} from './schemas.js';
import {
  buildStandardOutcome,
  buildUnverifiedOutcome,
} from './reasoningOutcome.js';
import {
  buildContextHistory,
  createLogEntry,
  createReasoningCore,
  getProviderConfig,
  resolveStandardAgents,
} from './reasoningRuntime.js';
import { dedupeSources } from './sourceUtils.js';
import {
  assertAnalystResponse,
  assertGenericAgentResponse,
  assertInspectionResponse,
  assertJudgeResponse,
  assertSkepticResponse,
  assertValidatorResponse,
} from '../validation/responseValidation.js';

export class MultiAgentService {
  public async generateSpeech(
    text: string,
    config: SystemConfig
  ): Promise<string> {
    const core = createReasoningCore(config);
    if (core.generateSpeech) {
      return core.generateSpeech(text);
    }
    throw new Error('TTS is currently supported only through Gemini.');
  }

  public async runCustomChain(
    userPrompt: string,
    config: SystemConfig,
    chatHistory: ChatHistoryItem[],
    onLog: (log: LogEntry) => void,
    signal?: AbortSignal
  ): Promise<ReasoningOutcome> {
    if (!config.workflow?.length) {
      throw new Error('Workflow mode is active but no steps are defined.');
    }

    const core = createReasoningCore(config);
    const provider = getProviderConfig(config);
    const model = provider.model;
    let currentContext =
      buildContextHistory(chatHistory) +
      `ORIGINAL USER REQUEST: "${userPrompt}"\n\n=== WORKFLOW START ===\n`;
    let lastOutput = '';
    const collectedSources: SourceMetadata[] = [];

    for (const step of config.workflow) {
      if (signal?.aborted) throw new Error('ABORT_SEQUENCE_RECEIVED');

      const targetName = step.agentName.toLowerCase();
      const agentConfig = config.agents.find(
        (agent) => agent.name.toLowerCase() === targetName
      );
      if (!agentConfig) {
        onLog(
          createLogEntry(
            'system',
            'SYSTEM',
            `ERROR: Agent '${step.agentName}' was not found. Step skipped.`,
            false
          )
        );
        continue;
      }

      onLog(
        createLogEntry(
          agentConfig.role,
          agentConfig.name,
          `Initializing step: ${step.name}...`,
          true
        )
      );

      const stepPrompt = `
        CURRENT WORKFLOW STATE:
        ${currentContext}

        YOUR ASSIGNMENT (${step.name}):
        ${step.instruction}

        Return JSON with a concise 'work_summary' and the final 'output'.
        Do not expose hidden chain-of-thought.
      `;

      const response = await core.generateJSON(
        model,
        generateSystemInstruction(agentConfig, config),
        stepPrompt,
        GENERIC_STEP_SCHEMA,
        false,
        {
          ...agentConfig,
          temperature: step.temperature ?? agentConfig.temperature,
        },
        signal
      );
      const data = assertGenericAgentResponse(response.data);
      collectedSources.push(...(response.sources || []));

      lastOutput = data.output;
      currentContext += `\n[STEP: ${step.name} | AGENT: ${agentConfig.name}]\n${lastOutput}\n`;
      onLog(
        createLogEntry(
          agentConfig.role,
          agentConfig.name,
          lastOutput,
          false,
          data,
          response.sources
        )
      );
    }

    if (!lastOutput) {
      throw new Error('Workflow completed without producing an output.');
    }

    return buildUnverifiedOutcome({
      answer: lastOutput,
      mode: 'workflow',
      provider: provider.type,
      model,
      sources: collectedSources,
      warnings: [
        'Custom workflow output has not been independently validated.',
      ],
    });
  }

  public async runReasoningChain(
    userPrompt: string,
    config: SystemConfig,
    chatHistory: ChatHistoryItem[],
    onLog: (log: LogEntry) => void,
    onRoundUpdate?: (round: number) => void,
    signal?: AbortSignal
  ): Promise<ReasoningOutcome> {
    const { analyst, skeptic, judge, validator } =
      resolveStandardAgents(config);

    if (signal?.aborted) throw new Error('ABORT_SEQUENCE_RECEIVED');

    const core = createReasoningCore(config);
    const provider = getProviderConfig(config);
    const model = provider.model;
    const warnings: string[] = [];

    if (!core.capabilities.webSearch) {
      warnings.push(
        'The selected provider adapter does not provide grounded web search, so source-backed validation is unavailable.'
      );
    }
    if (!validator) warnings.push('No validator agent is configured.');

    let history =
      buildContextHistory(chatHistory) +
      `ORIGINAL USER QUERY: "${userPrompt}"\n`;
    let currentDraft = '';
    let consensus = false;
    let roundsExecuted = 0;

    onLog(
      createLogEntry(
        analyst.role,
        analyst.name,
        'Initializing evidence scan...',
        true
      )
    );

    const analystResponse = await core.generateJSON(
      model,
      generateSystemInstruction(analyst, config),
      ANALYST_PROMPT(history),
      ANALYST_SCHEMA,
      core.capabilities.webSearch,
      analyst,
      signal
    );
    const analystData = assertAnalystResponse(analystResponse.data);

    currentDraft = analystData.factual_answer;
    history += `\n[${analyst.name}]\nEvidence summary: ${analystData.evidence_summary}\nDraft: ${currentDraft}\nModel confidence: ${analystData.confidence}%\n`;
    onLog(
      createLogEntry(
        analyst.role,
        analyst.name,
        currentDraft,
        false,
        analystData,
        analystResponse.sources
      )
    );

    for (let round = 1; round <= config.max_rounds; round += 1) {
      if (signal?.aborted) throw new Error('ABORT_SEQUENCE_RECEIVED');
      roundsExecuted = round;
      onRoundUpdate?.(round);

      onLog(
        createLogEntry(
          skeptic.role,
          skeptic.name,
          `Running integrity check (cycle ${round})...`,
          true
        )
      );

      const skepticResponse = await core.generateJSON(
        model,
        generateSystemInstruction(skeptic, config),
        SKEPTIC_PROMPT(history, currentDraft),
        SKEPTIC_SCHEMA,
        core.capabilities.webSearch,
        skeptic,
        signal
      );
      const skepticData = assertSkepticResponse(skepticResponse.data);

      history += `\n[${skeptic.name}]\nAnalysis: ${skepticData.analysis}\nFlaws: ${skepticData.flaws.join(', ') || 'None'}\nCorrection: ${skepticData.correction}\n`;
      onLog(
        createLogEntry(
          skeptic.role,
          skeptic.name,
          skepticData.has_flaws
            ? `OBJECTION: ${skepticData.analysis}`
            : `AGREEMENT: ${skepticData.analysis}`,
          false,
          skepticData,
          skepticResponse.sources
        )
      );

      if (!skepticData.has_flaws) {
        consensus = true;
        break;
      }
      if (round === config.max_rounds) break;

      onLog(
        createLogEntry(
          analyst.role,
          analyst.name,
          'Applying critique and rebuilding the draft...',
          true
        )
      );

      const rebuttalResponse = await core.generateJSON(
        model,
        generateSystemInstruction(analyst, config),
        ANALYST_REVISION_PROMPT(
          userPrompt,
          currentDraft,
          history,
          skepticData.analysis,
          skepticData.correction
        ),
        ANALYST_SCHEMA,
        core.capabilities.webSearch,
        analyst,
        signal
      );
      const rebuttalData = assertAnalystResponse(rebuttalResponse.data);

      currentDraft = rebuttalData.factual_answer;
      history += `\n[${analyst.name} REVISED]\nEvidence summary: ${rebuttalData.evidence_summary}\nDraft: ${currentDraft}\n`;
      onLog(
        createLogEntry(
          analyst.role,
          analyst.name,
          currentDraft,
          false,
          rebuttalData,
          rebuttalResponse.sources
        )
      );
    }

    if (signal?.aborted) throw new Error('ABORT_SEQUENCE_RECEIVED');
    onLog(
      createLogEntry(
        judge.role,
        judge.name,
        'Compiling evidence-calibrated verdict...',
        true
      )
    );

    const judgeResponse = await core.generateJSON(
      model,
      generateSystemInstruction(judge, config),
      JUDGE_PROMPT(history, consensus, roundsExecuted),
      JUDGE_SCHEMA,
      false,
      judge,
      signal
    );
    const judgeData = assertJudgeResponse(judgeResponse.data);

    let finalVerdict = judgeData.final_verdict;
    onLog(
      createLogEntry(
        judge.role,
        judge.name,
        finalVerdict,
        false,
        judgeData,
        judgeResponse.sources
      )
    );

    let validatorRan = false;
    let verificationStatus: VerificationStatus = null;
    let validatorSources: SourceMetadata[] = [];

    if (validator && core.capabilities.webSearch) {
      if (signal?.aborted) throw new Error('ABORT_SEQUENCE_RECEIVED');
      onLog(
        createLogEntry(
          validator.role,
          validator.name,
          'Running source-backed external validation...',
          true
        )
      );

      const validatorResponse = await core.generateJSON(
        model,
        generateSystemInstruction(validator, config),
        VALIDATOR_PROMPT(userPrompt, finalVerdict),
        VALIDATOR_SCHEMA,
        true,
        validator,
        signal
      );
      const validatorData = assertValidatorResponse(validatorResponse.data);
      validatorRan = true;
      finalVerdict = validatorData.final_output;
      validatorSources = dedupeSources(validatorResponse.sources);
      verificationStatus =
        validatorSources.length > 0
          ? validatorData.verification_status
          : 'UNVERIFIED';

      if (validatorSources.length === 0) {
        warnings.push(
          'The validator returned no external source metadata, so its result was not labeled verified.'
        );
      }

      const statusPrefix =
        verificationStatus === 'CONFIRMED'
          ? '✅ SOURCE CHECK CONFIRMED'
          : verificationStatus === 'CORRECTED'
            ? '⚠ SOURCE CHECK CORRECTED'
            : '⚠ SOURCE CHECK UNVERIFIED';

      onLog(
        createLogEntry(
          validator.role,
          validator.name,
          `${statusPrefix}\n\n${finalVerdict}`,
          false,
          validatorData,
          validatorSources
        )
      );
    } else if (validator) {
      warnings.push(
        'The validator was skipped because the selected provider adapter has no web-search capability.'
      );
    }

    return buildStandardOutcome({
      answer: finalVerdict,
      consensusReached: consensus,
      validatorRan,
      verificationStatus,
      isConclusive: judgeData.is_conclusive,
      roundsExecuted,
      warnings,
      sources: validatorSources,
      provider: provider.type,
      model,
    });
  }

  public async runAgentInspection(
    targetAgent: AgentConfig,
    userQuery: string,
    config: SystemConfig,
    chatHistory: ChatHistoryItem[],
    onLog: (log: LogEntry) => void,
    signal?: AbortSignal
  ): Promise<ReasoningOutcome> {
    const historyBlock =
      buildContextHistory(chatHistory) || 'NO PREVIOUS HISTORY';

    onLog(
      createLogEntry(
        targetAgent.role,
        targetAgent.name,
        `DIAGNOSTIC QUERY: "${userQuery}"`,
        true
      )
    );

    const core = createReasoningCore(config);
    const provider = getProviderConfig(config);
    const result = await core.generateJSON(
      provider.model,
      generateSystemInstruction(targetAgent, config),
      META_INSPECTION_PROMPT(historyBlock, userQuery),
      INSPECTION_SCHEMA,
      false,
      targetAgent,
      signal
    );
    const data = assertInspectionResponse(result.data);

    onLog(
      createLogEntry(
        targetAgent.role,
        targetAgent.name,
        `DIAGNOSTIC OUTPUT:\n${data.response}\n\n[STATUS: ${data.internal_state}]`,
        false,
        { work_summary: 'Direct diagnostic query outside the debate pipeline.' }
      )
    );

    return buildUnverifiedOutcome({
      answer: data.response,
      mode: 'interrogation',
      provider: provider.type,
      model: provider.model,
      warnings: ['Diagnostic responses are not independently validated.'],
    });
  }
}
