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
    <h1>Join Room</h1>
    <input v-model="code" placeholder="Enter 5-letter code" />
    <button @click="join" :disabled="loading">Join</button>
    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>
