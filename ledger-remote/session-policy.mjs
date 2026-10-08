export const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
export function createSession(user, now = Date.now()) { return {user, expires: now + IDLE_TIMEOUT_MS}; }
export function isSessionExpired(session, now = Date.now()) { return !session || now >= session.expires; }
export function recordSessionActivity(session, now = Date.now()) {
 if (isSessionExpired(session, now)) return false;
 session.expires = now + IDLE_TIMEOUT_MS;
 return true;
}
