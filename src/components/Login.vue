<script setup lang="ts">
import { useGraffiti } from "@graffiti-garden/wrapper-vue";
import { useRouter } from "vue-router";
import { watch, getCurrentInstance } from "vue";

const graffiti = useGraffiti();
const router = useRouter();

// Get the global properties from the current instance
const instance = getCurrentInstance();
const $graffitiSession = instance?.appContext.config.globalProperties.$graffitiSession;

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
        <h1 class="title">FILL</h1>
      </div>
      <div class="button-section">
        <!-- Only show login button if not logged in -->
        <button
          v-if="$graffitiSession === null"
          @click="handleLogin"
          class="login-button"
        >
          LOGIN
        </button>
        <p v-else-if="$graffitiSession === undefined" class="loading-text"> <!--check user logged in -->
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

</style>
