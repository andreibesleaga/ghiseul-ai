// eventBus.js - Minimal implementation
const handlers = {}

export const eventBus = {
  $on(event, handler) {
    if (!handlers[event]) {
      handlers[event] = []
    }
    handlers[event].push(handler)
  },
  
  $off(event, handler) {
    if (!handlers[event]) return
    
    if (!handler) {
      handlers[event] = []
      return
    }
    
    const index = handlers[event].indexOf(handler)
    if (index !== -1) {
      handlers[event].splice(index, 1)
    }
  },
  
  $emit(event, payload) {
    if (!handlers[event] || handlers[event].length === 0) {
      console.log(`No handlers for event: ${event}`)
      return
    }
    
    for (const handler of handlers[event]) {
      try {
        handler(payload)
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error)
      }
    }
  }
}
