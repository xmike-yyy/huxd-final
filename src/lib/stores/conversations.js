import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'bme_conversations';
const CURRENT_SESSION_KEY = 'bme_current_session';

/**
 * Create a conversation store that persists to localStorage
 * Supports multiple chat sessions
 */
function createConversationsStore() {
  // Load from localStorage (only in browser)
  const loadFromStorage = () => {
    if (!browser) return { sessions: {}, currentSessionId: null };

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const currentSessionId = localStorage.getItem(CURRENT_SESSION_KEY);

      if (stored) {
        return {
          sessions: JSON.parse(stored),
          currentSessionId: currentSessionId
        };
      }
    } catch (error) {
      console.error('Error loading conversations from storage:', error);
    }

    return { sessions: {}, currentSessionId: null };
  };

  const initial = loadFromStorage();
  const { subscribe, set, update } = writable(initial);

  // Save to localStorage on every change
  const saveToStorage = (value) => {
    if (!browser) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value.sessions));
      if (value.currentSessionId) {
        localStorage.setItem(CURRENT_SESSION_KEY, value.currentSessionId);
      } else {
        localStorage.removeItem(CURRENT_SESSION_KEY);
      }
    } catch (error) {
      console.error('Error saving conversations to storage:', error);
    }
  };

  subscribe(saveToStorage);

  return {
    subscribe,
    set,
    update,

    /**
     * Create a new chat session
     * @returns {string} The ID of the new session
     */
    createSession: () => {
      const sessionId = generateSessionId();
      update(state => {
        return {
          sessions: {
            ...state.sessions,
            [sessionId]: {
              id: sessionId,
              messages: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              title: 'New Conversation'
            }
          },
          currentSessionId: sessionId
        };
      });
      return sessionId;
    },

    /**
     * Switch to a different session
     * @param {string} sessionId - The session to switch to
     */
    setCurrentSession: (sessionId) => {
      update(state => {
        if (state.sessions[sessionId]) {
          return { ...state, currentSessionId: sessionId };
        }
        return state;
      });
    },

    /**
     * Add a message to the current session
     * @param {object} message - The message to add
     */
    addMessage: (message) => {
      update(state => {
        const { currentSessionId, sessions } = state;

        if (!currentSessionId || !sessions[currentSessionId]) {
          console.error('No current session');
          return state;
        }

        const session = sessions[currentSessionId];
        const updatedMessages = [...session.messages, message];

        // Auto-generate title from first user message if still "New Conversation"
        let title = session.title;
        if (title === 'New Conversation' && message.role === 'user') {
          title = generateTitle(message.content);
        }

        return {
          ...state,
          sessions: {
            ...sessions,
            [currentSessionId]: {
              ...session,
              messages: updatedMessages,
              updatedAt: new Date().toISOString(),
              title
            }
          }
        };
      });
    },

    /**
     * Delete a session
     * @param {string} sessionId - The session to delete
     */
    deleteSession: (sessionId) => {
      update(state => {
        const { sessions, currentSessionId } = state;
        const newSessions = { ...sessions };
        delete newSessions[sessionId];

        // If deleting current session, switch to another or null
        let newCurrentSessionId = currentSessionId;
        if (currentSessionId === sessionId) {
          const remainingIds = Object.keys(newSessions);
          newCurrentSessionId = remainingIds.length > 0 ? remainingIds[0] : null;
        }

        return {
          sessions: newSessions,
          currentSessionId: newCurrentSessionId
        };
      });
    },

    /**
     * Clear all messages in the current session
     */
    clearCurrentSession: () => {
      update(state => {
        const { currentSessionId, sessions } = state;

        if (!currentSessionId || !sessions[currentSessionId]) {
          return state;
        }

        return {
          ...state,
          sessions: {
            ...sessions,
            [currentSessionId]: {
              ...sessions[currentSessionId],
              messages: [],
              updatedAt: new Date().toISOString()
            }
          }
        };
      });
    },

    /**
     * Clear all data
     */
    clearAll: () => {
      if (browser) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(CURRENT_SESSION_KEY);
      }
      set({ sessions: {}, currentSessionId: null });
    },

    /**
     * Get the current session
     * @returns {object|null} The current session or null
     */
    getCurrentSession: () => {
      const state = get({ subscribe });
      const { currentSessionId, sessions } = state;
      return currentSessionId && sessions[currentSessionId]
        ? sessions[currentSessionId]
        : null;
    },

    /**
     * Get all sessions as an array, sorted by updatedAt
     * @returns {Array} Array of sessions
     */
    getAllSessions: () => {
      const state = get({ subscribe });
      return Object.values(state.sessions).sort((a, b) =>
        new Date(b.updatedAt) - new Date(a.updatedAt)
      );
    },

    /**
     * Update session title
     * @param {string} sessionId - The session to update
     * @param {string} title - The new title
     */
    updateSessionTitle: (sessionId, title) => {
      update(state => {
        const { sessions } = state;

        if (!sessions[sessionId]) {
          return state;
        }

        return {
          ...state,
          sessions: {
            ...sessions,
            [sessionId]: {
              ...sessions[sessionId],
              title,
              updatedAt: new Date().toISOString()
            }
          }
        };
      });
    },

    /**
     * Export current session to JSON
     * @returns {string} JSON string of current session
     */
    exportCurrentSession: () => {
      const state = get({ subscribe });
      const { currentSessionId, sessions } = state;

      if (!currentSessionId || !sessions[currentSessionId]) {
        return null;
      }

      return JSON.stringify(sessions[currentSessionId], null, 2);
    },

    /**
     * Export current session to Markdown
     * @returns {string} Markdown string of current session
     */
    exportCurrentSessionMarkdown: () => {
      const state = get({ subscribe });
      const { currentSessionId, sessions } = state;

      if (!currentSessionId || !sessions[currentSessionId]) {
        return null;
      }

      const session = sessions[currentSessionId];
      let md = `# ${session.title}\n\n`;
      md += `**Created:** ${new Date(session.createdAt).toLocaleDateString()}\n\n`;
      md += `---\n\n`;

      session.messages.forEach(msg => {
        const role = msg.role === 'user' ? 'You' : `Assistant (${msg.frame || 'unknown'})`;
        md += `## ${role}\n\n`;
        md += `${msg.content}\n\n`;
      });

      return md;
    }
  };
}

/**
 * Generate a unique session ID
 */
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a title from the first user message
 * @param {string} message - The message content
 * @returns {string} A short title
 */
function generateTitle(message) {
  // Take first 50 characters and add ellipsis if needed
  const title = message.trim().substring(0, 50);
  return title.length < message.trim().length ? `${title}...` : title;
}

// Export the store
export const conversations = createConversationsStore();
