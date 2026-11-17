export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY';

export type RiskTagCode =
  | 'EMOTIONAL_EXPRESSION'
  | 'PERSONAL_ATTACK'
  | 'THREAT'
  | 'LEGAL_ADMINISTRATIVE_ACTION'
  | 'PUBLIC_DISCLOSURE_THREAT'
  | 'REPETITION'
  | 'UNREASONABLE_DEMAND'
  | 'PERSONAL_INFORMATION_RISK';

export type RiskFactorStatus = 'PRESENT' | 'ABSENT' | 'BOUNDARY' | 'UNKNOWN';

export type AiAnalysisStatus =
  | 'COMPLETED'
  | 'REUSED'
  | 'REUSED_RULE_ONLY'
  | 'RULE_ONLY_AI_UNAVAILABLE'
  | 'RULE_ONLY_INVALID_RESPONSE'
  | 'SKIPPED_LIMIT';

// Optional for analyses created before the fallback policy was introduced.
export type RiskAnalysisMetadata = {
  aiAnalysisStatus?: AiAnalysisStatus | null;
  analysisMode?: 'HYBRID' | 'RULE_ONLY' | null;
  manualReviewRequired?: boolean;
  analysisMessage?: string | null;
};

export type SafetyFlags = {
  credibleThreat?: boolean | null;
  studentSafetyConcern?: boolean | null;
  privacyExposure?: boolean | null;
};
