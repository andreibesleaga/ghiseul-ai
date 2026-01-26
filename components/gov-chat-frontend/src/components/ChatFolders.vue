<template>
  <div class="chat-folders-content">
    <div class="search-container">
      <input
        type="text"
        class="search-box"
        :placeholder="safeT('sidebar.searchConversations', 'Search conversations...')"
        v-model="searchTerm"
      />
      <button class="search-btn" @click="handleSearch">
        <i class="fas fa-search"></i>
      </button>
    </div>

    <template v-if="shouldShowFoldersSection">
      <div class="folders-header">
        <h3>{{ safeT("sidebar.folders", "Folders") }}</h3>
        <button
          @click.stop="openCreateFolderModal"
          class="add-folder-btn"
          title="Create New Folder"
        >
          <i class="fas fa-folder-plus"></i>
        </button>
      </div>

      <div class="folders-list">
        <div
          v-for="folder in nonDefaultFolders"
          :key="folder.id"
          :class="[
            'folder-item',
            { 'folder-item-active': selectedFolderId === folder.id },
          ]"
          @click="selectFolder(folder.id)"
        >
          <div class="folder-icon">
            <i class="fas fa-folder"></i>
          </div>
          <div class="folder-details">
            <div class="folder-name">{{ folder.name }}</div>
            <div class="folder-count">
              {{ getChatCount(folder.id) }}
              {{ getChatCount(folder.id) === 1 ? "chat" : "chats" }}
            </div>
          </div>
          <div class="folder-actions">
            <button
              @click.stop="openEditFolderDialog(folder)"
              class="edit-btn"
              title="Edit Folder"
            >
              <i class="fas fa-edit"></i>
            </button>
            <button
              @click.stop="openDeleteFolderDialog(folder)"
              class="delete-btn"
              title="Delete Folder"
            >
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </div>
      </div>
    </template>

    <div class="folder-chats">
      <h3>{{ getTabTitle() }}</h3>

      <div v-if="debug" class="debug-info">
        <p>Current tab: {{ activeTab }}</p>
        <p>Conversations: {{ conversations.length }}</p>
        <p>
          First conversation:
          {{ conversations.length > 0 ? conversations[0].title : "none" }}
        </p>
      </div>

      <div
        v-if="debug && activeTab === 'starred'"
        class="debug-info"
      >
        <p>Direct dump of conversations:</p>
        <div v-for="c in conversations" :key="c._key" class="debug-chat">
          {{ c.title }} - Starred: {{ c.isStarred }}
        </div>
      </div>

      <div
        v-if="debug && activeTab === 'archived'"
        class="debug-info"
      >
        <p>Direct dump of conversations:</p>
        <div v-for="c in conversations" :key="c._key" class="debug-chat">
          {{ c.title }} - Archived: {{ c.isArchived }}
        </div>
      </div>

      <div class="loading-state" v-if="isLoading">
        <i class="fas fa-spinner fa-spin"></i>
        <p>{{ safeT("sidebar.loadingChats", "Loading conversations...") }}</p>
      </div>

      <div class="error-state" v-else-if="errorMessage">
        <i class="fas fa-exclamation-circle"></i>
        <p>{{ errorMessage }}</p>
        <button @click="loadConversationsForCurrentTab" class="retry-btn">
          {{ safeT("sidebar.retry", "Retry") }}
        </button>
      </div>

      <div
        v-else-if="activeTab === 'folders' && !folderSelected"
        class="empty-state"
      >
        <i class="fas fa-folder-open empty-state-icon"></i>
        <p>
          {{
            safeT(
              "sidebar.selectFolderInstruction",
              "Select a folder to view its conversations"
            )
          }}
        </p>
      </div>

      <div
        class="chats-list"
        v-else-if="
          (activeTab !== 'folders' || folderSelected) &&
          filteredConversations.length > 0
        "
      >
        <div
          v-for="conversation in filteredConversations"
          :key="conversation._key"
          class="chat-item"
          @click="openChat(conversation._key)"
        >
          <div class="chat-icon">
            <i class="fas fa-comment"></i>
          </div>
          <div class="chat-content">
            <div class="chat-header">
              <div class="chat-title">{{ conversation.title }}</div>
              <div class="chat-actions-group">
                <button
                  @click.stop="toggleStarred(conversation)"
                  class="star-btn"
                  :title="
                    conversation.isStarred
                      ? safeT('sidebar.unstar', 'Unstar')
                      : safeT('sidebar.star', 'Star')
                  "
                >
                  <i
                    :class="
                      conversation.isStarred ? 'fas fa-star' : 'far fa-star'
                    "
                  ></i>
                </button>
                <label class="archive-checkbox">
                  <input
                    type="checkbox"
                    :checked="conversation.isArchived"
                    @change="toggleArchived(conversation, $event)"
                    @click.stop
                  />
                  <span class="archive-label">{{
                    safeT("sidebar.archive", "Archive")
                  }}</span>
                </label>
                <button
                  @click.stop="showChatActionsMenu(conversation, $event)"
                  class="action-btn"
                  title="Chat Actions"
                >
                  <i class="fas fa-ellipsis-v"></i>
                </button>
              </div>
            </div>
            <div class="chat-message-count">
              {{ conversation.messageCount || 0 }}
              {{
                conversation.messageCount === 1
                  ? safeT("sidebar.message", "message")
                  : safeT("sidebar.messages", "messages")
              }}
            </div>
            <div class="chat-preview">{{ conversation.preview }}</div>
            <div class="chat-footer">
              <span class="chat-category" v-if="conversation.category">
                {{ conversation.category }}
              </span>
              <div
                class="chat-tags"
                v-if="conversation.tags && conversation.tags.length > 0"
              >
                <span
                  v-for="tag in conversation.tags"
                  :key="tag"
                  class="chat-tag"
                >
                  {{ tag }}
                </span>
              </div>
              <div class="chat-dates">
                <span class="chat-created">
                  {{ safeT("sidebar.created", "Created") }}:
                  {{ formatDate(conversation.created) }}
                </span>
                <span class="chat-updated">
                  {{ safeT("sidebar.updated", "Updated") }}:
                  {{ formatDate(conversation.updated) }}
                </span>
              </div>
            </div>
            <div class="status-badges">
              <div v-if="conversation.isStarred" class="starred-badge">
                ★ Starred
              </div>
              <div v-if="conversation.isArchived" class="archived-badge">
                📦 Archived
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        class="empty-state"
        v-else-if="activeTab !== 'folders' || folderSelected"
      >
        <p>{{ getEmptyStateMessage() }}</p>
        <i
          v-if="activeTab === 'starred'"
          class="fas fa-star empty-state-icon"
        ></i>
        <i
          v-else-if="activeTab === 'archived'"
          class="fas fa-archive empty-state-icon"
        ></i>
        <i
          v-else-if="activeTab === 'all'"
          class="fas fa-comments empty-state-icon"
        ></i>
        <i
          v-else-if="activeTab === 'folders'"
          class="fas fa-folder-open empty-state-icon"
        ></i>
      </div>
    </div>

    <modal-dialog
      v-if="showCreateFolderDialog"
      @close="showCreateFolderDialog = false"
    >
      <template v-slot:header>
        <h3>{{ safeT("sidebar.createFolder", "Create Folder") }}</h3>
      </template>
      <template v-slot:body>
        <div class="form-group">
          <label for="folderName">{{
            safeT("sidebar.folderName", "Folder Name")
          }}</label>
          <input
            type="text"
            id="folderName"
            v-model="newFolderName"
            :placeholder="
              safeT('sidebar.folderNamePlaceholder', 'Enter folder name')
            "
            @keyup.enter="handleCreateFolder"
          />
        </div>
      </template>
      <template v-slot:footer>
        <button @click="showCreateFolderDialog = false" class="cancel-btn">
          {{ safeT("common.cancel", "Cancel") }}
        </button>
        <button
          @click="handleCreateFolder"
          class="primary-btn"
          :disabled="!newFolderName.trim()"
        >
          {{ safeT("common.create", "Create") }}
        </button>
      </template>
    </modal-dialog>

    <modal-dialog
      v-if="showEditFolderDialog"
      @close="
        editingFolder = null;
        showEditFolderDialog = false;
      "
    >
      <template v-slot:header>
        <h3>{{ safeT("sidebar.editFolder", "Edit Folder") }}</h3>
      </template>
      <template v-slot:body>
        <div class="form-group">
          <label for="editFolderName">{{
            safeT("sidebar.folderName", "Folder Name")
          }}</label>
          <input
            type="text"
            id="editFolderName"
            v-model="editingFolderName"
            :placeholder="
              safeT('sidebar.folderNamePlaceholder', 'Enter folder name')
            "
            @keyup.enter="handleUpdateFolder"
          />
        </div>
      </template>
      <template v-slot:footer>
        <button
          @click="
            editingFolder = null;
            showEditFolderDialog = false;
          "
          class="cancel-btn"
        >
          {{ safeT("common.cancel", "Cancel") }}
        </button>
        <button
          @click="handleUpdateFolder"
          class="primary-btn"
          :disabled="!editingFolderName.trim()"
        >
          {{ safeT("common.save", "Save") }}
        </button>
      </template>
    </modal-dialog>

    <modal-dialog
      v-if="showDeleteFolderDialog"
      @close="
        editingFolder = null;
        showDeleteFolderDialog = false;
      "
    >
      <template v-slot:header>
        <h3>{{ safeT("sidebar.deleteFolder", "Delete Folder") }}</h3>
      </template>
      <template v-slot:body>
        <p>
          {{
            safeT(
              "sidebar.deleteFolderConfirm",
              "Are you sure you want to delete the folder"
            )
          }}: {{ editingFolder ? editingFolder.name : "" }}?
        </p>
        <p class="warning-text">
          {{
            safeT(
              "sidebar.chatsMoveWarning",
              "All chats in this folder will be moved to the default folder."
            )
          }}
        </p>
      </template>
      <template v-slot:footer>
        <button
          @click="
            editingFolder = null;
            showDeleteFolderDialog = false;
          "
          class="cancel-btn"
        >
          {{ safeT("common.cancel", "Cancel") }}
        </button>
        <button @click="handleDeleteFolder" class="danger-btn">
          {{ safeT("common.delete", "Delete") }}
        </button>
      </template>
    </modal-dialog>

    <context-menu
      v-if="showChatMenu"
      :position="menuPosition"
      @close="showChatMenu = false"
      :class="themeClass"
    >
      <button @click="promptRenameChat" class="menu-item">
        <i class="fas fa-edit"></i>
        {{ safeT("sidebar.renameChat", "Rename Chat") }}
      </button>
      <button @click="showMoveChatDialog = true" class="menu-item">
        <i class="fas fa-exchange-alt"></i>
        {{ safeT("sidebar.moveChat", "Move Chat") }}
      </button>
      <button @click="promptDeleteChat" class="menu-item text-danger">
        <i class="fas fa-trash"></i>
        {{ safeT("sidebar.deleteChat", "Delete Chat") }}
      </button>
    </context-menu>

    <modal-dialog
      v-if="showMoveChatDialog"
      @close="showMoveChatDialog = false"
      class="move-chat-dialog"
    >
      <template v-slot:header>
        <h3>{{ safeT("sidebar.moveChat", "Move Chat") }}</h3>
      </template>
      <template v-slot:body>
        <p>
          {{ safeT("sidebar.moveChatTo", "Move chat to") }}:
          {{ activeChat ? activeChat.title : "" }}
        </p>
        <div class="form-group">
          <label for="destinationFolder">{{
            safeT("sidebar.selectFolder", "Select folder")
          }}</label>
          <select id="destinationFolder" v-model="destinationFolderId">
            <option value="no_folder">
              {{ safeT("sidebar.noFolder", "No Folder") }}
            </option>
            <option
              v-for="folder in availableFolders"
              :key="folder.id"
              :value="folder.id"
              :disabled="selectedFolderId === folder.id"
            >
              {{ folder.name }}
            </option>
          </select>
        </div>
      </template>
      <template v-slot:footer>
        <button @click="showMoveChatDialog = false" class="cancel-btn">
          {{ safeT("common.cancel", "Cancel") }}
        </button>
        <button
          @click="handleMoveChat"
          class="primary-btn"
          :disabled="
            !destinationFolderId ||
            (destinationFolderId !== 'no_folder' &&
              selectedFolderId === destinationFolderId)
          "
        >
          {{ safeT("common.move", "Move") }}
        </button>
      </template>
    </modal-dialog>

    <modal-dialog
      v-if="showRenameChatDialog"
      @close="showRenameChatDialog = false"
    >
      <template v-slot:header>
        <h3>{{ safeT("sidebar.renameChat", "Rename Chat") }}</h3>
      </template>
      <template v-slot:body>
        <div class="form-group">
          <label for="chatTitle">{{
            safeT("sidebar.chatTitle", "Chat Title")
          }}</label>
          <input
            type="text"
            id="chatTitle"
            v-model="newChatTitle"
            :placeholder="
              safeT('sidebar.chatTitlePlaceholder', 'Enter chat title')
            "
            @keyup.enter="handleRenameChat"
          />
        </div>
      </template>
      <template v-slot:footer>
        <button @click="showRenameChatDialog = false" class="cancel-btn">
          {{ safeT("common.cancel", "Cancel") }}
        </button>
        <button
          @click="handleRenameChat"
          class="primary-btn"
          :disabled="!newChatTitle.trim()"
        >
          {{ safeT("common.save", "Save") }}
        </button>
      </template>
    </modal-dialog>

    <modal-dialog
      v-if="showDeleteChatDialog"
      @close="showDeleteChatDialog = false"
    >
      <template v-slot:header>
        <h3>{{ safeT("sidebar.deleteChat", "Delete Chat") }}</h3>
      </template>
      <template v-slot:body>
        <p>
          {{
            safeT(
              "sidebar.deleteChatConfirm",
              "Are you sure you want to delete the chat"
            )
          }}: {{ activeChat ? activeChat.title : "" }}?
        </p>
        <p class="warning-text">
          {{
            safeT("sidebar.deleteChatWarning", "This action cannot be undone.")
          }}
        </p>
      </template>
      <template v-slot:footer>
        <button @click="showDeleteChatDialog = false" class="cancel-btn">
          {{ safeT("common.cancel", "Cancel") }}
        </button>
        <button @click="handleDeleteChat" class="danger-btn">
          {{ safeT("common.delete", "Delete") }}
        </button>
      </template>
    </modal-dialog>
  </div>
