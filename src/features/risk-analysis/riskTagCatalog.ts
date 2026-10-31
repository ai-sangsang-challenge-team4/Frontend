import { apiClient, isAbortError } from '../../shared/api';

export type RiskTag = { id: number; code: string; name: string; defaultScore: number };
export type RiskTagNames = Record<string, string>;

// Catalog availability must not prevent viewing or submitting an existing analysis.
export async function getRiskTagNames(signal?: AbortSignal): Promise<RiskTagNames> {
  try {
    const tags = await apiClient.get<RiskTag[]>('/risk-tags', { signal });
    return Object.fromEntries(tags.filter((tag) => tag != null && typeof tag.code === 'string' && typeof tag.name === 'string' && tag.name.trim())
      .map((tag) => [tag.code, tag.name.trim()]));
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) throw error;
    return {};
  }
}
