import type { AgentConfig } from '../types.js';

export interface AgentInspectionCommand {
  targetAgent: AgentConfig;
  query: string;
}

export const parseAgentInspectionCommand = (
  userPrompt: string,
  agents: AgentConfig[]
): AgentInspectionCommand | null => {
  const prompt = userPrompt.trimStart();
  if (!prompt.startsWith('@')) return null;

  const targets = agents
    .flatMap((agent) => [
      { token: agent.name, agent },
      ...(agent.role.toLowerCase() === agent.name.toLowerCase()
        ? []
        : [{ token: agent.role, agent }]),
    ])
    .sort((left, right) => right.token.length - left.token.length);
  const normalizedPrompt = prompt.toLowerCase();

  for (const { token, agent } of targets) {
    const prefix = `@${token}`;
    if (!normalizedPrompt.startsWith(prefix.toLowerCase())) continue;

    const remainder = prompt.slice(prefix.length);
    const separator = remainder.match(/^\s*:\s*/);
    if (!separator) continue;

    const query = remainder.slice(separator[0].length).trim();
    if (!query) return null;
    return { targetAgent: agent, query };
  }

  return null;
};
