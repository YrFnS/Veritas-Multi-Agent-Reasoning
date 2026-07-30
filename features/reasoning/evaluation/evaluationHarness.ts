import type { ReasoningOutcome, ReasoningStatus } from '../types.js';

export type EvaluationMode = 'single' | 'debate' | 'verified';

export type EvaluationCategory =
  | 'stable_fact'
  | 'current_fact'
  | 'false_premise'
  | 'ambiguous'
  | 'insufficient_evidence'
  | 'conflicting_evidence'
  | 'citation_required'
  | 'multilingual';

export interface EvaluationExpectation {
  acceptableStatuses?: ReasoningStatus[];
  requiredTerms?: string[];
  forbiddenTerms?: string[];
  minimumClaimCount?: number;
  minimumCitationCoverage?: number;
  minimumIndependentDomains?: number;
  requiresSourceBackedClaims?: boolean;
}

export interface EvaluationCase {
  id: string;
  category: EvaluationCategory;
  prompt: string;
  description: string;
  expectation: EvaluationExpectation;
  modeExpectations?: Partial<
    Record<EvaluationMode, Partial<EvaluationExpectation>>
  >;
}

export interface EvaluationObservation {
  caseId: string;
  mode: EvaluationMode;
  outcome: ReasoningOutcome;
  latencyMs: number;
  requestCount: number;
  estimatedCostUsd?: number;
}

