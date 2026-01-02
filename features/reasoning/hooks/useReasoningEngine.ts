import { useState, useCallback, useRef, useEffect } from 'react';
import { SystemConfig, LogEntry, ProcessState, ChatHistoryItem, AgentConfig } from '../types';
import { MultiAgentService } from '../services/geminiService';
import { checkAuthStatus, isBackendAvailable } from '../../../services/backendProxy';

const uuid = () => Math.random().toString(36).substring(2, 9);

export const useReasoningEngine = (config: SystemConfig, manualApiKey: string | null) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [processState, setProcessState] = useState<ProcessState>(ProcessState.IDLE);
  const [activeAgentName, setActiveAgentName] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [currentRound, setCurrentRound] = useState<number>(0);
  const [isOAuthAuthenticated, setIsOAuthAuthenticated] = useState<boolean>(false);

  // Check OAuth status on mount and when manualApiKey changes
  useEffect(() => {
    const checkOAuth = async () => {
      if (isBackendAvailable() && !manualApiKey) {
        try {
          const status = await checkAuthStatus();
          setIsOAuthAuthenticated(status.authenticated);
        } catch (e) {
          setIsOAuthAuthenticated(false);
        }
      } else {
        setIsOAuthAuthenticated(false);
      }
    };
    checkOAuth();
  }, [manualApiKey]);

  // Helper to add logs efficiently
  const addLog = useCallback((log: LogEntry) => {
    setLogs(prev => {
      const filtered = prev.filter(l => !(l.agentRole === log.agentRole && l.isThinking));
      return [...filtered, log];
    });
  }, []);

  const addWorkflowLog = useCallback((log: LogEntry) => {
    setLogs(prev => {
      const filtered = prev.filter(l => !(l.agentName === log.agentName && l.isThinking));
      return [...filtered, log];
    });
  }, []);

  // --- SUB-HANDLERS ---

  const handleInterrogation = async (
    service: MultiAgentService,
    targetAgent: AgentConfig,
    query: string,
    chatHistory: ChatHistoryItem[]
  ) => {
    setProcessState(ProcessState.INTERROGATION);
    setActiveAgentName(targetAgent.name);

    const result = await service.runAgentInspection(
      targetAgent,
      query,
      config,
      chatHistory,
      addLog
    );

    setFinalResult(result);
    setProcessState(ProcessState.COMPLETE);
    setActiveAgentName(null);
  };

  const handleWorkflow = async (
    service: MultiAgentService,
    userPrompt: string,
    chatHistory: ChatHistoryItem[]
  ) => {
    setProcessState(ProcessState.WORKFLOW_RUNNING);

    const result = await service.runCustomChain(
      userPrompt,
      config,
      chatHistory,
      (log) => {
        addWorkflowLog(log);
        if (log.isThinking) setActiveAgentName(log.agentName);
      }
    );

    setFinalResult(result);
    setProcessState(ProcessState.COMPLETE);
    setActiveAgentName(null);

    const verdictLog: LogEntry = {
      id: uuid(),
      agentRole: 'verdict',
      agentName: 'WORKFLOW_COMPLETE',
      content: result,
      timestamp: Date.now()
    };
    setLogs(prev => [...prev, verdictLog]);

    setChatHistory(prev => [
      ...prev,
      { role: 'user', content: userPrompt },
      { role: 'model', content: result }
    ]);
  };

  const handleStandardDebate = async (
    service: MultiAgentService,
    userPrompt: string,
    chatHistory: ChatHistoryItem[]
  ) => {
    const result = await service.runReasoningChain(
      userPrompt,
      config,
      chatHistory,
      (log) => {
        addLog(log);
        if (log.isThinking) {
          setActiveAgentName(log.agentName);
          const stateMap: Record<string, ProcessState> = {
            'analyst': ProcessState.ANALYZING,
            'skeptic': ProcessState.AUDITING,
            'judge': ProcessState.JUDGING,
            'validator': ProcessState.VALIDATING
          };
          if (stateMap[log.agentRole]) setProcessState(stateMap[log.agentRole]);
        }
      },
      (round) => setCurrentRound(round)
    );

    setFinalResult(result);
    setProcessState(ProcessState.COMPLETE);
    setActiveAgentName(null);

    const verdictLog: LogEntry = {
      id: uuid(),
      agentRole: 'verdict',
      agentName: 'VERITAS_FINAL',
      content: result,
      timestamp: Date.now()
    };
    setLogs(prev => [...prev, verdictLog]);

    setChatHistory(prev => [
      ...prev,
      { role: 'user', content: userPrompt },
      { role: 'model', content: result }
    ]);
  };

  // --- MAIN ENTRY POINT ---

  const startReasoning = useCallback(async (userPrompt: string) => {
    // RESOLVE AUTH METHOD - Check OAuth status in real-time (not stale state)
    let useOAuth = false;
    if (isBackendAvailable() && !manualApiKey) {
      try {
        const status = await checkAuthStatus();
        useOAuth = status.authenticated;
        console.log('🔐 OAuth status check:', status.authenticated ? `Authenticated as ${status.user?.email}` : 'Not authenticated');
      } catch (e) {
        console.warn('OAuth check failed:', e);
      }
    }

    const apiKey = manualApiKey || process.env.API_KEY || null;

    // Determine Auth Mode for Logging
    let authSource = 'UNKNOWN_SOURCE';
    if (manualApiKey) authSource = 'MANUAL_OVERRIDE';
    else if (useOAuth) authSource = 'GOOGLE_OAUTH';
    else if (process.env.API_KEY) authSource = 'SUBSCRIPTION_UPLINK';

    console.log('🚀 Starting reasoning with auth:', authSource, { useOAuth, hasApiKey: !!apiKey });

    if (!apiKey && !useOAuth) {
      console.error("API Key missing and OAuth not authenticated");
      setLogs(prev => [...prev, {
        id: 'ERR_KEY',
        agentRole: 'system',
        agentName: 'SYSTEM',
        content: 'AUTHENTICATION ERROR: No Uplink Detected.\nPlease sign in with Google OAuth or enter an API key.',
        timestamp: Date.now()
      }]);
      return;
    }

    setProcessState(ProcessState.ANALYZING);
    setFinalResult(null);
    setCurrentRound(0);
    setActiveAgentName(null);

    // Initial User Log
    const userLog: LogEntry = {
      id: uuid(),
      agentRole: 'user',
      agentName: 'OPERATOR',
      content: userPrompt,
      timestamp: Date.now()
    };

    setLogs(prev => {
      const newLogs = [...prev];
      if (prev.length > 0) {
        newLogs.push({
          id: `sep-${Date.now()}`,
          agentRole: 'system',
          agentName: 'SYSTEM',
          content: `NEW_CYCLE_INITIATED [AUTH: ${authSource}]`,
          timestamp: Date.now()
        });
      } else {
        newLogs.push({
          id: `boot-${Date.now()}`,
          agentRole: 'system',
          agentName: 'SYSTEM',
          content: `VERITAS KERNEL ONLINE [AUTH: ${authSource}]`,
          timestamp: Date.now()
        });
      }
      return [...newLogs, userLog];
    });

    const service = new MultiAgentService(apiKey, useOAuth);

    try {
      // 1. Interrogation Check
      const interrogationMatch = userPrompt.match(/^@([\w_]+):\s*(.+)/i);
      if (interrogationMatch) {
        const targetName = interrogationMatch[1];
        const query = interrogationMatch[2];
        const targetAgent = config.agents.find(a =>
          a.name.toLowerCase() === targetName.toLowerCase() ||
          a.role.toLowerCase() === targetName.toLowerCase()
        );

        if (targetAgent) {
          await handleInterrogation(service, targetAgent, query, chatHistory);
          return;
        }
      }

      // 2. Custom Workflow Check
      if (config.workflow && config.workflow.length > 0) {
        await handleWorkflow(service, userPrompt, chatHistory);
        return;
      }

      // 3. Standard Debate
      await handleStandardDebate(service, userPrompt, chatHistory);

    } catch (e) {
      console.error(e);
      setProcessState(ProcessState.ERROR);
      setActiveAgentName(null);
      setLogs(prev => [...prev, {
        id: 'ERR',
        agentRole: 'judge',
        agentName: 'SYSTEM',
        content: 'CRITICAL FAILURE: ' + (e as Error).message,
        timestamp: Date.now()
      }]);
    }
  }, [config, chatHistory, addLog, addWorkflowLog, manualApiKey]);

  const clearMemory = useCallback(() => {
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
    clearMemory
  };
};