</template>

<script>
import { mapGetters, mapActions } from "vuex";
import ModalDialog from "./ModalDialog.vue";
import ContextMenu from "./ContextMenu.vue";
import chatHistoryService from "@/services/chatHistoryService";
import userService from "@/services/userService";
import notificationService from "@/services/notificationService";
import { eventBus } from "../eventBus.js";

export default {
  name: "ChatFolders",

  components: {
    ModalDialog,
    ContextMenu,
  },
  props: {
    activeTab: {
      type: String,
      default: "all",
    },
  },
  data() {
    return {
      selectedFolderId: "default",
      folderSelected: false,
      conversations: [],
      isLoading: false,
      errorMessage: null,
      searchTerm: "",
      searchDebounceTimeout: null,
      showCreateFolderDialog: false,
      newFolderName: "",
      editingFolder: null,
      editingFolderName: "",
      showEditFolderDialog: false,
      showDeleteFolderDialog: false,
      activeChat: null,
      showChatMenu: false,
      menuPosition: { x: 0, y: 0 },
      showMoveChatDialog: false,
      destinationFolderId: null,
      showRenameChatDialog: false,
      newChatTitle: "",
      showDeleteChatDialog: false,
      currentUser: null,
      categories: {},
      folderCounts: {},
      debug: false,
      forceUpdateKey: 0,
    };
  },

  computed: {
    ...mapGetters("chatHistory", [
      "getAllFolders",
      "getChatsByFolderId",
      "getFolderById",
      "getChatById",
    ]),
    themeClass() {
      const theme = this.$route.meta.theme || "light";
      return theme === "dark" ? "context-menu-dark" : "context-menu-light";
    },
    folders() {
      return this.getAllFolders;
    },

    nonDefaultFolders() {
      return this.folders.filter((folder) => !folder.isDefault);
    },

    shouldShowFoldersSection() {
      return this.activeTab === "folders";
    },

    selectedFolder() {
      return this.getFolderById(this.selectedFolderId);
    },

    folderChats() {
      return this.conversations;
    },

    availableFolders() {
      return this.folders.filter((folder) => !folder.isDefault);
    },

    filteredConversations() {
      console.log(
        `Computing filteredConversations for tab: ${this.activeTab}, searchTerm: "${this.searchTerm}"`
      );
      try {
        let filteredChats = [...this.conversations];
        console.log(`Initial filteredChats length: ${filteredChats.length}`);
        if (this.activeTab === "starred") {
          filteredChats = filteredChats.filter(
            (conv) => conv.isStarred === true
          );
          console.log(
            `After starred filtering: ${filteredChats.length} conversations`
          );
        } else if (this.activeTab === "archived") {
          filteredChats = filteredChats.filter(
            (conv) => conv.isArchived === true
          );
          console.log(
            `After archived filtering: ${filteredChats.length} conversations`
          );
        } else if (this.activeTab === "folders") {
          // Exclude archived conversations in folders tab
          filteredChats = filteredChats.filter(
            (conv) => conv.isArchived !== true
          );
          console.log(
            `After excluding archived in folders tab: ${filteredChats.length} conversations`
          );
        }
        if (this.searchTerm && this.searchTerm.trim() !== "") {
          const searchTermLower = this.searchTerm.trim().toLowerCase();
          console.log(`Applying search term: ${searchTermLower}`);
          filteredChats = filteredChats.filter((conv) => {
            const matches =
              (conv.title &&
                conv.title.toLowerCase().includes(searchTermLower)) ||
              (conv.preview &&
                conv.preview.toLowerCase().includes(searchTermLower)) ||
              (conv.category &&
                conv.category.toLowerCase().includes(searchTermLower));
            return matches;
          });
          console.log(
            `After search filtering: ${filteredChats.length} conversations`
          );
        }
        const sortedChats = filteredChats.sort((a, b) => {
          const dateA = a.updated ? new Date(a.updated) : new Date(0);
          const dateB = b.updated ? new Date(b.updated) : new Date(0);
          if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
            console.warn("Invalid date in conversation sorting:", {
              dateA,
              dateB,
            });
            return 0;
          }
          return dateB - dateA;
        });
        console.log(
          `Final filtered and sorted conversations length: ${sortedChats.length}`
        );
        return sortedChats;
      } catch (error) {
        console.error("Error in filteredConversations:", error);
        return this.conversations;
      }
    },
  },

  created() {
    this.loadCurrentUser();
    // Watch for locale changes to notify parent for tab title updates
    if (this.$i18n) {
      this.$watch(
        () => this.$i18n.locale,
        (newLocale) => {
          console.log("[ChatFolders] Locale changed to:", newLocale);
          this.currentLocale = newLocale;
          this.forceUpdateKey++; // Track locale change
          this.$emit("locale-changed", newLocale); // Notify parent to re-render tabs
        }
      );
    }
    // Listen for new conversation saved event
    eventBus.$on("conversation-saved", this.handleConversationSaved);
  },

  mounted() {
    console.log("ChatFolders component mounted");
    this.connectExistingSearchField();
  },

  beforeDestroy() {
    const searchInput = document.querySelector("input.search-box");

    if (searchInput) {
      searchInput.removeEventListener("input", this.handleSearchInput);
    }

    // Clean up conversation-saved event listener
    eventBus.$off("conversation-saved", this.handleConversationSaved);
  },

  watch: {
    // Watch the prop to trigger conversation loading
    activeTab: {
      immediate: true,
      handler(newTab) {
        this.resetComponentState();
        if (newTab === "folders") {
          this.handleFoldersTabActivation();
        } else {
          this.loadConversationsForCurrentTab();
        }
      },
    },
    selectedFolderId(newFolderId) {
      if (
        newFolderId &&
        this.activeTab === "folders" &&
        newFolderId !== "default"
      ) {
        this.fetchFolderChats(newFolderId);
      }
    },
    searchTerm() {
      this.handleSearchInput();
    }
  },

  methods: {
    ...mapActions("chatHistory", [
      "createFolder",
      "updateFolder",
      "deleteFolder",
      "updateChat",
      "deleteChat",
      "moveChat",
    ]),

    handleConversationSaved(conversationId) {
      console.log(
        `Received conversation-saved event for conversation ${conversationId}`
      );
      // Debug: Log Vuex state before processing
      console.log("Vuex chats state:", this.$store.state.chatHistory.chats);
      console.log(
        "Vuex folderChats state for selected folder",
        this.selectedFolderId,
        ":",
        this.$store.state.chatHistory.folderChats[this.selectedFolderId]
      );
      // Refresh only if the current tab is 'all' or 'folders'
      if (this.activeTab === "all" || this.activeTab === "folders") {
        console.log(
          `Refreshing ${this.activeTab} tab due to new conversation`
        );
        this.loadConversationsForCurrentTab();
        // If in folders tab and the conversation belongs to the selected folder, add it immediately
        if (this.activeTab === "folders" && this.selectedFolderId) {
          // Check if the conversation is in the selected folder's folderChats
          const folderChats =
            this.$store.state.chatHistory.folderChats[this.selectedFolderId] ||
            [];
          console.log(
            `Checking if conversation ${conversationId} is in folderChats for ${this.selectedFolderId}:`,
            folderChats
          );
          if (folderChats.includes(conversationId)) {
            // Retry fetching chat with $nextTick to account for Vuex reactivity
            this.$nextTick(() => {
              const chat = this.getChatById(conversationId);
              console.log(`Fetched chat ${conversationId} from Vuex:`, chat);
              if (
                chat &&
                !this.conversations.find((c) => c._key === conversationId)
              ) {
                console.log(
                  `Manually adding conversation ${conversationId} to conversations for folder ${this.selectedFolderId}`
                );
                // Create conversation object matching backend structure
                const newConversation = {
                  _key: chat.id,
                  title: chat.title,
                  preview: chat.preview,
                  created: chat.createdAt,
                  updated: chat.updatedAt,
                  messageCount: chat.messageCount || 0,
                  isStarred: false,
                  isArchived: false,
                  category: null,
                  tags: [], // Assume no tags for new conversation
                };
                this.conversations = [...this.conversations, newConversation];
                this.folderCounts[this.selectedFolderId] =
                  (this.folderCounts[this.selectedFolderId] || 0) + 1;
                console.log(
                  `Updated conversations for folder ${this.selectedFolderId}: ${this.conversations.length} chats`
                );
              } else if (!chat) {
                console.warn(
                  `Conversation ${conversationId} still not found in Vuex store after $nextTick`
                );
              } else {
                console.log(
                  `Conversation ${conversationId} already in conversations`
                );
              }
            });
          } else {
            console.log(
              `Conversation ${conversationId} not in folder ${this.selectedFolderId}'s folderChats`
            );
          }
        }
      } else {
        console.log(`No refresh needed for ${this.activeTab} tab`);
      }
    },

    resetComponentState() {
      console.log("Resetting component state");
      this.conversations = [];
      this.folderSelected = false;
      this.searchTerm = "";
      this.isLoading = false;
      this.errorMessage = null;

      const searchInput = document.querySelector("input.search-box");
      if (searchInput) {
        searchInput.value = "";
      }
    },

    safeT(key, fallback) {
      try {
        if (typeof this.$t === "function") {
          return this.$t(key);
        }
        return fallback;
      } catch (error) {
        console.warn(`Translation error for key ${key}:`, error);
        return fallback;
      }
    },

    openCreateFolderModal() {
      console.log("Creating new folder - opening modal dialog");
      this.newFolderName = "";
      setTimeout(() => {
        this.showCreateFolderDialog = true;
      }, 0);
    },

    closeCreateFolderDialog() {
      console.log("Closing folder creation dialog");
      this.showCreateFolderDialog = false;
    },

    handleFoldersTabActivation() {
      console.log("Folders tab activated, loading folders from backend");
      this.folderSelected = false;
      this.conversations = [];
      this.loadFoldersFromBackend();
    },

    async loadCurrentUser() {
      try {
        console.log("Loading current user data");
        this.currentUser = userService.getCurrentUser();
        if (!this.currentUser) {
          this.currentUser = await userService.getCurrentUserInfo();
        }
        console.log("Current user loaded:", this.currentUser);
        if (!this.currentUser || (!this.currentUser._key && !this.currentUser.id)) {
          console.error("User data loaded but no valid ID found:", this.currentUser);
          this.errorMessage = this.safeT("sidebar.errorLoadingUser", "User data is incomplete. Please reload the page.");
          return;
        }
        if (!this.currentUser._key && this.currentUser.id) {
          this.currentUser._key = this.currentUser.id;
          console.log("Using user.id as user._key:", this.currentUser._key);
        }
        this.loadConversationsForCurrentTab();
        this.loadFoldersFromBackend();
      } catch (error) {
        console.error("Error loading current user:", error);
        this.errorMessage = this.safeT("sidebar.errorLoadingUser", "Error loading user data");
      }
    },

    forceDisplayConversations() {
      console.log("Force displaying conversations:", this.conversations.length);
      this.conversations = [...this.conversations];
      this.$nextTick(() => {
        console.log("UI update scheduled after conversations change");
      });
    },

    async loadConversations() {
      console.log("Starting loadConversations for tab:", this.activeTab);
      this.isLoading = true;
      this.errorMessage = null;
      try {
        if (!this.currentUser || !this.currentUser._key) {
          console.error("Cannot load conversations: No current user or missing user ID");
          this.errorMessage = this.safeT("sidebar.errorLoadingUser", "User data is missing. Please reload the page.");
          this.isLoading = false;
          return;
        }
        const userId = this.currentUser._key;
        console.log(`Loading conversations for user ID: ${userId}`);
        const options = { limit: 100, offset: 0 };
        if (this.activeTab === "all") {
          options.includeArchived = false;
        }
        console.log("Fetching conversations with options:", options);
        const response = await chatHistoryService.getUserConversations(userId, options);
        console.log(`Received ${response.conversations?.length || 0} conversations from server:`, response);
        this.conversations = (response.conversations || []).map((conv) => {
          return {
            ...conv,
            isStarred: conv.isStarred === true,
            isArchived: conv.isArchived === true,
            preview: this.generatePreview(conv),
            messageCount: conv.messageCount || 0,
          };
        });
        console.log(`Set this.conversations to length: ${this.conversations.length}`);
        this.$nextTick(() => {
          console.log("UI should now be updated with conversations");
        });
        if (Object.keys(this.categories).length === 0) {
          this.loadCategories();
        }
      } catch (error) {
        console.error("Error loading conversations:", error);
        this.errorMessage = this.safeT("sidebar.errorLoadingConversations", "Failed to load conversations. Please try again.");
      } finally {
        this.isLoading = false;
      }
    },

    loadConversationsForCurrentTab() {
      console.log(`Loading conversations for current tab: ${this.activeTab}`);

      if (this.activeTab === "folders") {
        if (this.folderSelected && this.selectedFolderId) {
          console.log(`Loading conversations for selected folder: ${this.selectedFolderId}`);
          this.fetchFolderChats(this.selectedFolderId);
        } else {
          console.log("No folder selected in Folders tab - clearing conversations");
          this.conversations = [];
          this.isLoading = false;
        }
        return;
      }

      if (this.activeTab === "starred") {
        this.loadSpecificTabConversations("starred");
      } else if (this.activeTab === "archived") {
        this.loadSpecificTabConversations("archived");
      } else {
        this.loadConversations();
      }
    },

    async loadSpecificTabConversations(tabType) {
      console.log(`Direct loading for ${tabType} tab with proper parameters`);
      this.isLoading = true;
      this.errorMessage = null;
      this.conversations = [];
      try {
        if (!this.currentUser || !this.currentUser._key) {
          this.errorMessage = "User data is missing";
          this.isLoading = false;
          return;
        }
        const options = { limit: 100, offset: 0 };
        if (tabType === "archived") {
          options.includeArchived = true;
        }
        console.log("Fetching conversations with options:", options);
        const response = await chatHistoryService.getUserConversations(this.currentUser._key, options);
        console.log(`Received ${response.conversations?.length || 0} conversations from server:`, response);
        this.conversations = (response.conversations || []).map((conv) => {
          return {
            ...conv,
            isStarred: conv.isStarred === true,
            isArchived: conv.isArchived === true,
            preview: this.generatePreview(conv),
            messageCount: conv.messageCount || 0,
          };
        });
        console.log(`Loaded ${this.conversations.length} conversations for ${tabType} tab`);
        this.forceDisplayConversations();
        if (Object.keys(this.categories).length === 0) {
          this.loadCategories();
        }
      } catch (error) {
        console.error(`Error loading ${tabType} conversations:`, error);
        this.errorMessage = `Failed to load conversations: ${error.message || "Unknown error"}`;
      } finally {
        this.isLoading = false;
      }
    },

    generatePreview(conversation) {
      if (conversation.lastMessage) {
        return conversation.lastMessage.length > 100
          ? conversation.lastMessage.substring(0, 97) + "..."
          : conversation.lastMessage;
      }

      if (
        conversation.lastMessagePreview &&
        conversation.lastMessagePreview.content
      ) {
        return conversation.lastMessagePreview.content.length > 100
          ? conversation.lastMessagePreview.content.substring(0, 97) + "..."
          : conversation.lastMessagePreview.content;
      }

      return this.safeT("sidebar.noPreview", "No preview available");
    },

    async loadCategories() {
      try {
        console.log("Loading categories");
        this.categories = {
          general: "General",
          work: "Work",
          personal: "Personal",
        };
      } catch (error) {
        console.error("Error loading categories:", error);
      }
    },

    getCategoryName(categoryId) {
      if (!categoryId) return "";
      return this.categories[categoryId] || categoryId;
    },

    async toggleStarred(conversation) {
      try {
        console.log(`Toggling starred status for conversation ${conversation._key}`);
        const newStatus = !conversation.isStarred;
        if (!this.currentUser || !this.currentUser._key) {
          console.error("Cannot update conversation: No current user or missing user ID");
          notificationService.error(this.safeT("sidebar.errorNoUser", "User data is missing"));
          return;
        }
        conversation.isStarred = newStatus;
        await chatHistoryService.updateConversation(conversation._key, {
          isStarred: newStatus,
          userId: this.currentUser._key,
        });
        if (this.activeTab === "starred" && !newStatus) {
          this.conversations = this.conversations.filter((conv) => conv._key !== conversation._key);
          this.forceDisplayConversations();
          if (this.selectedFolderId) {
            this.folderCounts[this.selectedFolderId] = this.conversations.length;
          }
        }
        if (newStatus) {
          notificationService.success(this.safeT("sidebar.chatStarred", "Conversation has been starred"));
        } else {
          notificationService.info(this.safeT("sidebar.chatUnstarred", "Conversation has been unstarred"));
        }
      } catch (error) {
        conversation.isStarred = !conversation.isStarred;
        console.error("Error toggling starred status:", error);
        notificationService.error(this.safeT("sidebar.errorUpdatingChat", "Failed to update conversation"));
      }
    },

    async toggleArchived(conversation, event) {
      try {
        console.log(`Toggling archived status for conversation ${conversation._key}`);
        const newStatus = event.target.checked;
        if (!this.currentUser || !this.currentUser._key) {
          console.error("Cannot update conversation: No current user or missing user ID");
          notificationService.error(this.safeT("sidebar.errorNoUser", "User data is missing"));
          return;
        }
        conversation.isArchived = newStatus;
        await chatHistoryService.updateConversation(conversation._key, {
          isArchived: newStatus,
          userId: this.currentUser._key,
        });
        if (this.activeTab !== "archived" && newStatus) {
          this.conversations = this.conversations.filter((conv) => conv._key !== conversation._key);
          this.forceDisplayConversations();
          if (this.selectedFolderId) {
            this.folderCounts[this.selectedFolderId] = this.conversations.length;
          }
        }
        if (this.activeTab === "archived" && !newStatus) {
          this.conversations = this.conversations.filter((conv) => conv._key !== conversation._key);
          this.forceDisplayConversations();
          if (this.selectedFolderId) {
            this.folderCounts[this.selectedFolderId] = this.conversations.length;
          }
        }
        if (newStatus) {
          notificationService.success(this.safeT("sidebar.chatArchived", "Conversation has been archived"));
        } else {
          notificationService.info(this.safeT("sidebar.chatUnarchived", "Conversation has been unarchived"));
        }
      } catch (error) {
        conversation.isArchived = !conversation.isArchived;
        console.error("Error toggling archived status:", error);
        notificationService.error(this.safeT("sidebar.errorUpdatingChat", "Failed to update conversation"));
      }
    },

    connectExistingSearchField() {
      console.log("Connecting to existing search field");
      const searchInput = document.querySelector("input.search-box");
      if (searchInput) {
        console.log("[ChatFolders] Search input found:", searchInput);
        searchInput.addEventListener("input", this.handleSearchInput);
      } else {
        console.warn("Could not find existing search input in DOM");
      }
    },

    handleSearchInput() {
      clearTimeout(this.searchDebounceTimeout);
      this.searchDebounceTimeout = setTimeout(() => {
        console.log(`Search term changed to: ${this.searchTerm}, reloading conversations`);
        this.loadConversationsForCurrentTab();
      }, 300);
    },

    handleSearch() {
      this.loadConversationsForCurrentTab();
    },

    getTabTitle() {
      switch (this.activeTab) {
        case "all":
          return this.safeT("sidebar.allChats", "All Chats");
        case "folders":
          return this.folderSelected && this.selectedFolder
            ? this.selectedFolder.name
            : this.safeT("sidebar.tab.folders", "Folders");
        case "starred":
          return this.safeT("sidebar.tab.starred", "Starred");
        case "archived":
          return this.safeT("sidebar.tab.archived", "Archived");
        default:
          return this.safeT("sidebar.chats", "Chats");
      }
    },

    getEmptyStateMessage() {
      if (this.searchTerm) {
        return this.safeT("sidebar.noSearchResults", `No conversations found for "${this.searchTerm}"`);
      }
      if (this.activeTab === "all") {
        return this.safeT("sidebar.noChats", "No conversations found. Start a new conversation!");
      } else if (this.activeTab === "starred") {
        return this.safeT("sidebar.noStarredChats", "No starred conversations yet. Star a conversation to add it here.");
      } else if (this.activeTab === "archived") {
        return this.safeT("sidebar.noArchivedChats", "No archived conversations yet.");
      } else if (this.activeTab === "folders") {
        return this.folderSelected
          ? this.safeT("sidebar.emptyFolder", "This folder is empty. Move conversations here from the chat menu.")
          : this.safeT("sidebar.selectFolderInstruction", "Select a folder to view its conversations");
      }
      return this.safeT("sidebar.noChats", "No conversations found.");
    },

    selectFirstCustomFolder() {
      console.log("Attempting to select first custom folder");
      if (!this.nonDefaultFolders || this.nonDefaultFolders.length === 0) {
        console.log("No custom folders available to select");
        return;
      }
      const customFolders = this.nonDefaultFolders;
      if (customFolders.length > 0) {
        const firstFolder = customFolders[0];
        console.log("Auto-selecting folder:", firstFolder.name, firstFolder.id);
        this.selectFolder(firstFolder.id);
      }
    },

    async selectFolder(folderId) {
      console.log(`Selecting folder: ${folderId}`);
      this.selectedFolderId = folderId;
      this.folderSelected = true;
      await this.fetchFolderChats(folderId, true);
    },

    async getChatsByFolderId({ commit }, folderId) {
      try {
        console.log(`Fetching chats for folder ${folderId}`);
        const folder = await chatHistoryService.getFolder(folderId);
        const chatIds = folder.conversations.map((conv) => conv._key);
        commit("SET_FOLDER_CHATS", { folderId, chats: chatIds });
        console.log(`Chat IDs for folder ${folderId}:`, chatIds);
        return folder.conversations;
      } catch (error) {
        console.error(`Error fetching chats for folder ${folderId}:`, error);
        throw error;
      }
    },

    getChatCount(folderId) {
      return this.folderCounts[folderId] || 0;
    },

    openEditFolderDialog(folder) {
      this.editingFolder = folder;
      this.editingFolderName = folder.name;
      this.showEditFolderDialog = true;
    },

    openDeleteFolderDialog(folder) {
      this.editingFolder = folder;
      this.showDeleteFolderDialog = true;
    },

    async handleCreateFolder() {
      console.log("handleCreateFolder called with name:", this.newFolderName);
      if (!this.newFolderName.trim()) {
        console.log("Folder name is empty, not creating");
        return;
      }
      try {
        if (!this.currentUser || !this.currentUser._key) {
          console.error("Cannot create folder: No current user or missing user ID");
          notificationService.error(this.safeT("sidebar.errorNoUser", "User data is missing"));
          return;
        }
        const folderData = {
          userId: this.currentUser._key,
          name: this.newFolderName.trim(),
        };
        console.log("Creating folder with data:", folderData);
        const result = await chatHistoryService.createFolder(folderData);
        console.log("Folder created successfully:", result);
        this.folderCounts[result._key] = 0;
        notificationService.success(this.safeT("sidebar.folderCreated", "Folder created successfully"));
        this.showCreateFolderDialog = false;
        this.loadFoldersFromBackend();
      } catch (error) {
        console.error("Error creating folder:", error);
        notificationService.error(this.safeT("sidebar.errorCreatingFolder", "Failed to create folder"));
      }
    },

    async loadFoldersFromBackend() {
      try {
        console.log("Loading folders from backend");
        if (!this.currentUser || !this.currentUser._key) {
          console.error("Cannot load folders: No current user or missing user ID");
          this.errorMessage = this.safeT("sidebar.errorNoUser", "User data is missing");
          return [];
        }
        const response = await chatHistoryService.getUserFolders(this.currentUser._key);
        console.log("Raw getUserFolders response:", JSON.stringify(response, null, 2));
        let foldersArray = Array.isArray(response) ? response : response?.folders || [];
        console.log(`Received ${foldersArray.length} folders:`, foldersArray);
        const processedFolders = foldersArray
          .filter((folder) => folder && (folder._key || folder.id))
          .map((folder) => ({
            id: folder._key || folder.id,
            name: folder.name || "Unnamed Folder",
            description: folder.description || "",
            isDefault: folder.isDefault || false,
          }));
        foldersArray.forEach((folder) => {
          this.folderCounts[folder._key] = 0;
        });
        const defaultFolder = {
          id: "default",
          name: "All Chats",
          isDefault: true,
          createdAt: new Date().toISOString(),
        };
        this.folderCounts[defaultFolder.id] = 0;
        const allFolders = [defaultFolder, ...processedFolders];
        console.log("All folders (with default) before dispatch:", JSON.stringify(allFolders, null, 2));
        await this.$store.dispatch("chatHistory/setFolders", allFolders);
        const stateFolders = [...this.$store.state.chatHistory.folders];
        console.log("Vuex state.chatHistory.folders after dispatch:", stateFolders);
        const getterFolders = [...this.$store.getters["chatHistory/getAllFolders"]];
        console.log("Vuex getter getAllFolders after dispatch:", getterFolders);
        const nonDefaultFoldersDebug = [...this.nonDefaultFolders];
        console.log("Computed nonDefaultFolders after dispatch:", nonDefaultFoldersDebug);
        for (const folder of processedFolders) {
          await this.fetchFolderChats(folder.id, false);
        }
        if (this.activeTab === "folders") {
          this.selectFirstCustomFolder();
        }
        return processedFolders;
      } catch (error) {
        console.error("Error loading folders from backend:", error);
        this.errorMessage = this.safeT("sidebar.errorLoadingFolders", "Failed to load folders");
        notificationService.error(this.errorMessage);
        return [];
      }
    },

    async handleUpdateFolder() {
      if (!this.editingFolder || !this.editingFolderName.trim()) {
        console.log("No folder selected or empty name, not updating");
        return;
      }
      try {
        console.log(`Updating folder ${this.editingFolder.id} with name: ${this.editingFolderName}`);
        await chatHistoryService.updateFolder(this.editingFolder.id, {
          name: this.editingFolderName.trim(),
          userId: this.currentUser._key,
        });
        await this.loadFoldersFromBackend();
        notificationService.success(this.safeT("sidebar.folderUpdated", "Folder updated successfully"));
        this.editingFolder = null;
        this.editingFolderName = "";
        this.showEditFolderDialog = false;
      } catch (error) {
        console.error(`Error updating folder ${this.editingFolder.id}:`, error);
        notificationService.error(this.safeT("sidebar.errorUpdatingFolder", "Failed to update folder"));
      }
    },

    async handleDeleteFolder() {
      if (!this.editingFolder) {
        console.log("No folder selected, not deleting");
        return;
      }
      try {
        this.isLoading = true;
        if (!this.currentUser || !this.currentUser._key) {
          console.error("Cannot delete folder: No current user or missing user ID");
          notificationService.error(this.safeT("sidebar.errorNoUser", "User data is missing"));
          return;
        }
        await chatHistoryService.deleteFolder(this.editingFolder.id, this.currentUser._key, false);
        await this.loadFoldersFromBackend();
        if (this.selectedFolderId === this.editingFolder.id) {
          this.selectedFolderId = "default";
          this.folderSelected = false;
          this.conversations = [];
        }
        notificationService.success(this.safeT("sidebar.folderDeleted", "Folder deleted successfully"));
        this.editingFolder = null;
        this.showDeleteFolderDialog = false;
      } catch (error) {
        console.error(`Error deleting folder ${this.editingFolder.id}:`, error);
        notificationService.error(this.safeT("sidebar.errorDeletingFolder", "Failed to delete folder"));
      } finally {
        this.isLoading = false;
      }
    },

    openChat(chatId) {
      console.log(`Opening chat ${chatId}`);
      eventBus.$emit("load-conversation", chatId);
    },

    showChatActionsMenu(chat, event) {
      console.log(`Showing actions menu for chat ${chat._key}`);
      this.activeChat = chat;
      if (this.activeTab !== "folders") {
        const folderChats = this.$store.state.chatHistory.folderChats;
        let foundFolderId = null;
        for (const folderId in folderChats) {
          if (folderId !== "default" && folderChats[folderId] && folderChats[folderId].includes(chat._key)) {
            foundFolderId = folderId;
            break;
          }
        }
        if (foundFolderId) {
          this.selectedFolderId = foundFolderId;
          this.folderSelected = true;
        } else {
          this.selectedFolderId = "default";
          this.folderSelected = false;
        }
      }
      const rect = event.target.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const menuWidth = 180;
      this.menuPosition = {
        x: Math.max(10, rect.left - menuWidth + 20),
        y: rect.bottom + 5,
      };
      this.showChatMenu = true;
      setTimeout(() => {
        const menu = document.querySelector(".context-menu");
        if (menu) {
          const menuRect = menu.getBoundingClientRect();
          if (menuRect.right > viewportWidth - 10) {
            this.menuPosition.x = viewportWidth - menuWidth - 10;
          }
          const viewportHeight = window.innerHeight;
          if (menuRect.bottom > viewportHeight - 10) {
            this.menuPosition.y = rect.top - menuRect.height - 5;
          }
        }
      }, 0);
    },

    promptRenameChat() {
      if (this.activeChat) {
        console.log(`Prompting to rename chat ${this.activeChat._key}`);
        this.newChatTitle = this.activeChat.title;
        this.showRenameChatDialog = true;
        this.showChatMenu = false;
      }
    },

    async handleRenameChat() {
      if (!this.activeChat || !this.newChatTitle.trim()) {
        return;
      }
      console.log(`Renaming chat ${this.activeChat._key} to "${this.newChatTitle}"`);
      try {
        const originalTitle = this.activeChat.title;
        this.activeChat.title = this.newChatTitle.trim();
        await chatHistoryService.updateConversation(this.activeChat._key, {
          title: this.newChatTitle.trim(),
          userId: this.currentUser._key,
        });
        this.updateChat({
          chatId: this.activeChat._key,
          title: this.newChatTitle.trim(),
        });
        this.showRenameChatDialog = false;
        this.showChatMenu = false;
        notificationService.success(this.safeT("sidebar.chatRenamed", "Conversation renamed successfully"));
      } catch (error) {
        this.activeChat.title = originalTitle;
        console.error("Error renaming chat:", error);
        notificationService.error(this.safeT("sidebar.errorRenamingChat", "Failed to rename conversation"));
      }
    },

    promptDeleteChat() {
      if (this.activeChat) {
        console.log(`Prompting to delete chat ${this.activeChat._key}`);
        this.showDeleteChatDialog = true;
        this.showChatMenu = false;
      }
    },

    async handleDeleteChat() {
      if (!this.activeChat) {
        return;
      }
      if (!this.currentUser || !this.currentUser._key) {
        console.error("Cannot delete chat: No current user or missing user ID");
        notificationService.error(this.safeT("sidebar.errorNoUser", "User data is missing"));
        return;
      }
      console.log(`Deleting chat ${this.activeChat._key}`);
      try {
        await chatHistoryService.deleteConversation(this.activeChat._key, this.currentUser._key);
        this.conversations = this.conversations.filter((c) => c._key !== this.activeChat._key);
        this.deleteChat(this.activeChat._key);
        if (this.selectedFolderId && this.folderCounts[this.selectedFolderId] !== undefined) {
          this.folderCounts[this.selectedFolderId] = this.conversations.length;
        }
        this.showDeleteChatDialog = false;
        eventBus.$emit("chat-deleted", this.activeChat._key);
        this.activeChat = null;
        this.showChatMenu = false;
        notificationService.success(this.safeT("sidebar.chatDeleted", "Conversation deleted successfully"));
        this.loadConversationsForCurrentTab();
      } catch (error) {
        console.error("Error deleting chat:", error);
        notificationService.error(this.safeT("sidebar.errorDeletingChat", "Failed to delete conversation"));
      }
    },

    async handleMoveChat() {
      if (!this.activeChat || !this.destinationFolderId) {
        console.error("No active chat or destination folder selected");
        return;
      }
      if (!this.currentUser || !this.currentUser._key) {
        console.error("Cannot move chat: No current user or missing user ID");
        notificationService.error(this.safeT("sidebar.errorNoUser", "User data is missing"));
        return;
      }
      const isRemovingFromFolder = this.destinationFolderId === "no_folder";
      console.log(`${isRemovingFromFolder ? "Removing" : "Moving"} chat ${this.activeChat._key} ${
          isRemovingFromFolder ? "from all custom folders" : `to folder ${this.destinationFolderId}`
        }`);
      try {
        if (isRemovingFromFolder) {
          await chatHistoryService.removeConversationFromFolder(this.activeChat._key, this.selectedFolderId, this.currentUser._key);
          if (this.$store.state.chatHistory.folderChats[this.selectedFolderId]) {
            await this.$store.dispatch("chatHistory/removeChatFromFolder", {
              chatId: this.activeChat._key,
              folderId: this.selectedFolderId,
            });
          }
          const sourceCount = (this.folderCounts[this.selectedFolderId] || 1) - 1;
          this.folderCounts[this.selectedFolderId] = Math.max(0, sourceCount);
          this.selectedFolderId = "default";
          this.folderSelected = false;
        } else {
          await chatHistoryService.moveConversation(this.activeChat._key, this.selectedFolderId, this.destinationFolderId, this.currentUser._key);
          await this.moveChat({
            chatId: this.activeChat._key,
            fromFolderId: this.selectedFolderId,
            toFolderId: this.destinationFolderId,
          });
          const sourceCount = (this.folderCounts[this.selectedFolderId] || 1) - 1;
          const destCount = (this.folderCounts[this.destinationFolderId] || 0) + 1;
          this.folderCounts[this.selectedFolderId] = Math.max(0, sourceCount);
          this.folderCounts[this.destinationFolderId] = destCount;
          if (sourceCount <= 0 && this.selectedFolderId !== "default") {
            this.selectedFolderId = this.nonDefaultFolders.length > 0 ? this.nonDefaultFolders[0].id : "default";
            this.folderSelected = this.selectedFolderId !== "default";
          } else {
            this.selectedFolderId = this.destinationFolderId;
            this.folderSelected = true;
          }
        }
        if (!this.$store.state.chatHistory.folderChats.default.includes(this.activeChat._key)) {
          await this.$store.dispatch("chatHistory/addChatToFolder", {
            chatId: this.activeChat._key,
            folderId: "default",
          });
        }
        this.showMoveChatDialog = false;
        this.destinationFolderId = null;
        this.showChatMenu = false;
        notificationService.success(isRemovingFromFolder ? this.safeT("sidebar.chatRemovedFromFolders", "Conversation removed from folder") : this.safeT("sidebar.chatMoved", "Conversation moved successfully"));
        this.loadConversationsForCurrentTab();
        if (this.activeTab === "folders") {
          if (isRemovingFromFolder || this.selectedFolderId === "default") {
            if (this.selectedFolderId !== "default") {
              await this.fetchFolderChats(this.selectedFolderId);
            } else {
              this.conversations = [];
              this.forceDisplayConversations();
            }
          } else {
            await this.selectFolder(this.selectedFolderId);
          }
        }
      } catch (error) {
        console.error(`Error ${isRemovingFromFolder ? "removing chat from folder" : "moving chat"}:`, error);
        notificationService.error(isRemovingFromFolder ? this.safeT("sidebar.errorRemovingChat", "Failed to remove conversation from folder") : this.safeT("sidebar.errorMovingChat", "Failed to move conversation"));
      }
    },

    formatDate(dateStr) {
      if (!dateStr) return "";
      let date;
      try {
        date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          console.warn(`Invalid date string: ${dateStr}`);
          return dateStr;
        }
      } catch (error) {
        console.warn(`Error parsing date ${dateStr}:`, error);
        return dateStr;
      }
      const today = new Date();
      if (date.toDateString() === today.toDateString()) {
        return date.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      if (date.getFullYear() === today.getFullYear()) {
        return date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });
      }
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    },

    async fetchFolderChats(folderId, isSelected = false) {
      try {
        this.isLoading = true;
        this.errorMessage = null;
        if (isSelected) {
          this.conversations = [];
        }
        console.log(`Fetching conversations for folder ${folderId}`);
        if (!this.currentUser || !this.currentUser._key) {
          this.errorMessage = "User data is missing";
          return;
        }
        const folderData = await chatHistoryService.getFolder(folderId, {
          params: { limit: 100, offset: 0 },
        });
        console.log(`Fetched folder data:`, folderData);
        if (folderData && folderData.conversations) {
          const convs = folderData.conversations.map((conv) => ({
            ...conv,
            isStarred: conv.isStarred === true,
            isArchived: conv.isArchived === true,
            preview: this.generatePreview(conv),
            messageCount: conv.messageCount || 0,
          }));
          console.log(`Total conversations fetched for folder ${folderId}: ${convs.length}`);
          const nonArchivedConvs = convs.filter((conv) => conv.isArchived !== true);
          console.log(`Non-archived conversations for folder ${folderId}: ${nonArchivedConvs.length}`);
          if (isSelected) {
            this.conversations = convs;
            this.forceDisplayConversations();
          }
          this.folderCounts[folderId] = nonArchivedConvs.length;
          console.log(`Loaded ${nonArchivedConvs.length} non-archived conversations for folder ${folderId}, updated folderCounts[${folderId}] = ${nonArchivedConvs.length}`);
          await this.$store.dispatch("chatHistory/setFolderChats", {
            folderId,
            chats: convs.map((conv) => conv._key),
          });
        } else {
          console.log(`No conversations found for folder ${folderId}`);
          this.folderCounts[folderId] = 0;
        }
      } catch (error) {
        console.error(`Error fetching chats for folder ${folderId}:`, error);
        this.errorMessage = this.safeT("sidebar.errorLoadingFolder", "Failed to load folder: ") + (error.message || "Unknown error");
        notificationService.error(this.errorMessage);
      } finally {
        this.isLoading = false;
      }
    },
  },
};
</script>

