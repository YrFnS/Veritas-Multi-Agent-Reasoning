import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { EVALUATION_DATASET } from '../.test-dist/features/reasoning/evaluation/evaluationDataset.js';
import {
  scoreEvaluationObservation,
  summarizeEvaluationScores,
} from '../.test-dist/features/reasoning/evaluation/evaluationHarness.js';

const inputPath = process.argv[2];

if (!inputPath) {
  console.error('Usage: npm run evaluate -- path/to/evaluation-observations.json');
  process.exit(1);
}

const absolutePath = path.resolve(process.cwd(), inputPath);
const raw = await fs.readFile(absolutePath, 'utf8');
const observations = JSON.parse(raw);

if (!Array.isArray(observations)) {
  throw new Error('Evaluation input must be a JSON array of observations.');
}

const caseMap = new Map(EVALUATION_DATASET.map((testCase) => [testCase.id, testCase]));
const scores = observations.map((observation) => {
  const testCase = caseMap.get(observation.caseId);
  if (!testCase) {
    throw new Error(`Unknown evaluation case '${observation.caseId}'.`);
  }
  return scoreEvaluationObservation(testCase, observation);
});

const summary = summarizeEvaluationScores(scores, observations);
const failures = scores
  .filter((score) => !score.passed)
  .map((score) => ({
    caseId: score.caseId,
    mode: score.mode,
    score: score.score,
    failedChecks: score.checks.filter((check) => !check.passed),
  }));

console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      input: absolutePath,
      summary,
      failures,
      scores,
    },
    null,
    2
  )
);

if (failures.length > 0) {
  process.exitCode = 2;
}
