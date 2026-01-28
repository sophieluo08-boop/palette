<script setup lang="ts">
import { ref, computed, onMounted, watch, getCurrentInstance } from 'vue'
import { useRouter } from 'vue-router'
import { useGraffiti } from '@graffiti-garden/wrapper-vue'
import type { GraffitiSession } from '@graffiti-garden/api'

const graffiti = useGraffiti()

const creating = ref(false)
const created = ref(false)
const createdAt = ref<number | null>(null)

//reactive channels list
const room = ref<string | null>(null)

//access global session
const instance = getCurrentInstance()
const $graffitiSession = instance?.appContext.config.globalProperties.$graffitiSession

function genCode(len = 5) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  return Array.from({ length: len }, () => letters[Math.floor(Math.random() * letters.length)]).join('')
}

const router = useRouter()
async function createRoomWithCode(session: GraffitiSession) {
  if (!session || !room.value || created.value) return
  try {
    creating.value = true
    await graffiti.post(
      {
        channels: ["fill:"+room.value, "fill"],
        value: { code: room.value, createdAt: Date.now() },
      },
      session,
    )
    created.value = true
    createdAt.value = Date.now()
    // Redirect to Room page after creation
    router.push({ name: 'Room', params: { code: room.value } })
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  room.value = genCode(5)
  if ($graffitiSession?.value) createRoomWithCode($graffitiSession.value)
})

if ($graffitiSession) {
  watch($graffitiSession, (session) => {
    if (session) createRoomWithCode(session)
  })
}

function regenAndCreate() {
  created.value = false
  room.value = genCode(5)
  if ($graffitiSession?.value) createRoomWithCode($graffitiSession.value)
}

function copyCode() {
  if (!room.value) return
  void navigator.clipboard?.writeText(room.value)
}
</script>

<template>
  <div class="create-room">
    <h1>Create Room</h1>
    <p>Unique 5-letter code will be generated and persisted to Graffiti.</p>

    <div v-if="$graffitiSession === undefined">Loading session…</div>
    <div v-else-if="$graffitiSession === null">
      <p>Please <router-link to="/">log in</router-link> to create a room.</p>
    </div>
    <div v-else class="room-area">
      <div class="code-box">
        <div class="label">Room Code</div>
        <div class="code">{{ room }}</div>
        <div class="meta">
          <button @click="copyCode">Copy</button>
        </div>
      </div>

      <div class="status">
        <p v-if="creating">Creating room…</p>
        <p v-else-if="created">Room created at {{ createdAt ? new Date(createdAt).toLocaleString() : '' }}</p>
        <p v-else>Not yet created — will create automatically when logged in.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.create-room { color: white; padding: 2rem; }
.code-box { display:flex; flex-direction:column; gap:0.5rem; align-items:center }
.label { color:#ccc }
.code { font-size:2.25rem; font-weight:700; letter-spacing:0.15rem; background:#111; padding:0.75rem 1.5rem; border-radius:8px }
.meta { display:flex; gap:0.5rem; margin-top:0.5rem }
button { padding:0.4rem 0.8rem; border-radius:6px; border:none; cursor:pointer }
.status { margin-top:1rem; color:#ddd }
</style>
