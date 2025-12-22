import { useState, useCallback } from 'react';
import { SystemConfig, LogEntry, ProcessState, ChatHistoryItem } from '../types';
import { MultiAgentService } from '../services/geminiService';

const uuid = () => Math.random().toString(36).substring(2, 9);

export const useReasoningEngine = (config: SystemConfig) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [processState, setProcessState] = useState<ProcessState>(ProcessState.IDLE);
  const [activeAgentName, setActiveAgentName] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [currentRound, setCurrentRound] = useState<number>(0);

  const startReasoning = useCallback(async (userPrompt: string) => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.error("API Key missing");
      return;
    }

    setProcessState(ProcessState.ANALYZING);
    setFinalResult(null);
    setCurrentRound(0);
    setActiveAgentName(null);

    // 1. Inject User Input into Logs (without clearing previous)
    const userLog: LogEntry = {
        id: uuid(),
        agentRole: 'user',
        agentName: 'OPERATOR',
        content: userPrompt,
        timestamp: Date.now()
    };
    
    setLogs(prev => {
        const newLogs = [...prev];
        // Add a system separator if this is a follow-up
        if (prev.length > 0) {
           newLogs.push({
             id: `sep-${Date.now()}`,
             agentRole: 'system',
             agentName: 'SYSTEM',
             content: 'NEW_CYCLE_INITIATED',
             timestamp: Date.now()
           });
        }
        return [...newLogs, userLog];
    });

    const service = new MultiAgentService(apiKey);

    try {
      // CHECK FOR INTERROGATION COMMAND (@AgentName: ...)
      const interrogationMatch = userPrompt.match(/^@([\w_]+):\s*(.+)/i);
      
      if (interrogationMatch) {
         const targetName = interrogationMatch[1];
         const query = interrogationMatch[2];
         
         const targetAgent = config.agents.find(a => 
             a.name.toLowerCase() === targetName.toLowerCase() || 
             a.role.toLowerCase() === targetName.toLowerCase()
         );

         if (targetAgent) {
             setProcessState(ProcessState.INTERROGATION);
             setActiveAgentName(targetAgent.name);
             
             const result = await service.runAgentInspection(
                 targetAgent,
                 query,
                 config,
                 chatHistory,
                 (log) => {
                     setLogs(prev => {
                         const filtered = prev.filter(l => !(l.agentRole === log.agentRole && l.isThinking));
                         return [...filtered, log];
                     });
                 }
             );
             
             setFinalResult(result);
             setProcessState(ProcessState.COMPLETE); // Or IDLE to indicate ready? COMPLETE triggers sound.
             setActiveAgentName(null);
             return;
         }
      }

      // CHECK FOR CUSTOM WORKFLOW
      if (config.workflow && config.workflow.length > 0) {
          setProcessState(ProcessState.WORKFLOW_RUNNING);
          
          const result = await service.runCustomChain(
              userPrompt,
              config,
              chatHistory,
              (log) => {
                  setLogs(prev => {
                      const filtered = prev.filter(l => !(l.agentName === log.agentName && l.isThinking));
                      return [...filtered, log];
                  });
                  if (log.isThinking) {
                      setActiveAgentName(log.agentName);
                  }
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
          return;
      }

      // STANDARD REASONING CHAIN (DEFAULT DEBATE)
      const result = await service.runReasoningChain(
        userPrompt, 
        config, 
        chatHistory,
        (log) => {
          setLogs(prev => {
            // Remove previous thinking log from same agent to prevent clutter
            const filtered = prev.filter(l => !(l.agentRole === log.agentRole && l.isThinking));
            return [...filtered, log];
          });
          
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

      // 2. Append Final Verdict to Logs
      const verdictLog: LogEntry = {
          id: uuid(),
          agentRole: 'verdict',
          agentName: 'VERITAS_FINAL',
          content: result,
          timestamp: Date.now()
      };
      setLogs(prev => [...prev, verdictLog]);

      // 3. Update Chat History
      setChatHistory(prev => [
        ...prev,
        { role: 'user', content: userPrompt },
        { role: 'model', content: result }
      ]);

    } catch (e) {
      console.error(e);
      setProcessState(ProcessState.ERROR);
      setActiveAgentName(null);
      setLogs(prev => [...prev, {
        id: 'ERR', 
        agentRole: 'judge', 
        agentName: 'SYSTEM', 
        content: 'CRITICAL FAILURE', 
        timestamp: Date.now()
      }]);
    }
  }, [config, chatHistory]);

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