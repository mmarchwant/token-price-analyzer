export function isNeedsVerification(lastVerifiedStr: string, nowMs: number = Date.now()): boolean {
  const verifiedMs = Date.parse(lastVerifiedStr);
  if (isNaN(verifiedMs)) return true;
  const diffDays = (nowMs - verifiedMs) / (1000 * 60 * 60 * 24);
  return diffDays > 45;
}
