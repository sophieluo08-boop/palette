<script setup lang="ts">
import { useGraffiti } from "@graffiti-garden/wrapper-vue";
import { useRouter } from "vue-router";
import { watch, getCurrentInstance } from "vue";

const graffiti = useGraffiti();
const router = useRouter();

// Get the global properties from the current instance
const instance = getCurrentInstance();
const $graffitiSession = instance?.appContext.config.globalProperties.$graffitiSession;

console.log('Login.vue: $graffitiSession =', $graffitiSession)

// Watch for session changes and redirect when logged in
if ($graffitiSession) {
  watch($graffitiSession, (session) => {
    if (session) {
      router.push("/home");
    }
  });
}

const handleLogin = async () => {
  await graffiti.login();
};
</script>

<template>
  <div class="login">
    <div class="content">
      <div class="title-section">
        <h1 class="title">PALETTE</h1>
      </div>
      <div class="button-section">
        <!-- Show login button if session is missing or invalid -->
        <button
          v-if="!$graffitiSession || !$graffitiSession.value || !$graffitiSession.value.actor"
          @click="handleLogin"
          class="login-button"
        >
          LOGIN
        </button>
        <p v-else class="loading-text">
          Loading...
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: black;
  position: relative;
}

.content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 1200px;
  padding: 0 2rem;
  gap: 4rem;
}

.title-section {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.title {
  font-size: 10rem;
  font-weight: 900;
  color: white;
  margin: 0;
  letter-spacing: 0.1em;
  text-shadow: 0 4px 20px rgba(255, 255, 255, 0.3);
}

.button-section {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.login-button {
  display: inline-block;
  padding: 2rem 4rem;
  background-color: white;
  color: black;
  text-decoration: none;
  font-size: 2rem;
  font-weight: bold;
  border-radius: 12px;
  transition: all 0.3s ease;
  cursor: pointer;
  box-shadow: 0 8px 25px rgba(255, 255, 255, 0.2);
  border: none;
}

.loading-text {
  color: #fff;
  font-size: 2rem;
  font-weight: 600;
}

@media (max-width: 700px) {
  .content {
    flex-direction: column;
    gap: 2rem;
    padding: 0 1rem;
    justify-content: center;
  }
  .title-section {
    justify-content: center;
  }
  .title {
    font-size: 2.5rem;
    text-align: center;
  }
  .button-section {
    justify-content: center;
  }
}
</style>
