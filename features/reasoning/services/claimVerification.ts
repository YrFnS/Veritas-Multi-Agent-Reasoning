import type {
  ClaimVerificationResponse,
  ClaimVerificationStatus,
  ClaimVerificationSummary,
  ExtractedClaim,
  SourceMetadata,
  VerificationStatus,
  VerifiedClaim,
} from '../types.js';
import { dedupeSources } from './sourceUtils.js';

export const createEmptyClaimSummary = (): ClaimVerificationSummary => ({
  totalClaims: 0,
  verifiableClaims: 0,
  supportedClaims: 0,
  contradictedClaims: 0,
  mixedClaims: 0,
  notFoundClaims: 0,
  notVerifiableClaims: 0,
  claimsWithSources: 0,
  citationCoverage: 0,
  supportCoverage: 0,
  independentDomains: 0,
});

const mapStatus = (
  status: ClaimVerificationResponse['status']
): ClaimVerificationStatus => {
  const statuses: Record<
    ClaimVerificationResponse['status'],
    ClaimVerificationStatus
  > = {
    SUPPORTED: 'supported',
    CONTRADICTED: 'contradicted',
    MIXED: 'mixed',
    NOT_FOUND: 'not_found',
    NOT_VERIFIABLE: 'not_verifiable',
  };
  return statuses[status];
};

const sourceDomain = (source: SourceMetadata): string | null => {
  const uri = source.web?.uri;
  if (!uri) return null;

  try {
    return new URL(uri).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
};

export const buildVerifiedClaim = (
  claim: ExtractedClaim,
  response: ClaimVerificationResponse,
  responseSources: SourceMetadata[] | undefined
): VerifiedClaim => {
  const sources = dedupeSources(responseSources);
  let status = claim.verifiable ? mapStatus(response.status) : 'not_verifiable';
  let rationale = response.rationale.trim();

  if (
    sources.length === 0 &&
    (status === 'supported' ||
      status === 'contradicted' ||
      status === 'mixed')
  ) {
    status = 'not_found';
    rationale = `${rationale} No external source metadata was attached, so the evidence judgment was downgraded.`;
  }

  const correctedText = response.corrected_claim.trim();

  return {
    id: claim.id,
    text: claim.text,
    importance: claim.importance,
    status,
    rationale,
    ...(correctedText ? { correctedText } : {}),
    sources,
  };
};

const percentage = (numerator: number, denominator: number): number =>
  denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;

export const summarizeClaimVerification = (
  claims: VerifiedClaim[]
): ClaimVerificationSummary => {
  const summary = createEmptyClaimSummary();
  summary.totalClaims = claims.length;

  const domains = new Set<string>();

  for (const claim of claims) {
    if (claim.status !== 'not_verifiable') summary.verifiableClaims += 1;
    if (claim.status === 'supported') summary.supportedClaims += 1;
    if (claim.status === 'contradicted') summary.contradictedClaims += 1;
    if (claim.status === 'mixed') summary.mixedClaims += 1;
    if (claim.status === 'not_found') summary.notFoundClaims += 1;
    if (claim.status === 'not_verifiable') summary.notVerifiableClaims += 1;
    if (claim.sources.length > 0) summary.claimsWithSources += 1;

    for (const source of claim.sources) {
      const domain = sourceDomain(source);
      if (domain) domains.add(domain);
    }
  }

  summary.citationCoverage = percentage(
    summary.claimsWithSources,
    summary.verifiableClaims
  );
  summary.supportCoverage = percentage(
    summary.supportedClaims,
    summary.verifiableClaims
  );
  summary.independentDomains = domains.size;

  return summary;
};

export const deriveClaimVerificationStatus = (
  summary: ClaimVerificationSummary
): Exclude<VerificationStatus, null> => {
  if (summary.totalClaims === 0 || summary.verifiableClaims === 0) {
    return 'UNVERIFIED';
  }

  if (summary.contradictedClaims > 0) return 'CORRECTED';

  if (summary.mixedClaims > 0 || summary.notFoundClaims > 0) {
    return 'UNVERIFIED';
  }

  if (
    summary.supportedClaims === summary.verifiableClaims &&
    summary.claimsWithSources === summary.verifiableClaims
  ) {
    return 'CONFIRMED';
  }

  return 'UNVERIFIED';
};

export const isClaimVerificationConclusive = (
  claims: VerifiedClaim[]
): boolean => {
  const primaryClaims = claims.filter((claim) => claim.importance === 'primary');
  const materialClaims = primaryClaims.length > 0 ? primaryClaims : claims;

  if (materialClaims.length === 0) return false;

  return materialClaims.every((claim) => {
    if (claim.status === 'supported') return true;
    return claim.status === 'contradicted' && Boolean(claim.correctedText?.trim());
  });
};

export const collectClaimSources = (
  claims: VerifiedClaim[]
): SourceMetadata[] => dedupeSources(claims.flatMap((claim) => claim.sources));

export const buildClaimVerificationReport = (
  claims: VerifiedClaim[]
): string =>
  JSON.stringify(
    claims.map((claim) => ({
      id: claim.id,
      original_claim: claim.text,
      importance: claim.importance,
      status: claim.status,
      rationale: claim.rationale,
      corrected_claim: claim.correctedText || '',
      sources: claim.sources.map((source) => ({
        title: source.web?.title || '',
        uri: source.web?.uri || '',
      })),
    })),
    null,
    2
  );
