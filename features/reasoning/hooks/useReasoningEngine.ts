import { useCallback, useRef, useState } from 'react';
import { ProcessState } from '../types';
import type {
  AgentConfig,
  ChatHistoryItem,
  LogEntry,
  ReasoningOutcome,
  SystemConfig,
} from '../types';
import { MultiAgentService } from '../services/geminiService';
import { parseAgentInspectionCommand } from '../services/agentInspection.js';

const uuid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const useReasoningEngine = (config: SystemConfig) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [processState, setProcessState] = useState<ProcessState>(
    ProcessState.IDLE
  );
  const [activeAgentName, setActiveAgentName] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<ReasoningOutcome | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [currentRound, setCurrentRound] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  const addLog = useCallback((log: LogEntry) => {
    setLogs((previous) => {
      const filtered = previous.filter(
        (item) => !(item.agentRole === log.agentRole && item.isThinking)
      );
      return [...filtered, log];
    });
  }, []);

  const addWorkflowLog = useCallback((log: LogEntry) => {
    setLogs((previous) => {
      const filtered = previous.filter(
        (item) => !(item.agentName === log.agentName && item.isThinking)
      );
      return [...filtered, log];
    });
  }, []);

  const handleInterrogation = async (
    service: MultiAgentService,
    targetAgent: AgentConfig,
    query: string,
    originalPrompt: string,
    history: ChatHistoryItem[],
    signal: AbortSignal
  ) => {
    setProcessState(ProcessState.INTERROGATION);
    setActiveAgentName(targetAgent.name);

    const outcome = await service.runAgentInspection(
      targetAgent,
      query,
      config,
      history,
      addLog,
      signal
    );
    if (signal.aborted) throw new Error('ABORT_SEQUENCE_RECEIVED');

    setFinalResult(outcome);
    setProcessState(ProcessState.COMPLETE);
    setActiveAgentName(null);
    setChatHistory((previous) => [
      ...previous,
      { role: 'user', content: originalPrompt },
      { role: 'model', content: outcome.answer },
    ]);
  };

  const handleWorkflow = async (
    service: MultiAgentService,
    userPrompt: string,
    history: ChatHistoryItem[],
    signal: AbortSignal
  ) => {
    setProcessState(ProcessState.WORKFLOW_RUNNING);

    const outcome = await service.runCustomChain(
      userPrompt,
      config,
      history,
      (log) => {
        addWorkflowLog(log);
        if (log.isThinking) setActiveAgentName(log.agentName);
      },
      signal
    );
    if (signal.aborted) throw new Error('ABORT_SEQUENCE_RECEIVED');

    setFinalResult(outcome);
    setProcessState(ProcessState.COMPLETE);
    setActiveAgentName(null);
    setLogs((previous) => [
      ...previous,
      {
        id: uuid(),
        agentRole: 'verdict',
        agentName: 'WORKFLOW_COMPLETE',
        content: outcome.answer,
        timestamp: Date.now(),
        metadata: { outcome },
        sources: outcome.sources,
      },
    ]);
    setChatHistory((previous) => [
      ...previous,
      { role: 'user', content: userPrompt },
      { role: 'model', content: outcome.answer },
    ]);
  };

  const handleStandardDebate = async (
    service: MultiAgentService,
    userPrompt: string,
    history: ChatHistoryItem[],
    signal: AbortSignal
  ) => {
    const outcome = await service.runReasoningChain(
      userPrompt,
      config,
      history,
      (log) => {
        addLog(log);
        if (!log.isThinking) return;

        setActiveAgentName(log.agentName);
        const stateMap: Record<string, ProcessState> = {
          analyst: ProcessState.ANALYZING,
          skeptic: ProcessState.AUDITING,
          judge: ProcessState.JUDGING,
          validator: ProcessState.VALIDATING,
        };
        const nextState = stateMap[log.agentRole.toLowerCase()];
        if (nextState) setProcessState(nextState);
      },
      setCurrentRound,
      signal
    );
    if (signal.aborted) throw new Error('ABORT_SEQUENCE_RECEIVED');

    setFinalResult(outcome);
    setProcessState(ProcessState.COMPLETE);
    setActiveAgentName(null);
    setLogs((previous) => [
      ...previous,
      {
        id: uuid(),
        agentRole: 'verdict',
        agentName: 'VERITAS_FINAL',
        content: outcome.answer,
        timestamp: Date.now(),
        metadata: { outcome },
        sources: outcome.sources,
      },
    ]);
    setChatHistory((previous) => [
      ...previous,
      { role: 'user', content: userPrompt },
      { role: 'model', content: outcome.answer },
    ]);
  };

  const startReasoning = useCallback(
    async (userPrompt: string) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setProcessState(ProcessState.ANALYZING);
      setFinalResult(null);
      setCurrentRound(0);
      setActiveAgentName(null);

      const userLog: LogEntry = {
        id: uuid(),
        agentRole: 'user',
        agentName: 'OPERATOR',
        content: userPrompt,
        timestamp: Date.now(),
      };

      setLogs((previous) => {
        const next = [...previous];
        if (previous.length > 0) {
          next.push({
            id: uuid(),
            agentRole: 'system',
            agentName: 'SYSTEM',
            content: 'NEW_CYCLE_INITIATED',
            timestamp: Date.now(),
          });
        }
        next.push(userLog);
        return next;
      });

      const service = new MultiAgentService();

      try {
        const inspection = parseAgentInspectionCommand(
          userPrompt,
          config.agents
        );
        if (inspection) {
          await handleInterrogation(
            service,
            inspection.targetAgent,
            inspection.query,
            userPrompt,
            chatHistory,
            controller.signal
          );
          return;
        }

        if (config.workflow?.length) {
          await handleWorkflow(
            service,
            userPrompt,
            chatHistory,
            controller.signal
          );
          return;
        }

        await handleStandardDebate(
          service,
          userPrompt,
          chatHistory,
          controller.signal
        );
      } catch (error) {
        if (abortControllerRef.current !== controller) return;

        const message =
          error instanceof Error ? error.message : 'Unknown reasoning failure.';

        if (message === 'ABORT_SEQUENCE_RECEIVED') {
          setProcessState(ProcessState.CANCELLED);
          setActiveAgentName(null);
          setLogs((previous) => [
            ...previous,
            {
              id: uuid(),
              agentRole: 'system',
              agentName: 'SYSTEM',
              content: 'PROCESS CANCELLED BY USER',
              timestamp: Date.now(),
            },
          ]);
        } else {
          console.error(error);
          setProcessState(ProcessState.ERROR);
          setActiveAgentName(null);
          setLogs((previous) => [
            ...previous,
            {
              id: uuid(),
              agentRole: 'system',
              agentName: 'SYSTEM',
              content: `CRITICAL FAILURE: ${message}`,
              timestamp: Date.now(),
            },
          ]);
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [config, chatHistory, addLog, addWorkflowLog]
  );

  const stopReasoning = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const clearMemory = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setChatHistory([]);
    setLogs([]);
    setFinalResult(null);
    setProcessState(ProcessState.IDLE);
    setCurrentRound(0);
    setActiveAgentName(null);
  }, []);

  return {
    logs,
    processState,
    activeAgentName,
    finalResult,
    chatHistory,
    currentRound,
    startReasoning,
    stopReasoning,
    clearMemory,
  };
};
