<script setup lang="ts">
import { useGraffiti } from "@graffiti-garden/wrapper-vue";
import { useRouter } from "vue-router";
import { watch, getCurrentInstance } from "vue";

const graffiti = useGraffiti();
const router = useRouter();

// Get the global properties from the current instance
const instance = getCurrentInstance();
const $graffitiSession = instance?.appContext.config.globalProperties.$graffitiSession;

// Redirect to login if session is lost
if ($graffitiSession) {
  watch($graffitiSession, (session) => {
    if (session === null) {
      router.push("/"); //logged out, redirect to login
    }
  });
}

const handleLogout = async () => {
  if ($graffitiSession?.value) {
    await graffiti.logout($graffitiSession.value);
    router.push("/");
  }
};
</script>

<template>
  <div v-if="$graffitiSession" class="home">
    <div class="content">
      <div class="title-section">
        <h1 class="title">FILL</h1>
        <p class="user-info">
          Logged in as:
          <code>
            <GraffitiActorToHandle :actor="$graffitiSession.actor" />
          </code>
        </p>
      </div>
      <div class="button-section">
        <router-link to="/gameplay" class="play-button">
          PLAY
        </router-link>
        <router-link to="/create-room" class="create-room-button">CREATE ROOM</router-link>
        <router-link to="/join-room" class="join-room-button">JOIN ROOM</router-link>
        <button @click="handleLogout" class="logout-button">
          LOGOUT
        </button>
      </div>
    </div>
  </div>
  <div v-else-if="$graffitiSession === null" class="redirect">
    <p>Not logged in.</p>
    <router-link to="/">Back to Login</router-link>
  </div>
  <div v-else class="loading">
    <p>Loading...</p>
  </div>
</template>

<style scoped>
.home {
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
  flex-direction: column;
  align-items: flex-start;
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

.user-info {
  color: white;
  font-size: 1rem;
  margin-top: 1rem;
}

.user-info code {
  background-color: rgba(255, 255, 255, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.button-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 1rem;
}

.play-button, .create-room-button, .join-room-button, .logout-button {
  display: inline-block;
  padding: 1rem 2rem;
  background-color: white;
  color: black;
  text-decoration: none;
  font-size: 1.25rem;
  font-weight: bold;
  border-radius: 12px;
  transition: all 0.3s ease;
  cursor: pointer;
  box-shadow: 0 8px 25px rgba(255, 255, 255, 0.2);
  border: none;
}

.logout-button {
  padding: 1rem 2rem;
  font-size: 1rem;
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
}

.play-button:hover, .create-room-button:hover, .join-room-button:hover, .logout-button:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 35px rgba(255, 255, 255, 0.3);
}

.play-button:hover {
  background-color: #f0f0f0;
}


.logout-button:hover {
  background-color: rgba(255, 255, 255, 0.3);
}

.play-button:active, .create-room-button:active, .logout-button:active {
  transform: translateY(-1px);
}

.redirect, .loading {
  color: white;
  text-align: center;
  padding: 2rem;
}

.redirect a {
  color: white;
  text-decoration: underline;
}

@media (max-width: 768px) {
  .content {
    flex-direction: column;
    gap: 2rem;
  }

  .title {
    font-size: 5rem;
  }
}
</style>
