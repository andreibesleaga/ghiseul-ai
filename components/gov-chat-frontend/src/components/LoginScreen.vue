// src/components/LoginScreen.vue
<template>
  <div class="login-container" :data-theme="theme">
    <div class="login-card">
      <div class="logo">
        <div class="app-logo">
          <img
            :src="$config.app.icon.value"
            alt="App Icon"
            class="ui-icon"
            v-if="
              $config &&
              $config.app &&
              $config.app.icon &&
              $config.app.icon.type === 'file'
            "
          />
          <div class="app-logo-fallback" v-else></div>
        </div>
        <h1 class="app-name">
          {{ $config && $config.app ? $config.app.title : $t('login.title') }}
        </h1>
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <form
        id="login-form"
        name="login-form"
        action="/api/auth/login"
        method="POST"
        @submit.prevent="handleLogin"
        class="login-form"
      >
        <div class="form-group">
          <input
            id="username"
            v-model="username"
            type="text"
            :placeholder="$t('login.username')"
            class="form-control"
            autocomplete="username"
            required
          />
        </div>

        <div class="form-group">
          <input
            id="password"
            v-model="password"
            type="password"
            :placeholder="$t('login.password')"
            class="form-control"
            autocomplete="current-password"
            required
          />
        </div>

        <div class="remember-forgot">
          <label class="remember-me">
            <input type="checkbox" v-model="rememberMe" />
            <span>{{ $t('login.rememberMe') }}</span>
          </label>
          <a href="#" @click.prevent="goToForgotPassword" class="forgot-link">
            {{ $t('login.forgotPassword') }}
          </a>
        </div>

        <button type="submit" class="login-button" :disabled="isLoading">
          <span v-if="isLoading">{{ $t('login.loggingIn') }}</span>
          <span v-else>{{ $t('login.loginButton') }}</span>
        </button>
      </form>

      <!-- Fixed Register Account Link using router-link -->
      <div class="register-account">
        <p>
          {{ $t('login.noAccount') }}
          <router-link to="/register" class="login-link">{{
            $t('login.registerNow')
          }}</router-link>
        </p>
      </div>

      <div class="divider">
        <span class="divider-line"></span>
        <span class="divider-text">{{ $t('login.or') }}</span>
        <span class="divider-line"></span>
      </div>

      <div class="social-login">
        <button
          @click="handleGoogleLogin"
          class="social-button google-button"
          :disabled="isLoading"
        >
          <div class="button-content">
            <svg class="social-icon" viewBox="0 0 24 24" width="18" height="18">
              <g transform="matrix(1, 0, 0, 1, 0, 0)">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </g>
            </svg>
            <span>Continue with Google</span>
          </div>
        </button>

        <button
          @click="handleFacebookLogin"
          class="social-button facebook-button"
          :disabled="isLoading"
        >
          <div class="button-content">
            <svg class="social-icon" width="18" height="18" viewBox="0 0 24 24">
              <path
                d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
                fill="#FFFFFF"
              />
            </svg>
            <span>Continue with Facebook</span>
          </div>
        </button>
      </div>

      <div v-if="savedAccounts.length > 0" class="saved-accounts">
        <h3 style="color: #fff !important">{{ $t('login.savedAccounts') }}</h3>
        <div class="accounts-container">
          <div
            v-for="account in savedAccounts"
            :key="account.id"
            class="account-item"
            @click="loginWithSavedAccount(account)"
          >
            <div class="account-left">
              <div class="account-initials">
                {{ account.name.charAt(0)
                }}{{ account.name.split(' ')[1]?.charAt(0) || '' }}
              </div>
              <span class="account-name">{{ account.name }}</span>
            </div>

            <div class="account-provider">
              <template v-if="account.provider === 'Google'">
                <svg
                  class="provider-icon"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                >
                  <g transform="matrix(1, 0, 0, 1, 0, 0)">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </g>
                </svg>
                <span>Google</span>
              </template>
              <template v-else-if="account.provider === 'Facebook'">
                <svg
                  class="provider-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
                    fill="#1877F2"
                  />
                </svg>
                <span>Facebook</span>
              </template>
              <template v-else>
                {{ account.provider }}
              </template>
            </div>
          </div>
        </div>
      </div>

      <div class="login-footer">
        <p class="terms-policy">
          By logging in, you agree to our Terms of Service and Privacy Policy
        </p>
        <div class="language-selector">
          <language-selector />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import userService from '@/services/userService'
