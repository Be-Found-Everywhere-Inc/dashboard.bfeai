/**
 * Session Management
 * Tracks active sessions and enforces max concurrent sessions per user
 */

interface Session {
  sessionId: string;
  userId: string;
  createdAt: number;
  lastActivity: number;
  userAgent: string;
  ipAddress: string;
}

// In-memory store for active sessions (use Redis/database in production)
const activeSessions = new Map<string, Session[]>();

// Configuration
const MAX_SESSIONS_PER_USER = 3;
const SESSION_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Create a new session for a user
 * Removes oldest session if max limit is reached
 */
export function createSession(
  userId: string,
  sessionId: string,
  userAgent: string,
  ipAddress: string
): void {
  const now = Date.now();

  // Get existing sessions for user
  let userSessions = activeSessions.get(userId) || [];

  // Remove expired sessions
  userSessions = userSessions.filter(
    (session) => now - session.lastActivity < SESSION_TIMEOUT_MS
  );

  // If max sessions reached, remove oldest session
  if (userSessions.length >= MAX_SESSIONS_PER_USER) {
    // Sort by creation time and remove oldest
    userSessions.sort((a, b) => a.createdAt - b.createdAt);
    userSessions.shift(); // Remove oldest
  }

  // Add new session
  userSessions.push({
    sessionId,
    userId,
    createdAt: now,
    lastActivity: now,
    userAgent,
    ipAddress,
  });

  activeSessions.set(userId, userSessions);
}

/**
 * Update session activity timestamp
 */
export function updateSessionActivity(userId: string, sessionId: string): boolean {
  const userSessions = activeSessions.get(userId);

  if (!userSessions) {
    return false;
  }

  const session = userSessions.find((s) => s.sessionId === sessionId);

  if (!session) {
    return false;
  }

  session.lastActivity = Date.now();
  return true;
}

/**
 * Remove a specific session
 */
export function removeSession(userId: string, sessionId: string): boolean {
  const userSessions = activeSessions.get(userId);

  if (!userSessions) {
    return false;
  }

  const updatedSessions = userSessions.filter((s) => s.sessionId !== sessionId);

  if (updatedSessions.length === userSessions.length) {
    // Session not found
    return false;
  }

  if (updatedSessions.length === 0) {
    activeSessions.delete(userId);
  } else {
    activeSessions.set(userId, updatedSessions);
  }

  return true;
}

/**
 * Remove all sessions for a user
 */
export function removeAllUserSessions(userId: string): number {
  const userSessions = activeSessions.get(userId);

  if (!userSessions) {
    return 0;
  }

  const count = userSessions.length;
  activeSessions.delete(userId);
  return count;
}

/**
 * Check if a session is valid
 */
export function isSessionValid(userId: string, sessionId: string): boolean {
  const userSessions = activeSessions.get(userId);

  if (!userSessions) {
    return false;
  }

  const session = userSessions.find((s) => s.sessionId === sessionId);

  if (!session) {
    return false;
  }

  // Check if session has expired
  const now = Date.now();
  if (now - session.lastActivity > SESSION_TIMEOUT_MS) {
    // Remove expired session
    removeSession(userId, sessionId);
    return false;
  }

  return true;
}

/**
 * Get all active sessions for a user
 */
export function getUserSessions(userId: string): Array<{
  sessionId: string;
  createdAt: Date;
  lastActivity: Date;
  userAgent: string;
  ipAddress: string;
}> {
  const userSessions = activeSessions.get(userId) || [];
  const now = Date.now();

  // Filter expired sessions
  const validSessions = userSessions.filter(
    (session) => now - session.lastActivity < SESSION_TIMEOUT_MS
  );

  // Update map if sessions were removed
  if (validSessions.length !== userSessions.length) {
    if (validSessions.length === 0) {
      activeSessions.delete(userId);
    } else {
      activeSessions.set(userId, validSessions);
    }
  }

  return validSessions.map((session) => ({
    sessionId: session.sessionId,
    createdAt: new Date(session.createdAt),
    lastActivity: new Date(session.lastActivity),
    userAgent: session.userAgent,
    ipAddress: session.ipAddress,
  }));
}

/**
 * Get session count for a user
 */
export function getSessionCount(userId: string): number {
  return getUserSessions(userId).length;
}

/**
 * Clean up expired sessions (call periodically)
 */
export function cleanupExpiredSessions(): void {
  const now = Date.now();

  for (const [userId, sessions] of activeSessions.entries()) {
    const validSessions = sessions.filter(
      (session) => now - session.lastActivity < SESSION_TIMEOUT_MS
    );

    if (validSessions.length === 0) {
      activeSessions.delete(userId);
    } else if (validSessions.length !== sessions.length) {
      activeSessions.set(userId, validSessions);
    }
  }
}

// Run cleanup every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredSessions, 10 * 60 * 1000);
}
