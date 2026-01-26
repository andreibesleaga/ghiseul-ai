// src/store/index.js
import { createStore } from 'vuex'
import chatHistoryStore from './chatHistoryStore'
import auth from './modules/auth'

// Create and export the store
export default createStore({
  modules: {
    chatHistory: chatHistoryStore,
    auth,
  },

  plugins: [
    store => {
      // Initialize state from localStorage if available
      try {
        const savedChatHistory = localStorage.getItem('chatHistory');
        if (savedChatHistory) {
          const parsedData = JSON.parse(savedChatHistory);
          if (parsedData && typeof parsedData === 'object') {
            store.replaceState({
              ...store.state,
              chatHistory: parsedData,
            });
          }
        }
      } catch (e) {
        console.error('Error loading chat history from localStorage:', e);
      }

      // Save state to localStorage when it changes
      store.subscribe((mutation, state) => {
        if (mutation.type.startsWith('chatHistory/')) {
          try {
            if (mutation.type === 'chatHistory/CLEAR_FOLDERS') {
              localStorage.removeItem('chatHistory');
              console.log('Cleared chatHistory from localStorage due to CLEAR_FOLDERS');
            } else {
              localStorage.setItem('chatHistory', JSON.stringify(state.chatHistory));
            }
          } catch (e) {
            console.error('Error saving chat history to localStorage:', e);
          }
        }
      });
    },
  ],
});