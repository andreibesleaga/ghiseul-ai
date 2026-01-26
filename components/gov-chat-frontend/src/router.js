// src/router.js
import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'
import LoginScreen from '@/components/LoginScreen.vue'
import RegisterScreen from '@/components/RegisterScreen.vue'
import PasswordResetInitiateScreen from '@/components/PasswordResetInitiateScreen.vue'
import PasswordResetConfirmScreen from '@/components/PasswordResetConfirmScreen.vue'
import store from '@/store'
import userService from '@/services/userService' // Import userService
import RegistrationSuccessScreen from '@/components/RegistrationSuccessScreen.vue'

import UserProfileComponent from '@/components/UserProfileComponent.vue'
import UnifiedAnalytics from '@/components/UnifiedAnalytics.vue'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: LoginScreen,
    meta: { requiresAuth: false }
  },
  {
    path: '/register',
    name: 'Register',
    component: RegisterScreen,
    meta: { requiresAuth: false }
  },

  // Email verification result handler
  {
    path: '/verify-email-success',
    name: 'VerifyEmailResult',
    component: () => import('@/components/EmailVerificationScreen.vue'),
    props: route => ({ 
      verificationStatus: route.query.status === 'success' ? 'success' : 'error',
      errorType: route.query.reason || null,
      token: route.query.token || null,
    }),
    meta: { requiresAuth: false }
  },

  // Keep the original token route for backward compatibility
  {
    path: '/verify-email/:token',
    name: 'VerifyEmail',
    component: () => import('@/components/EmailVerificationScreen.vue'),
    props: route => ({ 
      token: route.params.token,
      verificationStatus: route.query.verified === 'true' ? 'success' : 
                         route.query.verificationError ? 'error' : null,
      errorType: route.query.verificationError || null
    }),
    meta: { requiresAuth: false },
    // Add this to prevent reprocessing when query params are changed
    beforeEnter: (to, from, next) => {
      // If we're coming from the same path with different query params
      // (this happens during the redirect from the server),
      // don't trigger a new navigation as it would cause a loop
      if (from.path === to.path && 
         (to.query.verified !== undefined || to.query.verificationError !== undefined)) {
        // Just update the component props without a full navigation
        return true;
      }
      next();
    }
  },

  {
    path: '/registration-success',
    name: 'RegistrationSuccess',
    component: RegistrationSuccessScreen,
    props: route => ({ email: route.query.email }),
    meta: { requiresAuth: false }
  },
  {
    path: '/forgot-password',
    name: 'PasswordResetInitiate',
    component: PasswordResetInitiateScreen,
    meta: { requiresAuth: false }
  },
  {
    path: '/reset-password/:token',
    name: 'PasswordResetConfirm',
    component: PasswordResetConfirmScreen,
    props: true, // Allow passing route params as props
    meta: { requiresAuth: false }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: DashboardView,
    meta: { requiresAuth: true }
  },
  {
    path: '/analytics',
    name: 'Analytics',
    component: UnifiedAnalytics,
    meta: { requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'UserProfile',
    component: UserProfileComponent,
    meta: { requiresAuth: true }
  },
  // redirect root to login if not authenticated, otherwise to dashboard
  {
    path: '/',
    name: 'Root',
    redirect: to => {
      // Use both store and userService to check authentication
      return (store.getters.isAuthenticated || userService.isAuthenticated())
        ? '/dashboard'
        : '/login'
    }
  },
  // catch-all -> login if not authenticated, otherwise dashboard
  {
    path: '/:pathMatch(.*)*',
    redirect: to => {
      // Use both store and userService to check authentication
      return (store.getters.isAuthenticated || userService.isAuthenticated())
        ? '/dashboard'
        : '/login'
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Authentication navigation guard
router.beforeEach((to, from, next) => {
  // Initialize authentication if not already done
  if (store.state.auth && store.state.auth.user === null) {
    store.dispatch('initAuth')

    // If userService has authentication but store doesn't, sync them
    if (userService.isAuthenticated()) {
      const userData = userService.getCurrentUser();
      store.commit('setUser', userData);
    }
  }

  // Check if the user is authenticated (check both store and userService)
  const isAuthenticated = store.getters.isAuthenticated || userService.isAuthenticated()

  // Check if the route requires authentication
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth !== false)

  if (requiresAuth && !isAuthenticated) {
    // Route requires auth but user is not authenticated
    // Redirect to login with error message and save intended destination
    next({
      name: 'Login',
      query: {
        redirect: to.fullPath,
        error: 'Please log in to access this page'
      }
    })
  } else if ((to.path === '/login' || to.path === '/register' || to.path === '/forgot-password') && isAuthenticated) {
    // User is authenticated but trying to access login, register, or forgot password page
    next({ name: 'Dashboard' })
  } else {
    // Either route doesn't require auth, or user is authenticated
    next()
  }
})

export default router