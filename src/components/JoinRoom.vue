<script setup lang="ts">
import { ref, getCurrentInstance } from 'vue'
import { useRouter } from 'vue-router'
import { useGraffiti } from '@graffiti-garden/wrapper-vue'
import type { GraffitiSession } from '@graffiti-garden/api'

const router = useRouter()
const graffiti = useGraffiti()

// access global $graffitiSession like other components
const instance = getCurrentInstance()
const $graffitiSession = instance?.appContext.config.globalProperties.$graffitiSession
const code = ref('')
const loading = ref(false)
const error = ref('')

async function findRoom(codeStr: string) {
  const session = $graffitiSession?.value
  if (!session) return undefined
  try {
    const results = graffiti.discover?.(['rooms'], {}, session)
    if (!results) return undefined

    // If results is an array
    if (Array.isArray(results)) {
      for (const r of results) {
        const val = r.value ?? r.body ?? r.payload ?? r
        if (val?.code === codeStr) return r
      }
      return undefined
    }

    // If results is an async iterable
    if ((results as any)[Symbol.asyncIterator]) {
      for await (const r of results as AsyncIterable<any>) {
        const val = r.value ?? r.body ?? r.payload ?? r
        if (val?.code === codeStr) return r
      }
      return undefined
    }

    // (Removed sync iterable check because GraffitiObjectStream is async only)

    return undefined
  } catch (e) {
    console.warn('findRoom discover error', e)
    return undefined
  }
}

async function join() {
  error.value = ''
  const raw = code.value.trim()
  if (!raw) { error.value = 'Enter a code'; return }
  const normalized = raw.toUpperCase()
  loading.value = true
  try {
    const session = $graffitiSession?.value
    if (!session) { error.value = 'Not logged in'; return }

    // Post with allowed: [] to make it publicly readable
    await graffiti.post(
      {
        channels: [`room-${normalized}`],
        value: { type: 'join', actor: session.actor, ts: Date.now() },
      },
      session,
    )

    router.push({ name: 'Room', params: { code: normalized } })
  } finally { loading.value = false }
}
</script>

<template>
  <div class="join-room">
    <div class="join-card">
      <h1>Join a Room</h1>
      <p class="subtitle">Enter your 5-letter room code below to join a game.</p>
      <input v-model="code" maxlength="5" placeholder="Room Code" class="room-input" />
      <button @click="join" :disabled="loading" class="join-btn">Join Room</button>
      <div v-if="error" class="error-msg">{{ error }}</div>
    </div>
  </div>
</template>

<style scoped>
.join-room {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(120deg, #e0eaff 0%, #f8f8fa 100%);
}
.join-card {
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 4px 32px 0 rgba(0,0,0,0.10);
  padding: 2.5rem 2.5rem 2rem 2.5rem;
  max-width: 350px;
  width: 100%;
  text-align: center;
}
h1 {
  font-size: 2.1rem;
  font-weight: 800;
  margin-bottom: 0.7rem;
  color: #2563eb;
  letter-spacing: 0.04em;
}
.subtitle {
  color: #555;
  font-size: 1.08rem;
  margin-bottom: 1.5rem;
}
.room-input {
  width: 100%;
  font-size: 1.3rem;
  padding: 0.7rem 1.2rem;
  border-radius: 10px;
  border: 2px solid #e0e0e0;
  background: #f8f8fa;
  margin-bottom: 1.2rem;
  font-family: 'Fira Mono', 'Consolas', 'Menlo', monospace;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  transition: border 0.2s;
}
.room-input:focus {
  border-color: #2563eb;
  outline: none;
}
.join-btn {
  width: 100%;
  padding: 0.7rem 0;
  font-size: 1.15rem;
  font-weight: 700;
  border-radius: 10px;
  border: none;
  background: #4f8cff;
  color: #fff;
  box-shadow: 0 2px 8px 0 rgba(0,0,0,0.04);
  cursor: pointer;
  transition: background 0.18s;
}
.join-btn:disabled {
  background: #bfc7d1;
  cursor: not-allowed;
}
.join-btn:not(:disabled):hover {
  background: #2563eb;
}
.error-msg {
  color: #c9372c;
  margin-top: 1rem;
  font-size: 1.05rem;
}
</style>
