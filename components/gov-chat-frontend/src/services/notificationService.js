// src/services/notificationService.js
import { eventBus } from '../eventBus.js';

export default {
  /**
   * Show a notification
   * @param {String} message - Notification message
   * @param {String} type - Notification type ('success', 'error', 'info', 'warning')
   * @param {Number} duration - Duration in milliseconds (default: 3000)
   */
  show(message, type = 'success', duration = 3000) {
    eventBus.$emit('notification:show', { message, type, duration });
  },
  
  /**
   * Show a success notification
   * @param {String} message - Notification message
   * @param {Number} duration - Duration in milliseconds (default: 3000)
   */
  success(message, duration = 3000) {
    this.show(message, 'success', duration);
  },
  
  /**
   * Show an error notification
   * @param {String} message - Notification message
   * @param {Number} duration - Duration in milliseconds (default: 3000)
   */
  error(message, duration = 3000) {
    this.show(message, 'error', duration);
  },
  
  /**
   * Show an info notification
   * @param {String} message - Notification message
   * @param {Number} duration - Duration in milliseconds (default: 3000)
   */
  info(message, duration = 3000) {
    this.show(message, 'info', duration);
  },
  
  /**
   * Show a warning notification
   * @param {String} message - Notification message
   * @param {Number} duration - Duration in milliseconds (default: 3000)
   */
  warning(message, duration = 3000) {
    this.show(message, 'warning', duration);
  }
};