<style scoped>
.chat-folders-content {
  flex-grow: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.search-container {
  display: flex;
  margin-bottom: 15px;
  padding: 5px;
  width: 100%;
}

.search-box {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-input, #ddd);
  border-radius: 4px 0 0 4px;
  font-size: 0.9rem;
  background-color: var(--bg-input, #fff);
  color: var(--text-primary, #333);
}

.search-btn {
  background: var(--accent-color, #4e97d1);
  color: white;
  border: none;
  border-radius: 0 4px 4px 0;
  padding: 0 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-btn:hover {
  background: var(--accent-hover, #3a7da0);
}

.chat-folders {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background-color: var(--bg-sidebar);
  color: var(--text-primary);
}

.folders-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-light);
}

.folders-header h3 {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

[data-theme="dark"] .folders-header h3,
html[data-theme="dark"] .folders-header h3 {
  color: rgba(255, 255, 255, 0.7) !important;
}

.add-folder-btn {
  background: none;
  border: none;
  color: var(--accent-color);
  cursor: pointer;
  font-size: 1rem;
  padding: 4px 8px;
  border-radius: 4px;
}

.add-folder-btn:hover {
  background: rgba(78, 151, 209, 0.1);
}

.folders-list {
  overflow-y: auto;
  flex-shrink: 0;
  padding: 8px 0;
}

.folder-item {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  color: var(--text-primary);
}

.folder-item:hover {
  background-color: var(--bg-tertiary);
}

.folder-item-active {
  background-color: var(--bg-secondary);
}

.folder-icon {
  margin-right: 12px;
  color: var(--accent-color);
}

.folder-details {
  flex-grow: 1;
}

.folder-name {
  font-weight: 500;
  color: var(--text-primary);
}

.folder-count {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.folder-actions {
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.folder-item:hover .folder-actions {
  opacity: 1;
}

.edit-btn,
.delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 4px;
  border-radius: 4px;
}

.edit-btn:hover {
  color: var(--accent-color);
  background: rgba(78, 151, 209, 0.1);
}

.delete-btn:hover {
  color: #e53935;
  background: rgba(229, 57, 53, 0.1);
}

.folder-chats {
  padding: 12px 16px;
  border-top: 1_2_1px solid var(--border-light);
  overflow-y: auto;
  flex-grow: 1;
  background-color: var(--bg-sidebar);
}

.folder-chats h3 {
  margin: 0 0 12px 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.chats-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-item {
  display: flex;
  padding: 12px;
  border-radius: 8px;
  background-color: var(--bg-card);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  color: var(--text-primary);
  position: relative;
  width: calc(100% - 10px);
  max-width: 412px;
  margin-bottom: 8px;
}

.chat-item:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.chat-icon {
  margin-right: 12px;
  color: var(--accent-color);
  padding-top: 2px;
  flex-shrink: 0;
}

.chat-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-bottom: 8px;
}

.chat-title {
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100% - 100px);
  font-size: 1.05rem;
  cursor: pointer;
}

.chat-title:hover {
  text-decoration: underline;
  color: var(--accent-color);
}

.chat-actions-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.chat-message-count {
  font-size: 0.8rem;
  color: var(--text-tertiary);
  margin-bottom: 4px;
}

.chat-preview {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.chat-footer {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.75rem;
}

.chat-category {
  display: inline-block;
  padding: 2px 6px;
  background-color: rgba(78, 151, 209, 0.1);
  border-radius: 4px;
  font-weight: 500;
  font-size: 0.8rem;
  max-width: fit-content;
  margin-bottom: 4px;
}

.chat-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 4px;
}

.chat-tag {
  display: inline-block;
  padding: 2px 6px;
  background-color: rgba(78, 151, 209, 0.1);
  border-radius: 4px;
  font-weight: 500;
  font-size: 0.8rem;
  color: var(--text-primary);
}

.chat-dates {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.archive-checkbox {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  cursor: pointer;
}

.archive-checkbox input {
  margin-bottom: 2px;
}

.archive-label {
  font-size: 0.7rem;
  text-align: center;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s, color 0.2s;
}

.action-btn:hover {
  color: var(--accent-color);
  background: rgba(78, 151, 209, 0.1);
}

.empty-folder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  color: var(--text-tertiary);
  text-align: center;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  color: var(--text-tertiary);
  text-align: center;
}

.loading-state i,
.error-state i {
  font-size: 1.5rem;
  margin-bottom: 8px;
  color: var(--accent-color);
}

.error-state i {
  color: #e53935;
}

.retry-btn {
  margin-top: 8px;
  padding: 6px 12px;
  background-color: var(--bg-button-secondary);
  color: var(--text-button-secondary);
  border: 1px solid var(--border-light);
  border-radius: 4px;
  cursor: pointer;
}

.retry-btn:hover {
  background-color: var(--bg-tertiary);
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-primary);
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  font-size: 1rem;
  background-color: var(--bg-input);
  color: var(--text-primary);
}

.warning-text {
  color: #e53935;
  font-size: 0.9rem;
  margin-top: 8px;
}

.cancel-btn,
.primary-btn,
.danger-btn {
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.cancel-btn:hover {
  background-color: var(--bg-tertiary);
}

.primary-btn {
  background-color: var(--bg-button-primary);
  border: none;
  color: var(--text-button-primary);
}

.primary-btn:hover {
  background-color: var(--accent-hover);
}

.primary-btn:disabled {
  background-color: var(--bg-button-secondary);
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.danger-btn {
  background-color: #e53935;
  border: none;
  color: white;
}

.danger-btn:hover {
  background-color: #c62828;
}

/* Context menu base styles */
.context-menu {
  background-color: var(--bg-card); /* Light background (e.g., white) */
  border: 1px solid var(--border-light);
  border-radius: 4px;
  box-shadow: var(--shadow-md);
}

/* Explicit light mode class */
.context-menu-light {
  background-color: var(--bg-card);
  border: 1px solid var(--border-light);
}

/* Explicit dark mode class */
.context-menu-dark {
  background-color: #333; /* Dark background */
  border: 1px solid rgba(255, 255, 255, 0.2); /* Light border */
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  background: none;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
  color: var(--text-primary); /* Dark text in light mode */
}

.menu-item:hover {
  background-color: var(--bg-tertiary); /* Light hover effect */
}

.menu-item i {
  width: 16px;
  color: var(--text-secondary); /* Lighter icons in light mode */
}

/* Red text for delete option */
.text-danger {
  color: #e53935 !important; /* Ensure red in both modes */
}

/* Light mode specific menu item styles */
.context-menu-light .menu-item {
  color: var(--text-primary);
}

.context-menu-light .menu-item:hover {
  background-color: var(--bg-tertiary);
}

.context-menu-light .menu-item i {
  color: var(--text-secondary);
}

/* Dark mode specific menu item styles */
.context-menu-dark .menu-item {
  color: #ffffff; /* Light text */
}

.context-menu-dark .menu-item:hover {
  background-color: #444; /* Darker hover effect */
}

.context-menu-dark .menu-item i {
  color: rgba(255, 255, 255, 0.7); /* Light icons */
}

/* Fallback for global theme attribute */
[data-theme="dark"] .context-menu,
html[data-theme="dark"] .context-menu {
  background-color: #333;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

[data-theme="dark"] .menu-item,
html[data-theme="dark"] .menu-item {
  color: #ffffff;
}

[data-theme="dark"] .menu-item:hover,
html[data-theme="dark"] .menu-item:hover {
  background-color: #444;
}

[data-theme="dark"] .menu-item i,
html[data-theme="dark"] .menu-item i {
  color: rgba(255, 255, 255, 0.7);
}

/* Ensure red text in dark mode */
[data-theme="dark"] .menu-item.text-danger,
html[data-theme="dark"] .menu-item.text-danger {
  color: #e53935 !important;
}

/* Debug information styling */
.debug-info {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 8px;
  margin-bottom: 12px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  color: #333;
}

[data-theme="dark"] .debug-info {
  background-color: rgba(255, 255, 255, 0.1);
  color: #ddd;
}

.debug-info p {
  margin: 0;
  line-height: 1.5;
}

.debug-chat {
  padding: 5px;
  margin: 5px 0;
  border-bottom: 1px solid #eee;
}

[data-theme="dark"] .debug-chat {
  border-color: #444;
}

/* Star and archive badges */
.starred-badge,
.archived-badge {
  display: inline-block;
  margin-top: 8px;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.starred-badge {
  background-color: rgba(245, 166, 35, 0.1);
  color: #f5a623;
}

.archived-badge {
  background-color: rgba(96, 125, 139, 0.1);
  color: #607d8b;
}

/* Empty state icons */
.empty-state-icon {
  font-size: 3rem;
  margin-top: 16px;
  color: var(--text-tertiary);
  opacity: 0.5;
}

/* Star button with outline when not starred */
.star-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 4px;
  border-radius: 4px;
  transition: color 0.2s;
}

.star-btn:hover {
  color: var(--accent-color);
}

.star-btn .fa-star {
  color: #f5a623;
}

.star-btn .fa-star-o {
  color: #8e8e8e !important;
}

/* Tab titles and section headings in dark mode */
[data-theme="dark"] .folder-chats h3,
html[data-theme="dark"] .folder-chats h3 {
  color: #ffffff !important;
}

/* This targets the "All Chats", "Starred", and "Archived" headings specifically */
[data-theme="dark"] .folder-chats > h3,
html[data-theme="dark"] .folder-chats > h3 {
  color: #ffffff !important;
}

.move-chat-dialog {
  z-index: 10000 !important;
}
</style>