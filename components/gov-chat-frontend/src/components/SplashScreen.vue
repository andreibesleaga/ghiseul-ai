// src/components/SplashScreen.vue
<template>
  <div class="splash-screen" :class="{ 'fade-out': isFadingOut }">
    <div class="splash-content">
      <img
        src="/config/splash.png"
        alt="Splash Screen"
        class="splash-image"
        @error="handleImageError"
        @load="handleImageLoad"
      />
      <div v-if="imageError" class="splash-fallback">
        Splash Screen Fallback
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "SplashScreen",
  data() {
    return {
      isFadingOut: false,
      imageError: false,
    };
  },
  mounted() {
    console.log("SplashScreen.vue: Component mounted");
    setTimeout(() => {
      console.log("SplashScreen.vue: Starting fade-out after 5 seconds");
      this.isFadingOut = true;
      setTimeout(() => {
        console.log("SplashScreen.vue: Fade-out complete, emitting splash-complete");
        this.$emit("splash-complete");
      }, 1000); // 1s fade-out duration
    }, 5000); // 5s display duration
  },
  methods: {
    handleImageLoad() {
      console.log("SplashScreen.vue: SVG image loaded successfully");
    },
    handleImageError() {
      console.error("SplashScreen.vue: Failed to load SVG image");
      this.imageError = true;
    },
  },
};
</script>

<style scoped>
.splash-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 30000; /* Ensure it’s above other elements */
  background-color: rgba(245, 247, 250, 0.5); /* Default semi-transparent light background */
  animation: splash-fade-in 0.5s ease-in;
}

.splash-content {
  text-align: center;
}

.splash-image {
  max-width: 50%;
  max-height: 50%;
  object-fit: contain;
  border-radius: 20px; /* Rounded corners for the box */
  box-shadow: 50px 50px 20px rgba(0, 0, 0, 0.5); /* 50px right and bottom drop shadow, 20px blur, 50% opacity */
}

.splash-fallback {
  color: var(--text-primary, #333);
  font-size: 1.5rem;
  margin-top: 1rem;
}

.splash-screen.fade-out {
  animation: splash-fade-out 1s ease-out forwards;
}

/* Override for dark theme */
#app[data-theme="dark"] .splash-screen {
  background-color: rgba(30, 30, 30, 0.5); /* Semi-transparent dark background */
}

@keyframes splash-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes splash-fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
</style>