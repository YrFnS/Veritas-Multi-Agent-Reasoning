export interface SpeechRecognitionAlternativeLike {
  transcript?: unknown;
}

export interface SpeechRecognitionResultLike {
  readonly isFinal?: unknown;
  readonly [index: number]: SpeechRecognitionAlternativeLike | undefined;
}

export interface SpeechRecognitionEventLike {
  readonly resultIndex?: unknown;
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}

export const readFinalSpeechTranscript = (
  event: SpeechRecognitionEventLike
): string => {
  const startIndex =
    typeof event.resultIndex === 'number' &&
    Number.isInteger(event.resultIndex) &&
    event.resultIndex >= 0
      ? event.resultIndex
      : 0;
  const finalSegments: string[] = [];

  for (let index = startIndex; index < event.results.length; index += 1) {
    const result = event.results[index];
    if (!result?.isFinal) continue;

    const transcript = result[0]?.transcript;
    if (typeof transcript === 'string' && transcript.trim()) {
      finalSegments.push(transcript.trim());
    }
  }

  return finalSegments.join(' ').trim();
};
