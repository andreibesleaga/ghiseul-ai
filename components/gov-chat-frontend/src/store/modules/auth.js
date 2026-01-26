// src/store/modules/auth.js
// Update your Vuex store auth module to integrate with userService

import userService from '@/services/userService'

const state = {
  user: null,
  isInitialized: false
}

const getters = {
  isAuthenticated: state => !!state.user,
  currentUser: state => state.user
}

const actions = {
  // Initialize authentication state from localStorage
  initAuth({ commit }) {
    const user = userService.getCurrentUser()
    
    if (user) {
      commit('setUser', user)
    } else {
      commit('clearUser')
    }
    
    commit('setInitialized')
  },
  
  // Perform login
  async login({ commit }, { username, password }) {
    try {
      const userData = await userService.login(username, password)
      commit('setUser', userData)
      return userData
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  },
  
  // Perform logout
  async logout({ commit }) {
    try {
      await userService.logout()
      commit('clearUser')
    } catch (error) {
      console.error('Logout error:', error)
      // Still clear the user from the store even if the API call fails
      commit('clearUser')
      throw error
    }
  },
  
  // Update user profile
  updateUser({ commit }, userData) {
    commit('setUser', userData)
  }
}

const mutations = {
  setUser(state, user) {
    state.user = user
  },
  
  clearUser(state) {
    state.user = null
  },
  
  setInitialized(state) {
    state.isInitialized = true
  }
}

export default {
  state,
  getters,
  actions,
  mutations
}