export interface EvaluationCheck {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

export interface EvaluationScore {
  caseId: string;
  mode: EvaluationMode;
  passed: boolean;
  score: number;
  checks: EvaluationCheck[];
  latencyMs: number;
  requestCount: number;
  estimatedCostUsd?: number;
}

export interface EvaluationSummary {
  runs: number;
  passedRuns: number;
  passRate: number;
  averageScore: number;
  averageLatencyMs: number;
  averageRequestCount: number;
  estimatedTotalCostUsd: number;
  claimSupportRate: number;
  citationCoverage: number;
  byMode: Record<
    EvaluationMode,
    {
      runs: number;
      passRate: number;
      averageScore: number;
      averageLatencyMs: number;
      averageRequestCount: number;
    }
  >;
}

export type EvaluationExecutor = (
  testCase: EvaluationCase,
  mode: EvaluationMode
) => Promise<{
  outcome: ReasoningOutcome;
  latencyMs: number;
  requestCount: number;
  estimatedCostUsd?: number;
}>;

const unique = <T>(values: T[]): T[] => [...new Set(values)];

const mergeExpectation = (
  testCase: EvaluationCase,
  mode: EvaluationMode
): EvaluationExpectation => {
  const override = testCase.modeExpectations?.[mode] || {};
  return {
    ...testCase.expectation,
    ...override,
    requiredTerms: unique([
      ...(testCase.expectation.requiredTerms || []),
      ...(override.requiredTerms || []),
    ]),
    forbiddenTerms: unique([
      ...(testCase.expectation.forbiddenTerms || []),
      ...(override.forbiddenTerms || []),
    ]),
  };
};

const normalizeText = (value: string): string =>
  value.toLocaleLowerCase().replace(/\s+/g, ' ').trim();

const createCheck = (
  name: string,
  passed: boolean,
  expected: string,
  actual: string
): EvaluationCheck => ({ name, passed, expected, actual });

export const scoreEvaluationObservation = (
  testCase: EvaluationCase,
  observation: EvaluationObservation
): EvaluationScore => {
  if (testCase.id !== observation.caseId) {
    throw new Error(
      `Evaluation case mismatch: expected '${testCase.id}', received '${observation.caseId}'.`
    );
  }

  const expectation = mergeExpectation(testCase, observation.mode);
  const outcome = observation.outcome;
  const answer = normalizeText(outcome.answer);
  const checks: EvaluationCheck[] = [];

  if (expectation.acceptableStatuses?.length) {
    checks.push(
      createCheck(
        'status',
        expectation.acceptableStatuses.includes(outcome.status),
        expectation.acceptableStatuses.join(' | '),
        outcome.status
      )
    );
  }

  for (const term of expectation.requiredTerms || []) {
    checks.push(
      createCheck(
        `required term: ${term}`,
        answer.includes(normalizeText(term)),
        `answer contains '${term}'`,
        outcome.answer
      )
    );
  }

  for (const term of expectation.forbiddenTerms || []) {
    checks.push(
      createCheck(
        `forbidden term: ${term}`,
        !answer.includes(normalizeText(term)),
        `answer does not contain '${term}'`,
        outcome.answer
      )
    );
  }

  if (expectation.minimumClaimCount !== undefined) {
    checks.push(
      createCheck(
        'claim count',
        outcome.claimSummary.totalClaims >= expectation.minimumClaimCount,
        `>= ${expectation.minimumClaimCount}`,
        String(outcome.claimSummary.totalClaims)
      )
    );
  }

  if (expectation.minimumCitationCoverage !== undefined) {
    checks.push(
      createCheck(
        'citation coverage',
        outcome.claimSummary.citationCoverage >=
          expectation.minimumCitationCoverage,
        `>= ${expectation.minimumCitationCoverage}%`,
        `${outcome.claimSummary.citationCoverage}%`
      )
    );
  }

  if (expectation.minimumIndependentDomains !== undefined) {
    checks.push(
      createCheck(
        'independent source domains',
        outcome.claimSummary.independentDomains >=
          expectation.minimumIndependentDomains,
        `>= ${expectation.minimumIndependentDomains}`,
        String(outcome.claimSummary.independentDomains)
      )
    );
  }

  if (expectation.requiresSourceBackedClaims !== undefined) {
    const hasSourceBackedClaims = outcome.claimSummary.claimsWithSources > 0;
    checks.push(
      createCheck(
        'source-backed claims',
        hasSourceBackedClaims === expectation.requiresSourceBackedClaims,
        String(expectation.requiresSourceBackedClaims),
        String(hasSourceBackedClaims)
      )
    );
  }

  const passedChecks = checks.filter((check) => check.passed).length;
  const score = checks.length > 0 ? Math.round((passedChecks / checks.length) * 100) : 0;

  return {
    caseId: testCase.id,
    mode: observation.mode,
    passed: checks.length > 0 && passedChecks === checks.length,
    score,
    checks,
    latencyMs: observation.latencyMs,
    requestCount: observation.requestCount,
    ...(observation.estimatedCostUsd !== undefined
      ? { estimatedCostUsd: observation.estimatedCostUsd }
      : {}),
  };
};

const average = (values: number[]): number =>
  values.length > 0
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : 0;

const modeSummary = (
  scores: EvaluationScore[],
  mode: EvaluationMode
): EvaluationSummary['byMode'][EvaluationMode] => {
  const filtered = scores.filter((score) => score.mode === mode);
  return {
    runs: filtered.length,
    passRate:
      filtered.length > 0
        ? Math.round(
            (filtered.filter((score) => score.passed).length / filtered.length) *
              100
          )
        : 0,
    averageScore: average(filtered.map((score) => score.score)),
    averageLatencyMs: average(filtered.map((score) => score.latencyMs)),
    averageRequestCount: average(
      filtered.map((score) => score.requestCount)
    ),
  };
};

export const summarizeEvaluationScores = (
  scores: EvaluationScore[],
  observations: EvaluationObservation[]
): EvaluationSummary => {
  const totalClaims = observations.reduce(
    (sum, observation) => sum + observation.outcome.claimSummary.verifiableClaims,
    0
  );
  const supportedClaims = observations.reduce(
    (sum, observation) => sum + observation.outcome.claimSummary.supportedClaims,
    0
  );
  const claimsWithSources = observations.reduce(
    (sum, observation) => sum + observation.outcome.claimSummary.claimsWithSources,
    0
  );

  return {
    runs: scores.length,
    passedRuns: scores.filter((score) => score.passed).length,
    passRate:
      scores.length > 0
        ? Math.round(
            (scores.filter((score) => score.passed).length / scores.length) *
              100
          )
        : 0,
    averageScore: average(scores.map((score) => score.score)),
    averageLatencyMs: average(scores.map((score) => score.latencyMs)),
    averageRequestCount: average(scores.map((score) => score.requestCount)),
    estimatedTotalCostUsd: Number(
      scores
        .reduce((sum, score) => sum + (score.estimatedCostUsd || 0), 0)
        .toFixed(6)
    ),
    claimSupportRate:
      totalClaims > 0 ? Math.round((supportedClaims / totalClaims) * 100) : 0,
    citationCoverage:
      totalClaims > 0 ? Math.round((claimsWithSources / totalClaims) * 100) : 0,
    byMode: {
      single: modeSummary(scores, 'single'),
      debate: modeSummary(scores, 'debate'),
      verified: modeSummary(scores, 'verified'),
    },
  };
};

export const runEvaluationSuite = async (
  cases: EvaluationCase[],
  modes: EvaluationMode[],
  execute: EvaluationExecutor,
  onProgress?: (completed: number, total: number) => void
): Promise<{
  observations: EvaluationObservation[];
  scores: EvaluationScore[];
  summary: EvaluationSummary;
}> => {
  const observations: EvaluationObservation[] = [];
  const total = cases.length * modes.length;
  let completed = 0;

  for (const testCase of cases) {
    for (const mode of modes) {
      const result = await execute(testCase, mode);
      observations.push({
        caseId: testCase.id,
        mode,
        ...result,
      });
      completed += 1;
      onProgress?.(completed, total);
    }
  }

  const caseMap = new Map(cases.map((testCase) => [testCase.id, testCase]));
  const scores = observations.map((observation) => {
    const testCase = caseMap.get(observation.caseId);
    if (!testCase) {
      throw new Error(`Unknown evaluation case '${observation.caseId}'.`);
    }
    return scoreEvaluationObservation(testCase, observation);
  });

  return {
    observations,
    scores,
    summary: summarizeEvaluationScores(scores, observations),
  };
};
