import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'bme_reflections';

/**
 * Create a reflections store for user's personal reflections
 */
function createReflectionsStore() {
  // Load from localStorage
  const loadFromStorage = () => {
    if (!browser) return { items: [], summary: '', lastSummarizedAt: null };

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Backward compatibility: if it's an array, convert to new structure
        if (Array.isArray(parsed)) {
          return { items: parsed, summary: '', lastSummarizedAt: null };
        }
        return parsed;
      }
    } catch (error) {
      console.error('Error loading reflections from storage:', error);
    }

    return { items: [], summary: '', lastSummarizedAt: null };
  };

  const initial = loadFromStorage();
  const { subscribe, set, update } = writable(initial);

  // Save to localStorage on every change
  const saveToStorage = (value) => {
    if (!browser) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (error) {
      console.error('Error saving reflections to storage:', error);
    }
  };

  subscribe(saveToStorage);

  return {
    subscribe,
    set,
    update,

    /**
     * Add a new reflection
     * @param {string} content - The reflection text
     * @param {string} mood - Optional mood (frustrated, hopeful, etc.)
     */
    addReflection: (content, mood = null) => {
      const reflection = {
        id: `reflection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: content.trim(),
        mood,
        createdAt: new Date().toISOString()
      };

      update(state => ({
        ...state,
        items: [reflection, ...state.items]
      }));
      return reflection.id;
    },

    /**
     * Delete a reflection
     * @param {string} id - The reflection ID
     */
    deleteReflection: (id) => {
      update(state => ({
        ...state,
        items: state.items.filter(r => r.id !== id)
      }));
    },

    /**
     * Update the reflection summary
     * @param {string} newSummary - The summarized text
     */
    updateSummary: (newSummary) => {
      update(state => ({
        ...state,
        summary: newSummary,
        lastSummarizedAt: new Date().toISOString()
      }));
    },

    /**
     * Clear all reflections
     */
    clearAll: () => {
      if (browser) {
        localStorage.removeItem(STORAGE_KEY);
      }
      set({ items: [], summary: '', lastSummarizedAt: null });
    },

    /**
     * Get reflections sorted by date
     * @returns {Array} Sorted reflections
     */
    getSorted: () => {
      const state = get({ subscribe });
      return state.items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  };
}

// Export the store
export const reflections = createReflectionsStore();
