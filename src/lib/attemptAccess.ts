export function canReadAttempt(
  attemptLearnerId: string | null,
  viewerLearnerId: string | null,
  hasStudioAccess: boolean
): boolean {
  return hasStudioAccess || Boolean(viewerLearnerId && attemptLearnerId === viewerLearnerId);
}
