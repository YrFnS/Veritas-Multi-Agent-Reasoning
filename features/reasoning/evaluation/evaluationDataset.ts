import type { EvaluationCase } from './evaluationHarness.js';

export const EVALUATION_DATASET: EvaluationCase[] = [
  {
    id: 'stable-gold-symbol',
    category: 'stable_fact',
    prompt: 'What is the chemical symbol for gold?',
    description: 'Simple stable fact with an unambiguous answer.',
    expectation: {
      requiredTerms: ['Au'],
    },
    modeExpectations: {
      verified: {
        acceptableStatuses: ['verified', 'corrected'],
        minimumClaimCount: 1,
        minimumCitationCoverage: 100,
        requiresSourceBackedClaims: true,
      },
    },
  },
  {
    id: 'stable-water-formula',
    category: 'stable_fact',
    prompt: 'What is the molecular formula of water?',
    description: 'Stable scientific fact used as a basic regression case.',
    expectation: {
      requiredTerms: ['H2O'],
    },
    modeExpectations: {
      verified: {
        acceptableStatuses: ['verified', 'corrected'],
        minimumClaimCount: 1,
        minimumCitationCoverage: 100,
      },
    },
  },
  {
    id: 'citation-who-founded',
    category: 'citation_required',
    prompt: 'In what year was the World Health Organization founded? Cite reliable evidence.',
    description: 'A stable historical fact that should be connected to evidence.',
    expectation: {
      requiredTerms: ['1948'],
    },
    modeExpectations: {
      verified: {
        acceptableStatuses: ['verified', 'corrected'],
        minimumClaimCount: 1,
        minimumCitationCoverage: 100,
        requiresSourceBackedClaims: true,
      },
    },
  },
  {
    id: 'current-who-leader',
    category: 'current_fact',
    prompt: 'Who currently leads the World Health Organization?',
    description: 'Time-sensitive office-holder question that requires current evidence.',
    expectation: {},
    modeExpectations: {
      verified: {
        acceptableStatuses: ['verified', 'corrected'],
        minimumClaimCount: 1,
        minimumCitationCoverage: 100,
        requiresSourceBackedClaims: true,
      },
    },
  },
  {
    id: 'current-node-version',
    category: 'current_fact',
    prompt: 'What is the current stable Node.js release line?',
    description: 'Rapidly changing software fact that should never rely on stale memory.',
    expectation: {},
    modeExpectations: {
      verified: {
        acceptableStatuses: ['verified', 'corrected'],
        minimumClaimCount: 1,
        minimumCitationCoverage: 100,
      },
    },
  },
  {
    id: 'false-premise-great-wall',
    category: 'false_premise',
    prompt: 'Explain why the Great Wall of China is visible from the Moon with the naked eye.',
    description: 'The system should reject the false premise rather than explain it.',
    expectation: {
      requiredTerms: ['myth'],
      forbiddenTerms: ['because it is visible from the moon'],
    },
    modeExpectations: {
      verified: {
        minimumClaimCount: 1,
        minimumCitationCoverage: 100,
      },
    },
  },
  {
    id: 'ambiguous-springfield',
    category: 'ambiguous',
    prompt: 'How many people live in Springfield?',
    description: 'The place name is ambiguous and should trigger clarification or qualified uncertainty.',
    expectation: {
      acceptableStatuses: [
        'unverified',
        'disputed',
        'insufficient_evidence',
      ],
    },
  },
  {
    id: 'unknown-private-thought',
    category: 'insufficient_evidence',
    prompt: 'What exact number am I thinking of right now?',
    description: 'No external evidence can establish the requested answer.',
    expectation: {
      acceptableStatuses: ['unverified', 'insufficient_evidence'],
      requiredTerms: ['cannot'],
    },
  },
  {
    id: 'conflicting-universal-coffee',
    category: 'conflicting_evidence',
    prompt: 'Is drinking coffee beneficial for every person in all circumstances?',
    description: 'An overbroad health claim should be qualified rather than made universal.',
    expectation: {
      acceptableStatuses: [
        'unverified',
        'disputed',
        'insufficient_evidence',
        'corrected',
      ],
      requiredTerms: ['not'],
    },
  },
  {
    id: 'multilingual-arabic-gold',
    category: 'multilingual',
    prompt: 'ما هو الرمز الكيميائي للذهب؟',
    description: 'Arabic stable-fact regression case.',
    expectation: {
      requiredTerms: ['Au'],
    },
    modeExpectations: {
      verified: {
        acceptableStatuses: ['verified', 'corrected'],
        minimumClaimCount: 1,
        minimumCitationCoverage: 100,
      },
    },
  },
];
