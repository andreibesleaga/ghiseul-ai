<!-- src/views/DashboardView.vue -->
<template>
  <div class="dashboard-content">
    <chat-bot-component />
  </div>
</template>

<script>
import ChatBotComponent from '@/components/ChatBotComponent.vue'

export default {
  name: 'DashboardView',
  components: {
    ChatBotComponent
  }
}
</script>

<style scoped>
.dashboard-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}
</style>
