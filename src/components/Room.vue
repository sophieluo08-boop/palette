<script setup lang="ts">
import { ref, onMounted, onUnmounted, getCurrentInstance, watch} from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGraffiti } from '@graffiti-garden/wrapper-vue'
import Gameplay from './Gameplay.vue'
import Chat from './Chat.vue'

const route = useRoute()
const router = useRouter()
const code = (route.params.code || '').toString().toUpperCase()
const graffiti = useGraffiti()
const participants = ref<Record<string, number>>({})

const isCreator = ref(false)
const isMultiplayer = ref(true) // set to true for room-based games

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

async function checkIfCreator() {
  const session = $graffitiSession?.value
  if (!session) {
    isCreator.value = false
    return
  }
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

onMounted(async () => {
  await checkIfCreator()
})

watch(
  () => $graffitiSession?.value,
  async (session) => {
    await checkIfCreator()
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

const sharedGrid = ref<string[][] | null>(null)
const sharedColors = ref<[string, string] | null>(null)

function pickTwoColors(): [string, string] {
  const colorsPalette = ['#FF595E', '#1982C4', '#6A4C93', '#8ACB88', '#FFD166', '#06D6A0', '#FFB4A2'];
  const a = Math.floor(Math.random() * colorsPalette.length);
  let b = Math.floor(Math.random() * colorsPalette.length);
  while (b === a) b = Math.floor(Math.random() * colorsPalette.length);
  return [colorsPalette[a], colorsPalette[b]];
}

function generateSharedGrid() {
  const [a, b] = pickTwoColors();
  sharedColors.value = [a, b];
  const g: string[][] = [];
  for (let r = 0; r < 3; r++) {
    const row: string[] = [];
    for (let c = 0; c < 3; c++) {
      row.push(Math.random() < 0.5 ? a : b);
    }
    g.push(row);
  }
  sharedGrid.value = g;
  return { grid: g, colors: [a, b] };
}

const showGame = ref(false)

async function startGame() {
  if (!isCreator.value) return;
  const session = $graffitiSession?.value;
  if (!session) return;

  const { grid, colors } = generateSharedGrid();

  try {
    console.log('Posting game start with grid:', grid, 'colors:', colors);
    await graffiti.post({
      channels: ["game-" + code],
      value: {
        type: 'start',
        grid,
        colors,
        ts: Date.now(),
      }
    }, session);
    console.log('Game start posted successfully');

    // Small delay to ensure the message is propagated
    await new Promise(resolve => setTimeout(resolve, 500));

    // Route to gameplay page with multiplayer param
    router.push({ name: 'gameplay', query: { multiplayer: '1', code } })
  } catch (e) {
    console.error('Error posting game start:', e);
    alert('Failed to start game. Please try again.');
  }
}


// Poll for a start message every 2 seconds for non-creators

let startPollingInterval: number | undefined;
async function pollForGameStart() {
  if (isCreator.value) return; // creator already routes on start
  const session = $graffitiSession?.value;
  if (!session) return;

  try {
    console.log('Polling for game start...');
    const iterator = graffiti.discover(["game-" + code], {}, session);

    for await (const item of iterator) {
      // Robustly extract the message from possible nesting
      const obj = item.object ?? item;
      const message = obj.value ?? obj;

      console.log('pollForGameStart discovered:', message);

      if (message.type === 'start' && message.grid && message.colors) {
        console.log('Found game start message! Routing to gameplay...');
        // Route to gameplay; Gameplay.vue will fetch the grid/colors from the message
        router.push({ name: 'gameplay', query: { multiplayer: '1', code } });
        if (startPollingInterval) clearInterval(startPollingInterval);
        return;
      }
    }
  } catch (e) {
    console.error('Error polling for game start:', e);
  }
}

onMounted(() => {
  if (!isCreator.value) {
    pollForGameStart();
    startPollingInterval = window.setInterval(pollForGameStart, 2000);
  }
});

onUnmounted(() => {
  if (startPollingInterval) clearInterval(startPollingInterval);
  if (heartbeat) clearInterval(heartbeat);
});

function copyRoomCode() {
  navigator.clipboard.writeText(code).then(() => {
    alert('Room code copied to clipboard!')
  }, (err) => {
    console.error('Could not copy text: ', err)
  })
}
</script>

<template>
  <router-link to="/" class="home-btn">Home</router-link>
  <div class="room-page">
    <h2>Room</h2>
    <div class="room-code-box">
      <span class="room-code">{{ code }}</span>
      <button @click="copyRoomCode" class="copy-btn">Copy</button>
    </div>
    <button @click="startGame" :disabled="!isCreator" class="start-game-btn">Start Game</button>
    <p v-if="!isCreator" class="not-creator-msg">Only the room creator can start the game.</p>
    <p>Participants: {{ Object.keys(participants).length }}</p>
    <div style="margin-top: 20px;">
      <button @click="fetchPresence" class="refresh-btn">Refresh Participants</button>
    </div>
    <Gameplay v-if="showGame && sharedGrid && sharedColors" :solution-grid="sharedGrid" :color-a="sharedColors[0]" :color-b="sharedColors[1]" />
    <!-- Chat box below room info -->
    <div style="margin-top: 2.5rem;">
      <Chat :channel="'room-' + code" />
    </div>
  </div>
</template>

<style scoped>
.room-page {
  background: #fff;
  color: #23272f;
  max-width: 480px;
  margin: 3rem auto 0 auto;
  border-radius: 18px;
  box-shadow: 0 4px 32px 0 rgba(0,0,0,0.10);
  padding: 2.5rem 2rem 2rem 2rem;
  font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
  position: relative;
}
.home-btn {
  position: absolute;
  top: 1.2rem;
  left: 1.2rem;
  background: #f8f8fa;
  color: #2563eb;
  font-weight: 700;
  border: none;
  border-radius: 8px;
  padding: 0.5rem 1.2rem;
  text-decoration: none;
  font-size: 1.1rem;
  box-shadow: 0 2px 8px 0 rgba(0,0,0,0.04);
  transition: background 0.18s;
  z-index: 10;
}
.home-btn:hover {
  background: #e0eaff;
}
.room-code-box {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
  justify-content: center;
}
.room-code {
  font-size: 2.7rem;
  font-weight: 800;
  background: #f8f8fa;
  color: #2d2d2d;
  padding: 1rem 2.5rem;
  border-radius: 12px;
  border: 2px solid #e0e0e0;
  letter-spacing: 0.22rem;
  font-family: 'Fira Mono', 'Consolas', 'Menlo', monospace;
  user-select: all;
  box-shadow: 0 2px 8px 0 rgba(0,0,0,0.04);
}
.start-game-btn {
  padding: 0.5rem 1.1rem;
  border-radius: 7px;
  border: none;
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  background: #bfc7d1;
  color: #fff;
  cursor: not-allowed;
  transition: background 0.2s;
}
.start-game-btn:enabled {
  background: #4f8cff;
  cursor: pointer;
}
.start-game-btn:enabled:hover {
  background: #2563eb;
}
.not-creator-msg {
  color: #aaa;
  margin-bottom: 1rem;
}
h2 {
  font-size: 2.1rem;
  font-weight: 800;
  margin-bottom: 1.2rem;
  letter-spacing: 0.04em;
}
.status, p {
  color: #555;
  font-size: 1.08rem;
}
ul {
  margin-top: 1.5rem;
  padding-left: 1.2rem;
}
li {
  margin-bottom: 0.4rem;
  font-size: 1.05rem;
}
.game-ui {
  margin-top: 2rem;
  padding: 1rem;
  border-top: 1px solid #e0e0e0;
}
.game-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.grid-row {
  display: flex;
  flex-direction: row;
  gap: 4px;
}
.grid-cell {
  width: 40px;
  height: 40px;
  border-radius: 4px;
}
.game-colors {
  display: flex;
  flex-direction: row;
  gap: 8px;
  margin-top: 1rem;
}
.color-box {
  width: 40px;
  height: 40px;
  border-radius: 4px;
}
.refresh-btn {
  margin-top: 0.5rem;
  padding: 0.5rem 1.2rem;
  border-radius: 8px;
  border: none;
  background: #e0eaff;
  color: #2563eb;
  font-weight: 700;
  font-size: 1.05rem;
  box-shadow: 0 2px 8px 0 rgba(0,0,0,0.04);
  cursor: pointer;
  transition: background 0.18s;
}
.refresh-btn:hover {
  background: #c7dbff;
}
.copy-btn {
  padding: 0.5rem 1.1rem;
  border-radius: 8px;
  border: none;
  background: #e0eaff;
  color: #2563eb;
  font-weight: 700;
  font-size: 1.05rem;
  box-shadow: 0 2px 8px 0 rgba(0,0,0,0.04);
  cursor: pointer;
  transition: background 0.18s;
}
.copy-btn:hover {
  background: #c7dbff;
}
</style>