import { eventBus } from '@/eventBus.js'
import LanguageSelector from '@/components/LanguageSelector.vue'

export default {
  name: 'LoginScreen',
  components: {
    LanguageSelector
  },
  props: {
    theme: {
      type: String,
      default: 'light'
    }
  },
  data() {
    return {
      username: '',
      password: '',
      rememberMe: false,
      isLoading: false,
      error: '',
      savedAccounts: [
        {
          id: 1,
          name: 'John Doe',
          provider: 'Google',
          email: 'john.doe@gmail.com'
        },
        {
          id: 2,
          name: 'Jane Smith',
          provider: 'Facebook',
          email: 'jane.smith@facebook.com'
        }
      ]
    }
  },
  created() {
    document.documentElement.setAttribute('data-theme', this.theme)
    this.ensureViewportMeta()
    this.error = ''
    if (this.$route.query.error) {
      this.error = this.$route.query.error
    }
    try {
      console.log('[DEBUG] Attempting to retrieve credentials from localStorage')
      const savedLoginName = localStorage.getItem('savedLoginName')
      const savedPassword = localStorage.getItem('savedPassword')
      if (savedLoginName && savedPassword) {
        console.log('[DEBUG] Retrieved credentials from localStorage:', {
          id: savedLoginName
        })
        this.username = savedLoginName
        this.password = savedPassword
        this.rememberMe = true
      } else {
        console.log('[DEBUG] No credentials found in localStorage')
      }
    } catch (error) {
      console.error(
        '[DEBUG] Error retrieving credentials from localStorage:',
        error
      )
    }
  },
  mounted() {
    this.setMobileHeight()
    window.addEventListener('resize', this.setMobileHeight)
    this.applyTheme()
    this.observeThemeChanges()
    const checkbox = document.querySelector('.remember-me input')
    console.log(
      '[LOGIN] Checkbox computed background color:',
      checkbox ? window.getComputedStyle(checkbox).backgroundColor : 'not found'
    )
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.setMobileHeight)
    if (this.themeObserver) {
      console.log('[LOGIN] Disconnecting MutationObserver')
      this.themeObserver.disconnect()
    }
  },
  watch: {
    theme(newTheme) {
      console.log(
        '[LOGIN] Theme prop updated:',
        newTheme,
        'source: prop change',
        new Date().toISOString()
      )
      this.applyTheme()
    }
  },
  methods: {
    setMobileHeight() {
      const vh = window.innerHeight * 0.01
      document.documentElement.style.setProperty('--vh', `${vh}px`)
    },

    ensureViewportMeta() {
      if (!document.querySelector('meta[name="viewport"]')) {
        const meta = document.createElement('meta')
        meta.name = 'viewport'
        meta.content =
          'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
        document.getElementsByTagName('head')[0].appendChild(meta)
      }
    },

    goToForgotPassword() {
      this.$router.push('/forgot-password')
    },

    async handleLogin() {
      try {
        this.error = ''
        this.isLoading = true

        if (!this.username || !this.password) {
          this.error = this.$t('login.fieldsRequired')
          return
        }

        const result = await userService.login(this.username, this.password)

        if (!result || !result.accessToken) {
          this.error = this.$t('login.invalidCredentials')
          return
        }

        if (this.rememberMe) {
          try {
            console.log(
              '[DEBUG] Attempting to store credentials in localStorage for username:',
              result.loginName
            )
            localStorage.setItem('savedLoginName', result.loginName)
            localStorage.setItem('savedPassword', this.password)
            console.log(
              '[DEBUG] Credentials stored successfully in localStorage'
            )
          } catch (error) {
            console.error(
              '[DEBUG] Error storing credentials from localStorage:',
              error
            )
          }
        } else {
          try {
            console.log('[DEBUG] Clearing credentials from localStorage')
            localStorage.removeItem('savedLoginName')
            localStorage.removeItem('savedPassword')
            console.log('[DEBUG] Credentials cleared from localStorage')
          } catch (error) {
            console.error(
              '[DEBUG] Error clearing credentials from localStorage:',
              error
            )
          }
        }

        this.$store.dispatch('initAuth')
        this.$store.commit('setUser', result)

        // Emit login success event
        console.log("Emitting login-success with user data:", result);
        this.$emit('login-success', result)

        // Show welcome toast
        if (this.$config?.features?.chat?.welcomeMessage) {
          console.log("Showing welcome toast");
          eventBus.$emit('notification:show', {
            message: this.$config.features.chat.welcomeMessage,
            type: 'success',
            duration: 5000
          })
          console.log('[DEBUG] Welcome toast shown')
        }


        // Navigate to home or dashboard or redirect URL
        const redirectPath = this.$route.query.redirect || '/'
        console.log("Navigating to:", redirectPath);
        this.$router.push(redirectPath)
      } catch (error) {
        console.error('Login error:', error)
        if (error.status === 401) {
          this.error = this.$t('login.invalidCredentials')
        } else if (error.status === 429) {
          this.error = this.$t('login.tooManyAttempts')
        } else {
          this.error = this.$t('login.loginFailed')
        }
      } finally {
        this.isLoading = false
      }
    },

    async handleGoogleLogin() {
      try {
        this.error = ''
        this.isLoading = true
        this.error = this.$t('login.oauthNotImplemented')
      } catch (error) {
        console.error('Google login error:', error)
        this.error = this.$t('login.loginFailed')
      } finally {
        this.isLoading = false
      }
    },

    async handleFacebookLogin() {
      try {
        this.error = ''
        this.isLoading = true
        this.error = this.$t('login.oauthNotImplemented')
      } catch (error) {
        console.error('Facebook login error:', error)
        this.error = this.$t('login.loginFailed')
      } finally {
        this.isLoading = false
      }
    },

    async loginWithSavedAccount(account) {
      try {
        this.error = ''
        this.isLoading = true
        this.error = this.$t('login.savedLoginNotImplemented')
      } catch (error) {
        console.error('Saved account login error:', error)
        this.error = this.$t('login.loginFailed')
      } finally {
        this.isLoading = false
      }
    },

    applyTheme() {
      console.log(
        '[LOGIN] Applying theme:',
        this.theme,
        new Date().toISOString()
      )
      const currentTheme = document.documentElement.getAttribute('data-theme')
      if (currentTheme !== this.theme) {
        console.warn(
          '[LOGIN] Theme mismatch: component theme=',
          this.theme,
          'vs DOM theme=',
          currentTheme
        )
      }
      document.documentElement.setAttribute('data-theme', this.theme)
      const title = document.querySelector('.login-card .app-name')
      console.log(
        '[LOGIN] Title computed color:',
        title ? window.getComputedStyle(title).color : 'not found'
      )
    },

    observeThemeChanges() {
      console.log(
        '[LOGIN] Setting up MutationObserver, initial theme:',
        this.theme,
        new Date().toISOString()
      )
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'data-theme') {
            const newTheme =
              document.documentElement.getAttribute('data-theme')
            console.log(
              '[LOGIN] Detected theme change via MutationObserver:',
              newTheme,
              new Date().toISOString()
            )
            if (newTheme !== this.theme) {
              console.log('[LOGIN] Updating component theme to:', newTheme)
              this.theme = newTheme
              const title = document.querySelector('.login-card .app-name')
              console.log(
                '[LOGIN] Title computed color after change:',
                title ? window.getComputedStyle(title).color : 'not found'
              )
            }
          }
        })
      })
      observer.observe(document.documentElement, { attributes: true })
      this.themeObserver = observer
    }
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  min-height: calc(var(--vh, 1vh) * 100);
  padding: 16px;
  padding-top: env(safe-area-inset-top, 16px);
  padding-bottom: env(safe-area-inset-bottom, 16px);
  box-sizing: border-box;
}

