import type {
  AgentConfig,
  ProviderConfig,
  SystemConfig,
  WorkflowStep,
} from '../types.js';

export const DEFAULT_PROVIDER: ProviderConfig = {
  type: 'gemini',
  model: 'gemini-3.6-flash',
};

export interface ConfigValidationResult {
  success: boolean;
  config?: SystemConfig;
  errors: string[];
}

export class ConfigValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join('\n'));
    this.name = 'ConfigValidationError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readRequiredString = (
  value: unknown,
  path: string,
  errors: string[]
): string => {
  if (typeof value !== 'string' || !value.trim()) {
    errors.push(`${path} must be a non-empty string.`);
    return '';
  }
  return value.trim();
};

const readOptionalNumber = (
  value: unknown,
  path: string,
  errors: string[],
  limits?: { min?: number; max?: number }
): number | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${path} must be a finite number.`);
    return undefined;
  }
  if (limits?.min !== undefined && value < limits.min) {
    errors.push(`${path} must be at least ${limits.min}.`);
  }
  if (limits?.max !== undefined && value > limits.max) {
    errors.push(`${path} must be at most ${limits.max}.`);
  }
  return value;
};

const parseAgent = (
  value: unknown,
  index: number,
  errors: string[]
): AgentConfig | null => {
  const path = `agents[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return null;
  }

  const agent: AgentConfig = {
    role: readRequiredString(value.role, `${path}.role`, errors).toLowerCase(),
    name: readRequiredString(value.name, `${path}.name`, errors),
    color: readRequiredString(value.color, `${path}.color`, errors),
    style: readRequiredString(value.style, `${path}.style`, errors),
    task: readRequiredString(value.task, `${path}.task`, errors),
    icon: readRequiredString(value.icon, `${path}.icon`, errors),
  };

  const temperature = readOptionalNumber(
    value.temperature,
    `${path}.temperature`,
    errors,
    { min: 0, max: 2 }
  );
  const topK = readOptionalNumber(value.topK, `${path}.topK`, errors, {
    min: 1,
  });
  const topP = readOptionalNumber(value.topP, `${path}.topP`, errors, {
    min: 0,
    max: 1,
  });
  const thinkingBudget = readOptionalNumber(
    value.thinkingBudget,
    `${path}.thinkingBudget`,
    errors,
    { min: 0 }
  );

  if (temperature !== undefined) agent.temperature = temperature;
  if (topK !== undefined) agent.topK = topK;
  if (topP !== undefined) agent.topP = topP;
  if (thinkingBudget !== undefined) agent.thinkingBudget = thinkingBudget;

  return agent;
};

const parseWorkflowStep = (
  value: unknown,
  index: number,
  errors: string[]
): WorkflowStep | null => {
  const path = `workflow[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return null;
  }

  const step: WorkflowStep = {
    id: readRequiredString(value.id, `${path}.id`, errors),
    name: readRequiredString(value.name, `${path}.name`, errors),
    agentName: readRequiredString(value.agentName, `${path}.agentName`, errors),
    instruction: readRequiredString(
      value.instruction,
      `${path}.instruction`,
      errors
    ),
  };

  const temperature = readOptionalNumber(
    value.temperature,
    `${path}.temperature`,
    errors,
    { min: 0, max: 2 }
  );
  if (temperature !== undefined) step.temperature = temperature;

  return step;
};

const parseProvider = (
  value: unknown,
  errors: string[]
): ProviderConfig => {
  if (value === undefined) return { ...DEFAULT_PROVIDER };
  if (!isRecord(value)) {
    errors.push('provider must be an object.');
    return { ...DEFAULT_PROVIDER };
  }

  const type = value.type;
  if (type !== 'gemini' && type !== 'openrouter') {
    errors.push("provider.type must be either 'gemini' or 'openrouter'.");
  }

  return {
    type: type === 'openrouter' ? 'openrouter' : 'gemini',
    model: readRequiredString(value.model, 'provider.model', errors),
  };
};

export const validateAndNormalizeSystemConfig = (
  value: unknown
): ConfigValidationResult => {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return {
      success: false,
      errors: ['Configuration must be a JSON object.'],
    };
  }

  const globalRules = readRequiredString(
    value.global_rules,
    'global_rules',
    errors
  );

  const maxRounds = value.max_rounds;
  if (
    typeof maxRounds !== 'number' ||
    !Number.isInteger(maxRounds) ||
    maxRounds < 0 ||
    maxRounds > 10
  ) {
    errors.push('max_rounds must be an integer between 0 and 10.');
  }

  const rawAgents = value.agents;
  const agents = Array.isArray(rawAgents)
    ? rawAgents
        .map((agent, index) => parseAgent(agent, index, errors))
        .filter((agent): agent is AgentConfig => agent !== null)
    : [];

  if (!Array.isArray(rawAgents) || rawAgents.length === 0) {
    errors.push('agents must contain at least one agent.');
  }

  const normalizedNames = agents.map((agent) => agent.name.toLowerCase());
  if (new Set(normalizedNames).size !== normalizedNames.length) {
    errors.push('Agent names must be unique (case-insensitive).');
  }

  const rawWorkflow = value.workflow;
  const workflow = Array.isArray(rawWorkflow)
    ? rawWorkflow
        .map((step, index) => parseWorkflowStep(step, index, errors))
        .filter((step): step is WorkflowStep => step !== null)
    : undefined;

  if (rawWorkflow !== undefined && !Array.isArray(rawWorkflow)) {
    errors.push('workflow must be an array when provided.');
  }

  const hasWorkflow = Boolean(workflow?.length);
  if (hasWorkflow) {
    const stepIds = workflow!.map((step) => step.id.toLowerCase());
    if (new Set(stepIds).size !== stepIds.length) {
      errors.push('Workflow step IDs must be unique (case-insensitive).');
    }

    const agentNames = new Set(normalizedNames);
    workflow!.forEach((step, index) => {
      if (!agentNames.has(step.agentName.toLowerCase())) {
        errors.push(
          `workflow[${index}].agentName references unknown agent '${step.agentName}'.`
        );
      }
    });
  } else {
    const roles = new Set(agents.map((agent) => agent.role.toLowerCase()));
    ['analyst', 'skeptic', 'judge'].forEach((role) => {
      if (!roles.has(role)) {
        errors.push(
          `Standard debate mode requires an agent with role '${role}'.`
        );
      }
    });
    if (typeof maxRounds === 'number' && maxRounds < 1) {
      errors.push('Standard debate mode requires max_rounds of at least 1.');
    }
  }

  const provider = parseProvider(value.provider, errors);

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    errors: [],
    config: {
      global_rules: globalRules,
      max_rounds: maxRounds as number,
      agents,
      provider,
      ...(hasWorkflow ? { workflow } : {}),
    },
  };
};

export const parseSystemConfig = (value: unknown): SystemConfig => {
  const result = validateAndNormalizeSystemConfig(value);
  if (!result.success || !result.config) {
    throw new ConfigValidationError(result.errors);
  }
  return result.config;
};
