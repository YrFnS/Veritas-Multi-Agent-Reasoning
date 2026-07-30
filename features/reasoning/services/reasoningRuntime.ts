import type {
  AgentConfig,
  ChatHistoryItem,
  IReasoningCore,
  LogEntry,
  LogMetadata,
  ProviderConfig,
  SourceMetadata,
  SystemConfig,
} from '../types.js';
import { GeminiCore } from './geminiCore.js';
import { OpenRouterCore } from './openRouterCore.js';
import { resolveProviderApiKey } from './providerKeys.js';

export const createId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const getProviderConfig = (config: SystemConfig): ProviderConfig => {
  if (!config.provider) {
    throw new Error('INTERNAL_ERROR: No provider configured.');
  }
  return config.provider;
};

export const createReasoningCore = (
  config: SystemConfig
): IReasoningCore => {
  const provider = getProviderConfig(config);
  const apiKey = resolveProviderApiKey(provider.type);

  return provider.type === 'openrouter'
    ? new OpenRouterCore(apiKey)
    : new GeminiCore(apiKey);
};

export const buildContextHistory = (
  chatHistory: ChatHistoryItem[]
): string => {
  if (chatHistory.length === 0) return '';

  return (
    'PREVIOUS CONVERSATION HISTORY:\n' +
    chatHistory
      .map(
        (turn) =>
          `${turn.role === 'user' ? 'USER' : 'ASSISTANT'}: ${turn.content}`
      )
      .join('\n') +
    '\n\n'
  );
};

export const createLogEntry = (
  role: string,
  name: string,
  content: string,
  isThinking: boolean,
  metadata?: LogMetadata,
  sources?: SourceMetadata[]
): LogEntry => ({
  id: createId(),
  agentRole: role,
  agentName: name,
  content,
  isThinking,
  timestamp: Date.now(),
  metadata,
  sources,
});

export const resolveStandardAgents = (config: SystemConfig): {
  analyst: AgentConfig;
  skeptic: AgentConfig;
  judge: AgentConfig;
  validator?: AgentConfig;
} => {
  const findByRole = (role: string) =>
    config.agents.find((agent) => agent.role.toLowerCase() === role);
  const analyst = findByRole('analyst');
  const skeptic = findByRole('skeptic');
  const judge = findByRole('judge');
  const validator = findByRole('validator');

  if (!analyst || !skeptic || !judge) {
    throw new Error(
      'Invalid configuration: standard debate requires analyst, skeptic, and judge agents.'
    );
  }

  return { analyst, skeptic, judge, validator };
};