[data-theme='light'] .login-container {
  background-color: var(--bg-primary, #f5f7fa);
}

[data-theme='dark'] .login-container {
  background-color: var(--bg-primary, #1e1e1e);
}

.login-card {
  width: 100%;
  max-width: 400px;
  max-height: 95vh;
  border-radius: 16px;
  box-shadow: var(--shadow-md);
  padding: 24px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}

[data-theme='light'] .login-card {
  background-color: var(--bg-secondary, #ffffff);
  color: var(--text-primary, #333333);
}

[data-theme='dark'] .login-card {
  background-color: var(--bg-secondary, #252525);
  color: var(--text-primary, #f0f0f0);
}

.error-message {
  background-color: rgba(255, 77, 77, 0.2);
  border: 1px solid rgba(255, 77, 77, 0.4);
  color: #ff4d4d;
  padding: 10px;
  margin-bottom: 16px;
  border-radius: 8px;
  font-size: 14px;
  text-align: center;
}

.logo {
  text-align: center;
  margin-bottom: 16px;
}

.app-logo {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: var(--bg-button-primary, #2a9d8f);
  margin-bottom: 10px;
}

.app-logo:has(.ui-icon) {
  background-color: transparent;
}

.ui-icon {
  width: 60px;
  height: 60px;
  display: block;
  margin: 0 auto;
}

.app-logo-fallback {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: var(--bg-button-primary, #2a9d8f);
}

.app-name {
  font-size: 28px;
  margin: 0;
  font-weight: bold;
}

[data-theme='light'] .login-card .app-name {
  color: #000000 !important;
}

[data-theme='dark'] .login-card .app-name {
  color: var(--text-primary, #f0f0f0) !important;
}

.login-form {
  margin-bottom: 16px;
}

.form-group {
  margin-bottom: 10px;
}

.form-control {
  width: 100%;
  padding: 10px 12px;
  font-size: 15px;
  border: none;
  border-radius: 8px;
  transition: background-color 0.2s;
}

[data-theme='light'] .form-control {
  background-color: var(--bg-tertiary, #f0f2f5) !important;
  color: var(--text-primary, #333333);
}

[data-theme='dark'] .form-control {
  background-color: var(--bg-input, #333333);
  color: var(--text-primary, #f0f0f0);
}

.form-control:focus {
  outline: none;
}

[data-theme='light'] .form-control:focus {
  background-color: var(--bg-primary, #f5f7fa) !important;
}

[data-theme='dark'] .form-control:focus {
  background-color: var(--bg-input, #2a2a2a);
}

.remember-forgot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  font-size: 13px;
}

.remember-me {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.remember-me input {
  appearance: none;
  background-color: var(--bg-button-primary, #2a9d8f) !important;
  border: 1px solid #ffffff;
  width: 16px;
  height: 16px;
  position: relative;
  margin-right: 5px;
}

.remember-me input:checked::after {
  content: '\2713';
  color: #ffffff;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 12px;
}

[data-theme='light'] .remember-me span {
  color: var(--text-secondary, #4d4d4d);
}

[data-theme='dark'] .remember-me span {
  color: var(--text-secondary, #b3b3b3);
}

.forgot-link {
  color: var(--bg-button-primary, #2a9d8f);
  text-decoration: none;
}

.forgot-link:hover {
  text-decoration: underline;
}

.login-button {
  width: 100%;
  padding: 10px;
  background-color: var(--bg-button-primary, #2a9d8f);
  color: var(--text-button-primary, #ffffff);
  font-size: 15px;
  font-weight: bold;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

[data-theme='dark'] .login-button {
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.login-button:hover:not(:disabled) {
  background-color: var(--bg-button-primary-hover, #24887d);
}

.login-button:disabled {
  background-color: var(--bg-button-primary, #2a9d8f);
  cursor: not-allowed;
  opacity: 0.7;
}

.register-account {
  text-align: center;
  margin-top: 12px;
  font-size: 14px;
}

.login-link {
  color: var(--bg-button-primary, #2a9d8f);
  text-decoration: none;
  cursor: pointer;
  font-weight: 500;
}

.login-link:hover {
  text-decoration: underline;
}

.divider {
  display: flex;
  align-items: center;
  margin: 14px 0;
}

.divider-line {
  flex: 1;
  height: 1px;
}

[data-theme='light'] .divider-line {
  background-color: var(--border-light, #e5e7eb);
}

[data-theme='dark'] .divider-line {
  background-color: var(--border-light, #333333);
}

.divider-text {
  padding: 0 15px;
  font-size: 13px;
}

[data-theme='light'] .divider-text {
  color: var(--text-tertiary, #767676);
}

[data-theme='dark'] .divider-text {
  color: var(--text-tertiary, #8c8c8c);
}

.social-login {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 14px 0;
}

.social-button {
  display: flex;
  align-items: center;
  padding: 0;
  height: 36px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s;
  overflow: hidden;
  border: none;
  text-align: left;
  font-weight: 500;
}

.social-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-content {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0 14px;
}

.social-icon {
  min-width: 18px;
  height: 18px;
  margin-right: 20px;
  flex-shrink: 0;
}

.google-button,
.facebook-button {
  background-color: var(--bg-button-primary, #2a9d8f);
  color: var(--text-button-primary, #ffffff);
}

[data-theme='dark'] .google-button,
[data-theme='dark'] .facebook-button {
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.google-button:hover:not(:disabled),
.facebook-button:hover:not(:disabled) {
  background-color: var(--bg-button-primary-hover, #24887d);
}

.saved-accounts {
  margin-top: 16px;
  border-top: 1px solid #444;
  padding-top: 14px;
}

[data-theme='light'] .saved-accounts {
  background-color: var(--bg-secondary, #ffffff);
  color: var(--text-primary, #333333);
}

[data-theme='dark'] .saved-accounts {
  background-color: var(--bg-secondary, #252525);
  color: var(--text-primary, #f0f0f0);
}

.saved-accounts h3 {
  font-size: 15px;
  margin: 0 0 10px 0;
  font-weight: 500;
}

[data-theme='light'] .saved-accounts h3 {
  color: var(--text-primary, #333333);
}

[data-theme='dark'] .saved-accounts h3 {
  color: var(--text-primary, #f0f0f0);
}

.accounts-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

[data-theme='light'] .accounts-container {
  background-color: var(--bg-secondary, #ffffff);
}

[data-theme='dark'] .accounts-container {
  background-color: var(--bg-secondary, #252525);
}

.account-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
  background-color: var(--bg-button-primary, #2a9d8f);
}

[data-theme='dark'] .account-item {
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.account-item:hover {
  background-color: var(--bg-button-primary-hover, #24887d);
}

.account-left {
  display: flex;
  align-items: center;
}

.account-initials {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background-color: var(--bg-button-primary, #2a9d8f);
  color: white;
  font-weight: bold;
  margin-right: 10px;
  font-size: 13px;
}

.account-name {
  font-weight: 500;
  font-size: 14px;
}

[data-theme='light'] .account-name {
  color: var(--text-primary, #333333);
}

[data-theme='dark'] .account-name {
  color: var(--text-primary, #f0f0f0);
}

.account-provider {
  display: flex;
  align-items: center;
  padding: 3px 6px;
  border-radius: 6px;
  font-size: 11px;
}

[data-theme='light'] .account-provider {
  background-color: var(--bg-tertiary, #f0f2f5);
  color: var(--text-muted, #6c757d);
}

[data-theme='dark'] .account-provider {
  background-color: var(--bg-tertiary, #2a2a2a);
  color: var(--text-muted, #9ca3af);
}

.provider-icon {
  margin-right: 5px;
  width: 14px;
  height: 14px;
}

.login-footer {
  margin-top: auto;
  padding-top: 10px;
  text-align: center;
  font-size: 11px;
}

.terms-policy {
  margin-bottom: 10px;
}

[data-theme='light'] .terms-policy {
  color: var(--text-muted, #6c757d);
}

[data-theme='dark'] .terms-policy {
  color: var(--text-muted, #9ca3af);
}

.language-selector {
  margin-top: 8px;
}

.language-selector :deep(select) {
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 14px;
  padding-right: 28px;
  cursor: pointer;
}

[data-theme='light'] .language-selector :deep(select) {
  background-color: var(--bg-input, #ffffff);
  color: var(--text-primary, #333333);
  border: 1px solid var(--border-input, #dcdfe4);
}

[data-theme='dark'] .language-selector :deep(select) {
  background-color: var(--bg-input, #333333);
  color: var(--text-primary, #f0f0f0);
  border: 1px solid var(--border-input, #3a3a3a);
}

.language-selector :deep(select:focus) {
  outline: none;
  border-color: var(--bg-button-primary, #2a9d8f);
}

@media (max-width: 480px) {
  .login-card {
    padding: 20px 16px;
    max-height: 92vh;
  }

  .app-logo {
    width: 50px;
    height: 50px;
  }

  .ui-icon,
  .app-logo-fallback {
    width: 50px;
    height: 50px;
  }

  .app-name {
    font-size: 24px;
  }

  .login-container {
    padding: 10px;
    overflow-y: hidden;
  }
}

@media (min-height: 800px) {
  .login-card {
    padding: 24px;
    max-height: 760px;
  }
}

.saved-accounts h3 {
  color: #fff !important;
}

.login-card .saved-accounts h3 {
  color: inherit !important;
}
</style>