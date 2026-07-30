import type {
  AnalystResponse,
  ClaimExtractionResponse,
  ClaimSynthesisResponse,
  ClaimVerificationResponse,
  ExtractedClaim,
  GenericAgentResponse,
  InspectionResponse,
  JudgeResponse,
  SkepticResponse,
  ValidatorResponse,
} from '../types.js';

export class ResponseValidationError extends Error {
  constructor(message: string) {
    super(`Invalid model response: ${message}`);
    this.name = 'ResponseValidationError';
  }
}

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ResponseValidationError('expected a JSON object.');
  }
  return value as Record<string, unknown>;
};

const readString = (
  value: unknown,
  field: string,
  allowEmpty = false
): string => {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) {
    throw new ResponseValidationError(`${field} must be a non-empty string.`);
  }
  return value;
};

const readBoolean = (value: unknown, field: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new ResponseValidationError(`${field} must be a boolean.`);
  }
  return value;
};

const readNumber = (
  value: unknown,
  field: string,
  min?: number,
  max?: number
): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ResponseValidationError(`${field} must be a finite number.`);
  }
  if (min !== undefined && value < min) {
    throw new ResponseValidationError(`${field} must be at least ${min}.`);
  }
  if (max !== undefined && value > max) {
    throw new ResponseValidationError(`${field} must be at most ${max}.`);
  }
  return value;
};

const readStringArray = (value: unknown, field: string): string[] => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new ResponseValidationError(`${field} must be an array of strings.`);
  }
  return value as string[];
};

export const assertAnalystResponse = (value: unknown): AnalystResponse => {
  const record = asRecord(value);
  return {
    evidence_summary: readString(
      record.evidence_summary,
      'evidence_summary'
    ),
    factual_answer: readString(record.factual_answer, 'factual_answer'),
    confidence: readNumber(record.confidence, 'confidence', 0, 100),
  };
};

export const assertSkepticResponse = (value: unknown): SkepticResponse => {
  const record = asRecord(value);
  return {
    analysis: readString(record.analysis, 'analysis'),
    has_flaws: readBoolean(record.has_flaws, 'has_flaws'),
    flaws: readStringArray(record.flaws, 'flaws'),
    correction: readString(record.correction, 'correction', true),
  };
};

export const assertJudgeResponse = (value: unknown): JudgeResponse => {
  const record = asRecord(value);
  return {
    debate_summary: readString(record.debate_summary, 'debate_summary'),
    final_verdict: readString(record.final_verdict, 'final_verdict'),
    is_conclusive: readBoolean(record.is_conclusive, 'is_conclusive'),
  };
};

export const assertValidatorResponse = (
  value: unknown
): ValidatorResponse => {
  const record = asRecord(value);
  const status = record.verification_status;
  if (
    status !== 'CONFIRMED' &&
    status !== 'CORRECTED' &&
    status !== 'UNVERIFIED'
  ) {
    throw new ResponseValidationError(
      "verification_status must be 'CONFIRMED', 'CORRECTED', or 'UNVERIFIED'."
    );
  }

  return {
    verification_status: status,
    reasoning: readString(record.reasoning, 'reasoning'),
    final_output: readString(record.final_output, 'final_output'),
  };
};

export const assertClaimExtractionResponse = (
  value: unknown
): ClaimExtractionResponse => {
  const record = asRecord(value);
  if (!Array.isArray(record.claims)) {
    throw new ResponseValidationError('claims must be an array.');
  }
  if (record.claims.length > 6) {
    throw new ResponseValidationError('claims must contain at most six items.');
  }

  const seenIds = new Set<string>();
  const claims: ExtractedClaim[] = record.claims.map(
    (item, index): ExtractedClaim => {
      const claim = asRecord(item);
      const id = readString(claim.id, `claims[${index}].id`).trim();
      const normalizedId = id.toLowerCase();
      if (seenIds.has(normalizedId)) {
        throw new ResponseValidationError(`claim id '${id}' must be unique.`);
      }
      seenIds.add(normalizedId);

      const rawImportance = claim.importance;
      if (rawImportance !== 'primary' && rawImportance !== 'supporting') {
        throw new ResponseValidationError(
          `claims[${index}].importance must be 'primary' or 'supporting'.`
        );
      }
      const importance: ExtractedClaim['importance'] = rawImportance;

      return {
        id,
        text: readString(claim.text, `claims[${index}].text`).trim(),
        importance,
        verifiable: readBoolean(
          claim.verifiable,
          `claims[${index}].verifiable`
        ),
      };
    }
  );

  return { claims };
};

export const assertClaimVerificationResponse = (
  value: unknown
): ClaimVerificationResponse => {
  const record = asRecord(value);
  const status = record.status;
  const allowedStatuses = [
    'SUPPORTED',
    'CONTRADICTED',
    'MIXED',
    'NOT_FOUND',
    'NOT_VERIFIABLE',
  ] as const;

  if (!allowedStatuses.includes(status as (typeof allowedStatuses)[number])) {
    throw new ResponseValidationError(
      `status must be one of ${allowedStatuses.join(', ')}.`
    );
  }

  const correctedClaim = readString(
    record.corrected_claim,
    'corrected_claim',
    true
  ).trim();

  if (status === 'CONTRADICTED' && !correctedClaim) {
    throw new ResponseValidationError(
      'corrected_claim is required when status is CONTRADICTED.'
    );
  }

  return {
    status: status as ClaimVerificationResponse['status'],
    rationale: readString(record.rationale, 'rationale').trim(),
    corrected_claim: correctedClaim,
  };
};

export const assertClaimSynthesisResponse = (
  value: unknown
): ClaimSynthesisResponse => {
  const record = asRecord(value);
  return {
    reasoning: readString(record.reasoning, 'reasoning').trim(),
    final_output: readString(record.final_output, 'final_output').trim(),
  };
};

export const assertGenericAgentResponse = (
  value: unknown
): GenericAgentResponse => {
  const record = asRecord(value);
  const metaData = record.meta_data;
  if (
    metaData !== undefined &&
    (typeof metaData !== 'object' || metaData === null || Array.isArray(metaData))
  ) {
    throw new ResponseValidationError('meta_data must be an object when provided.');
  }

  return {
    work_summary: readString(record.work_summary, 'work_summary'),
    output: readString(record.output, 'output'),
    ...(metaData !== undefined
      ? { meta_data: metaData as Record<string, unknown> }
      : {}),
  };
};

export const assertInspectionResponse = (
  value: unknown
): InspectionResponse => {
  const record = asRecord(value);
  return {
    response: readString(record.response, 'response'),
    internal_state: readString(record.internal_state, 'internal_state'),
  };
};
