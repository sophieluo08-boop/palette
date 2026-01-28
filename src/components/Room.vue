<script setup lang="ts">
import { ref, onMounted, onUnmounted, getCurrentInstance, watch} from 'vue'
import { useRoute } from 'vue-router'
import { useGraffiti } from '@graffiti-garden/wrapper-vue'

const route = useRoute()
const code = (route.params.code || '').toString().toUpperCase()
const graffiti = useGraffiti()
const participants = ref<Record<string, number>>({})

const isCreator = ref(false)

const instance = getCurrentInstance()
const $graffitiSession = instance?.appContext.config.globalProperties.$graffitiSession
let heartbeat: number | undefined


function actorKey(actor: any): string | null {
  if (typeof actor === 'string') return actor
  if (actor?.id) return actor.id
  if (actor?.handle) return actor.handle
  return null
}

async function fetchPresence() {
  try {
    const session = $graffitiSession?.value
    if (!session) {
      participants.value = {}
      return
    }

    const iterator = graffiti.discover(
      [`room-${code}`],
      {},
      session
    )

    const now = Date.now()
    const active: Record<string, number> = {}

    const items: any[] = []

    for await (const item of iterator) items.push(item)

    for (const item of items) {
    const obj = item.object ?? item
    const val = obj.value ?? obj

    if (val?.type !== 'presence') continue

    const key = actorKey(val.actor)
    if (!key) continue

    const ts = val.ts ?? obj.timestamp ?? Date.now()
    const age = Date.now() - ts

    if (age < 45_000) {
        active[key] = Math.max(active[key] || 0, ts)
    }
    }


    participants.value = active
  } catch (e) {
    console.error('fetchPresence error:', e)
    participants.value = {}
  }
}


async function postPresence() {
  const session = $graffitiSession?.value
  if (!session) return

  try {
    const payload = {
      channels: [`room-${code}`],
      value: {
        type: 'presence',
        actor: session.actor,
        ts: Date.now()
      },
    }
    console.log('Posting:', JSON.stringify(payload, null, 2))
    const result = await graffiti.post(payload, session)
    console.log('Post result:', result)
  } catch (e) {
    console.error('postPresence error:', e)
  }
}

onMounted(async () => {
  const session = $graffitiSession?.value
  if (session) {
    const result = await graffiti.discover(["fill:"+code, "fill"], {}, session)
    let found = false

    const getActorId = (actor: any): string | null => {
      if (typeof actor === 'string') return actor
      if (actor && typeof actor === 'object') return actor.id ?? null
      return null
    }

    const sessionActorId = getActorId(session.actor)

    if (Array.isArray(result)) {
      for (const item of result) {
        const obj = (item as any).object ?? item
        const val = obj.value ?? obj
        const itemActorId = getActorId(obj.actor)

        if (val?.code === code && val?.createdAt && itemActorId === sessionActorId) {
          found = true
          break
        }
      }
    } else if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
      for await (const item of result) {
        const obj = (item as any).object ?? item
        const val = obj.value ?? obj
        const itemActorId = getActorId(obj.actor)

        if (val?.code === code && val?.createdAt && itemActorId === sessionActorId) {
          found = true
          break
        }
      }
    }
    isCreator.value = found
  }
})

watch(
  () => $graffitiSession?.value,
  async (session) => {
    if (!session) return

    await postPresence()
    await fetchPresence()

    if (!heartbeat) {
      heartbeat = window.setInterval(async () => {
        await postPresence()
        await fetchPresence()
      }, 20_000)
    }
  },
  { immediate: true }
)


onUnmounted(() => {
  if (heartbeat) clearInterval(heartbeat)
})

function startGame() {
  if (!isCreator.value) return
  alert('Game started! (implement logic)')
}

function copyRoomCode() {
  navigator.clipboard.writeText(code).then(() => {
    alert('Room code copied to clipboard!')
  }, (err) => {
    console.error('Could not copy text: ', err)
  })
}
</script>

<template>
  <div class="room-page">
    <h2>Room</h2>
    <div class="room-code-box">
      <span class="room-code">{{ code }}</span>
      <button @click="copyRoomCode">Copy</button>
    </div>
    <button @click="startGame" :disabled="!isCreator" style="margin-bottom:1rem;">Start Game</button>
    <p v-if="!isCreator" style="color:#aaa;">Only the room creator can start the game.</p>
    <p>Participants: {{ Object.keys(participants).length }}</p>
    <ul>
      <li v-for="(ts, handle) in participants" :key="handle">
        {{ handle }} ({{ Math.round((Date.now() - ts) / 1000) }}s ago)
      </li>
    </ul>
    <div style="margin-top: 20px;">
      <button @click="fetchPresence">Refresh Participants</button>
    </div>
  </div>
</template>

<style scoped>
.room-code-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.room-code {
  font-size: 2rem;
  font-weight: bold;
  background: #222;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  letter-spacing: 0.15rem;
}
</style>
