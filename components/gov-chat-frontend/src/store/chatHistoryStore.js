// src/store/chatHistoryStore.js
import { v4 as uuidv4 } from 'uuid';
import chatHistoryService from '@/services/chatHistoryService'; // Adjust path
import userService from '@/services/userService';

export default {
  namespaced: true,

  state: () => ({
    folders: [
      {
        id: 'default',
        name: 'All Chats',
        isDefault: true,
        createdAt: new Date().toISOString(),
      },
    ],
    chats: [],
    folderChats: {
      default: [],
    },
  }),

  getters: {
    getAllFolders: (state) => state.folders,
    getChatsByFolderId: (state) => (folderId) => {
      const chatIds = state.folderChats[folderId] || [];
      return chatIds
        .map((chatId) => state.chats.find((chat) => chat.id === chatId))
        .filter((chat) => chat !== undefined);
    },
    getFolderById: (state) => (folderId) => state.folders.find((folder) => folder.id === folderId),
    getChatById: (state) => (chatId) => state.chats.find((chat) => chat.id === chatId),
  },

  mutations: {
    setFolders(state, folders) {
      console.log("setFolders mutation received:", folders);
      state.folders = [...folders];
    },

    SET_FOLDER_CHATS(state, { folderId, chats }) {
      console.log(`Setting chats for folder ${folderId}:`, chats);
      state.folderChats[folderId] = chats;
    },

    ADD_FOLDER(state, folderData) {
      const newFolder = {
        id: uuidv4(),
        name: folderData.name,
        isDefault: false,
        createdAt: new Date().toISOString(),
      };
      state.folders.push(newFolder);
      state.folderChats[newFolder.id] = [];
      return newFolder.id;
    },

    UPDATE_FOLDER(state, { folderId, name }) {
      const folderIndex = state.folders.findIndex((f) => f.id === folderId);
      if (folderIndex !== -1 && !state.folders[folderIndex].isDefault) {
        state.folders[folderIndex] = { ...state.folders[folderIndex], name };
      }
    },

    REMOVE_FOLDER(state, folderId) {
      const folderIndex = state.folders.findIndex((f) => f.id === folderId);
      if (folderIndex !== -1 && !state.folders[folderIndex].isDefault) {
        const chatIds = state.folderChats[folderId] || [];
        chatIds.forEach((chatId) => {
          if (!state.folderChats.default.includes(chatId)) {
            state.folderChats.default.push(chatId);
          }
        });
        state.folders.splice(folderIndex, 1);
        delete state.folderChats[folderId];
      }
    },

    ADD_CHAT(state, chatData) {
      const newChat = {
        id: chatData.id || uuidv4(), // Use provided id if available
        title: chatData.title || 'Untitled Chat',
        preview: chatData.preview || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: chatData.messageCount || 0,
      };
      state.chats.push(newChat);
      const folderId = chatData.folderId || 'default';
      if (!state.folderChats[folderId]) state.folderChats[folderId] = [];
      state.folderChats[folderId].push(newChat.id);
      if (folderId !== 'default' && !state.folderChats.default.includes(newChat.id)) {
        state.folderChats.default.push(newChat.id);
      }
      // Debug: Log new chat and folderChats
      console.log("ADD_CHAT mutation: Added chat:", newChat);
      console.log("ADD_CHAT mutation: Updated folderChats for", folderId, ":", state.folderChats[folderId]);
      return newChat.id;
    },

    UPDATE_CHAT(state, { chatId, title, preview }) {
      const chatIndex = state.chats.findIndex((c) => c.id === chatId);
      if (chatIndex !== -1) {
        state.chats[chatIndex] = {
          ...state.chats[chatIndex],
          title: title || state.chats[chatIndex].title,
          preview: preview || state.chats[chatIndex].preview,
          updatedAt: new Date().toISOString(),
        };
      }
    },

    REMOVE_CHAT(state, chatId) {
      const chatIndex = state.chats.findIndex((c) => c.id === chatId);
      if (chatIndex !== -1) {
        Object.keys(state.folderChats).forEach((folderId) => {
          const index = state.folderChats[folderId].indexOf(chatId);
          if (index !== -1) state.folderChats[folderId].splice(index, 1);
        });
        state.chats.splice(chatIndex, 1);
      }
    },

    ADD_CHAT_TO_FOLDER(state, { chatId, folderId }) {
      if (!state.folderChats[folderId]) state.folderChats[folderId] = [];
      if (!state.folderChats[folderId].includes(chatId)) state.folderChats[folderId].push(chatId);
    },

    REMOVE_CHAT_FROM_FOLDER(state, { chatId, folderId }) {
      if (state.folderChats[folderId]) {
        const index = state.folderChats[folderId].indexOf(chatId);
        if (index !== -1) state.folderChats[folderId].splice(index, 1);
      }
    },

    MOVE_CHAT(state, { chatId, fromFolderId, toFolderId }) {
      if (fromFolderId === toFolderId) return;
      if (state.folderChats[fromFolderId]) {
        const index = state.folderChats[fromFolderId].indexOf(chatId);
        if (index !== -1) state.folderChats[fromFolderId].splice(index, 1);
      }
      if (!state.folderChats[toFolderId]) state.folderChats[toFolderId] = [];
      if (!state.folderChats[toFolderId].includes(chatId)) state.folderChats[toFolderId].push(chatId);
      // Always keep in default folder
      if (!state.folderChats.default.includes(chatId)) {
        state.folderChats.default.push(chatId);
      }
    },

    CLEAR_FOLDERS(state) {
      state.folders = [
        {
          id: 'default',
          name: 'All Chats',
          isDefault: true,
          createdAt: new Date().toISOString(),
        },
      ];
      state.folderChats = { default: [] };
      console.log('CLEAR_FOLDERS mutation: Reset folders and folderChats');
    },
  },

  actions: {
    setFolders({ commit }, folders) {
      console.log('setFolders action: Dispatching folders:', folders);
      commit('setFolders', folders);
      console.log('setFolders action: Completed');
    },

    createFolder({ commit }, name) {
      return commit('ADD_FOLDER', { name });
    },

    updateFolder({ commit }, { folderId, name }) {
      commit('UPDATE_FOLDER', { folderId, name });
    },

    deleteFolder({ commit }, folderId) {
      commit('REMOVE_FOLDER', folderId);
    },

    createChat({ commit }, chatData) {
      return commit('ADD_CHAT', chatData);
    },

    updateChat({ commit }, chatData) {
      commit('UPDATE_CHAT', chatData);
    },

    deleteChat({ commit }, chatId) {
      commit('REMOVE_CHAT', chatId);
    },

    addChatToFolder({ commit }, { chatId, folderId }) {
      commit('ADD_CHAT_TO_FOLDER', { chatId, folderId });
    },

    removeChatFromFolder({ commit }, { chatId, folderId }) {
      commit('REMOVE_CHAT_FROM_FOLDER', { chatId, folderId });
    },

    // Enhanced moveChat action to sync with backend
    async moveChat({ commit, state }, { chatId, fromFolderId, toFolderId }) {
      console.log(`Moving chat ${chatId} from ${fromFolderId} to ${toFolderId}`);
      try {
        const user = userService.getCurrentUser();
        const userId = user?._key || user?.id;
        if (!userId) throw new Error('User ID is missing');
        await chatHistoryService.moveConversation(chatId, fromFolderId, toFolderId, userId);
        const folder = await chatHistoryService.getFolder(toFolderId);
        const chatIds = folder.conversations.map(conv => conv._key);
        commit('SET_FOLDER_CHATS', { folderId: toFolderId, chats: chatIds });
        commit('MOVE_CHAT', { chatId, fromFolderId, toFolderId });
        console.log(`Chat ${chatId} moved successfully to ${toFolderId}`);
      } catch (error) {
        console.error(`Error moving chat ${chatId}:`, error);
        throw error;
      }
    },

    async removeChatFromFolder({ commit, state }, { chatId, folderId }) {
      try {
        console.log(`Removing chat ${chatId} from folder ${folderId}`);

        // Call the mutation to remove the chat from the folder
        commit('REMOVE_CHAT_FROM_FOLDER', { chatId, folderId });

        // Ensure the chat remains in the default folder
        if (!state.folderChats.default.includes(chatId)) {
          commit('ADD_CHAT_TO_FOLDER', { chatId, folderId: 'default' });
        }

        console.log(`Chat ${chatId} removed from folder ${folderId}`);
      } catch (error) {
        console.error(`Error removing chat ${chatId} from folder ${folderId}:`, error);
        throw error;
      }
    },

    async clearFolders({ commit }) {
      commit('CLEAR_FOLDERS');
    }
  },
};