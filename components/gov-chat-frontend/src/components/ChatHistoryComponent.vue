<template>
  <div class="chat-history" :data-theme="$route.meta.theme || 'light'">
    <h4>{{ $t('sidebar.chatHistory', 'Chat History') }}</h4>
    <ul>
      <li
        v-for="(chat, index) in chats"
        :key="index"
        @click="$emit('selectChat', chat)"
      >
        {{ chat.title || 'Untitled Chat' }}
        <span class="date">{{ chat.date }}</span>
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  name: 'ChatHistoryComponent',
  data() {
    return {
      chats: [
        { id: 1, title: 'Tax Inquiry', date: '2025-02-27' },
        { id: 2, title: 'Fire Safety', date: '2025-02-26' }
      ]
    }
  }
}
</script>

<style scoped>
.chat-history {
  margin-top: 20px;
  background-color: var(--bg-sidebar);
  color: var(--text-primary);
  padding: 10px;
}

.chat-history h4 {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0 16px;
}

[data-theme="dark"] .chat-history h4,
html[data-theme="dark"] .chat-history h4 {
  color: rgba(255, 255, 255, 0.7) !important;
}

.chat-history ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.chat-history li {
  padding: 10px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-light);
  color: var(--text-primary);
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background-color 0.2s;
}

.chat-history li:hover {
  background-color: var(--bg-tertiary);
}

.date {
  font-size: 0.8em;
  color: var(--text-tertiary);
  margin-left: 8px;
}
.chat-history h4 {
  color: var(--text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

[data-theme="dark"] .chat-history h4,
html[data-theme="dark"] .chat-history h4 {
  color: rgba(255, 255, 255, 0.7) !important;
}
</style>