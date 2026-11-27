import { useEffect, useMemo, useState } from 'react';
import { isAbortError } from '../../shared/api';
import { formatServerMaskedText, maskContactInfo, MaskingError, type KnownNames } from '../pii/masking';
import {
  COMPLAINT_TITLE_MAX_LENGTH, parentComplaintApi,
  type ComplaintMaskPreviewRequest, type ComplaintMaskPreviewResponse, type ComplaintMaskPreviewTarget,
} from './api/parentComplaintApi';
import { MESSAGE_MAX_LENGTH } from './parentMessageTypes';

export async function getMaskingPreview(request: ComplaintMaskPreviewRequest, signal?: AbortSignal) {
  let preview: ComplaintMaskPreviewResponse;
  try {
    preview = await parentComplaintApi.previewMasking(request, signal);
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new MaskingError();
  }
  if (typeof preview?.title !== 'string' || typeof preview.content !== 'string' ||
    !Number.isSafeInteger(preview.titleCount) || preview.titleCount < 0 ||
    !Number.isSafeInteger(preview.contentCount) || preview.contentCount < 0) {
    throw new MaskingError();
  }
  return preview;
}

export function combineMaskingPreview(
  title: string, content: string, names: KnownNames, server?: ComplaintMaskPreviewResponse,
): ComplaintMaskPreviewResponse {
  const localTitle = maskContactInfo(server ? formatServerMaskedText(server.title) : title, names);
  const localContent = maskContactInfo(server ? formatServerMaskedText(server.content) : content, names);
  return {
    title: localTitle.text,
    content: localContent.text,
    titleCount: localTitle.count + (server?.titleCount ?? 0),
    contentCount: localContent.count + (server?.contentCount ?? 0),
  };
}

export function useMaskingPreview(target: ComplaintMaskPreviewTarget | undefined, title: string, content: string) {
  const { complaintId, studentId, teacherId } = target ?? {};
  const request = useMemo<ComplaintMaskPreviewRequest | null>(() => {
    if ((!title.trim() && !content.trim()) ||
      title.length > COMPLAINT_TITLE_MAX_LENGTH || content.length > MESSAGE_MAX_LENGTH) return null;
    if (complaintId) return { complaintId, title, content };
    return studentId && teacherId ? { studentId, teacherId, title, content } : null;
  }, [complaintId, studentId, teacherId, title, content]);
  const [attempt, setAttempt] = useState(0);
  const [completed, setCompleted] = useState<{
    request: ComplaintMaskPreviewRequest; attempt: number; result?: ComplaintMaskPreviewResponse;
  }>();

  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void getMaskingPreview(request, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setCompleted({ request, attempt, result });
        })
        .catch(() => {
          if (!controller.signal.aborted) setCompleted({ request, attempt });
        });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [request, attempt]);

  const current = request && completed?.request === request && completed.attempt === attempt ? completed : undefined;
  return {
    result: current?.result,
    status: request ? current ? current.result ? 'ready' as const : 'failed' as const : 'pending' as const : undefined,
    retry: () => setAttempt((previous) => previous + 1),
  };
}
