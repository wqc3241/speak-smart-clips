import type { ConversationSession } from '@/types/conversation';

const STORAGE_KEY = 'speak-smart-conversation-history';
const MAX_SESSIONS = 50;

export function saveSession(session: ConversationSession): void {
  const sessions = loadSessions();
  const existingIndex = sessions.findIndex(s => s.id === session.id);

  if (existingIndex >= 0) {
    sessions[existingIndex] = session;
  } else {
    sessions.unshift(session);
  }

  // Keep only the most recent sessions (FIFO)
  const trimmed = sessions.slice(0, MAX_SESSIONS);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Failed to save conversation session:', e);
  }
}

export function loadSessions(): ConversationSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function deleteSession(sessionId: string): void {
  const sessions = loadSessions().filter(s => s.id !== sessionId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error('Failed to delete conversation session:', e);
  }
}

export function clearAllSessions(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear conversation sessions:', e);
  }
}
