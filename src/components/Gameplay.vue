<template>
  <div class="gameplay">
    <header class="header">
      <h1>Gameplay</h1>
      <div class="controls">
        <div class="phase">Phase: <strong>{{ phaseLabel }}</strong></div>
        <div class="timer">Time left: <strong>{{ displaySeconds }}</strong>s</div>
        <button class="restart" @click="restart">Restart</button>
        <router-link to="/home" class="back-button">← Back to Home</router-link>
      </div>
    </header>

    <section class="grid-wrap"> <!--layout and centering-->
      <div class="grid"> <!--grid container-->
        <template v-for="(row, rIndex) in solutionGrid" :key="rIndex">
          <div
            v-for="(col, cIndex) in row"
            :key="`${rIndex}-${cIndex}`"
            class="cell"
            :class="{ clickable: phase === 'input' && !finished }"
            :style="{ backgroundColor: cellColor(rIndex, cIndex) }"
            @click="handleCellClick(rIndex, cIndex)"
          ></div>
        </template>
      </div>

      <div class="palette" v-if="phase === 'input'">
        <div class="palette-label">Palette:</div>
        <div class="palette-swatches">
          <button
            class="palette-swatch"
            :class="{ selected: selectedColor === colorA }"
            :style="{ backgroundColor: colorA }"
            @click="selectColor(colorA)"
          ></button>
          <button
            class="palette-swatch"
            :class="{ selected: selectedColor === colorB }"
            :style="{ backgroundColor: colorB }"
            @click="selectColor(colorB)"
          ></button>
          <button
            class="palette-swatch eraser"
            :class="{ selected: selectedColor === '' }"
            @click="selectColor('')"
          >Eraser</button>
        </div>
      </div>

      <div class="result" v-if="finished">
        <div class="score">Score: <strong>{{ correctCells }}/9</strong></div>
      </div>
    </section>

    <div v-if="showLeaderboard" class="leaderboard-modal">
      <div class="leaderboard-popup">
        <h2>Leaderboard</h2>
        <table class="leaderboard-table">
          <thead>
            <tr><th>Rank</th><th>User</th><th>Score</th></tr>
          </thead>
          <tbody>
            <tr v-for="(entry, idx) in leaderboard" :key="entry.handle + idx">
              <td>{{ idx + 1 }}</td>
              <td><GraffitiActorToHandle :actor="entry.actor" /></td>
              <td>{{ entry.score}}</td>
            </tr>
          </tbody>
        </table>
        <button @click="showLeaderboard = false">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, getCurrentInstance } from 'vue';
import { useRoute } from 'vue-router'
import { useGraffiti } from '@graffiti-garden/wrapper-vue'

const GRID_SIZE = 3;
const MEMORIZE_TIME = 15;
const INPUT_TIME = 30;

const colorsPalette = ['#FF595E', '#1982C4', '#6A4C93', '#8ACB88', '#FFD166', '#06D6A0', '#FFB4A2'];

function pickTwoColors(): [string, string] {
  const a = Math.floor(Math.random() * colorsPalette.length);
  let b = Math.floor(Math.random() * colorsPalette.length);
  while (b === a) b = Math.floor(Math.random() * colorsPalette.length);
  return [colorsPalette[a], colorsPalette[b]];
}

const colorA = ref('');
const colorB = ref('');
const solutionGrid = ref<string[][]>([]);
const userGrid = ref<string[][]>([]);

const memorizeSeconds = ref(MEMORIZE_TIME);
const inputSeconds = ref(INPUT_TIME);
const phase = ref<'memorize' | 'input' | 'finished'>('memorize');
const selectedColor = ref('');
const finished = ref(false);
let timerId: number | undefined;

// Synchronized timer state
const gameStartTime = ref<number>(0); // Server timestamp when game started
const currentServerTime = ref<number>(Date.now()); // Estimated current server time

const route = useRoute()
const isMultiplayer = route.query.multiplayer === '1'
const roomCode = route.query.code || ''

const graffiti = useGraffiti()
const instance = getCurrentInstance()
const $graffitiSession = instance?.appContext.config.globalProperties.$graffitiSession

const phaseLabel = computed(() => {
  if (phase.value === 'memorize') return 'Memorize';
  if (phase.value === 'input') return 'Input';
  return 'Finished';
});

// For multiplayer, calculate seconds based on server time
const displaySeconds = computed(() => {
  if (!isMultiplayer || gameStartTime.value === 0) {
    // Single player or not yet synced - use local timer
    return phase.value === 'memorize' ? memorizeSeconds.value : inputSeconds.value;
  }

  // Multiplayer - calculate from server time
  const elapsed = (currentServerTime.value - gameStartTime.value) / 1000;

  if (phase.value === 'memorize') {
    const remaining = Math.max(0, MEMORIZE_TIME - elapsed);
    return Math.ceil(remaining);
  } else if (phase.value === 'input') {
    const inputElapsed = elapsed - MEMORIZE_TIME;
    const remaining = Math.max(0, INPUT_TIME - inputElapsed);
    return Math.ceil(remaining);
  }

  return 0;
});

// --- Scoring and Leaderboard ---
const correctCells = computed(() => {
  let s = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (userGrid.value[r][c] && userGrid.value[r][c] === solutionGrid.value[r][c]) s++;
    }
  }
  return s;
});

const accuracy = computed(() => correctCells.value / (GRID_SIZE * GRID_SIZE));
const timeTaken = ref(0); // seconds
const timeBonus = computed(() => {
  // Max bonus if finished instantly, min if used all time
  const bonus = 1.0 - (timeTaken.value / INPUT_TIME);
  return Math.max(0.2, bonus);
});
const finalScore = computed(() => {
  // Weighted: accuracy × 100 × timeBonus
  return Math.round(accuracy.value * 100 * timeBonus.value);
});
const score = computed(() => finalScore.value);

const leaderboard = ref([]);
const showLeaderboard = ref(false);

// Add a roundId to identify the current round (use gameStartTime)
const roundId = computed(() => gameStartTime.value || 0);

// Get the user's Graffiti handle from session
function getUserHandle() {
  const session = $graffitiSession?.value;
  if (!session) return 'anon';
  const actor = session.actor;

  // Try to get handle from actor object
  if (typeof actor === 'object') {
    // Check for handle property (e.g., "sophie.graffiti.garden")
    if (actor.handle) return actor.handle;
    // Check for id property with handle format
    if (actor.id && actor.id.includes('.graffiti.')) return actor.id;
  }

  // If actor is a string, check if it's a handle
  if (typeof actor === 'string') {
    if (actor.includes('.graffiti.')) return actor;
    // If it's a DID, extract a shortened version
    if (actor.startsWith('did:plc:')) return actor.slice(8, 20) + '...';
    return actor;
  }

  return 'anon';
}

// Helper to display a user-friendly username in leaderboard
function displayUsername(handle: string) {
  // If it's already a nice Graffiti handle (e.g., "sophie.graffiti.garden")
  if (handle && handle.includes('.graffiti.')) {
    return handle;
  }

  // If it's a DID, show a shortened version
  if (handle && handle.startsWith('did:plc:')) {
    return handle.slice(8, 20) + '...';
  }

  // Otherwise return as-is or 'anon'
  return handle || 'anon';
}

async function postScoreToGraffiti() {
  if (!isMultiplayer || !roomCode) return;
  const session = $graffitiSession?.value;
  if (!session) return;
  const handle = getUserHandle();
  try {
    await graffiti.post({
      channels: ["score-" + roomCode],
      value: {
        type: 'score',
        handle,
        score: finalScore.value,
        time: timeTaken.value,
        ts: Date.now(),
        roundId: roundId.value,
      }
    }, session);
    console.log('Posted score for handle:', handle, 'score:', finalScore.value);
  } catch (e) {
    console.error('Failed to post score:', e);
  }
}

async function fetchLeaderboardWithParticipants() {
  if (!isMultiplayer || !roomCode) return;
  const session = $graffitiSession?.value;
  if (!session) return;
  const scoresMap = new Map(); // Use Map to avoid duplicates, keyed by handle

  try {
    // Fetch scores for this round only
    const scoreIter = graffiti.discover(["score-" + roomCode], {}, session);
    for await (const item of scoreIter) {
      const obj = item.object ?? item;
      const val = obj.value ?? obj;
      if (val.type === 'score' && val.handle && val.roundId === roundId.value) {
        // Keep only the best score per user (or latest if same score)
        const existing = scoresMap.get(val.handle);
        if (!existing || val.score > existing.score || (val.score === existing.score && val.ts > existing.ts)) {
          scoresMap.set(val.handle, {
            handle: val.handle,
            score: val.score,
            accuracy: val.accuracy,
            time: val.time,
            ts: val.ts,
            actor: obj.actor
          });
        }
      }
    }

    // Convert to array and sort by score (highest first), then by time (lowest first)
    const sortedScores = Array.from(scoresMap.values());
    sortedScores.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score; // Higher score first
      return a.time - b.time; // Lower time first
    });

    leaderboard.value = sortedScores;
    console.log('Leaderboard updated:', leaderboard.value);
  } catch (e) {
    console.error('Failed to fetch leaderboard:', e);
    leaderboard.value = [];
  }
}

// Broadcast a 'show-leaderboard' message after the round ends
async function broadcastShowLeaderboard() {
  if (!isMultiplayer || !roomCode || !roundId.value) return;
  const session = $graffitiSession?.value;
  if (!session) return;
  try {
    await graffiti.post({
      channels: ["leaderboard-" + roomCode],
      value: {
        type: 'show-leaderboard',
        roundId: roundId.value,
        ts: Date.now(),
      }
    }, session);
  } catch (e) {
    console.error('Failed to broadcast show-leaderboard:', e);
  }
}

// Listen for 'show-leaderboard' messages and display leaderboard for all users
async function listenForShowLeaderboard() {
  if (!isMultiplayer || !roomCode) return;
  const session = $graffitiSession?.value;
  if (!session) return;
  const iterator = graffiti.discover(["leaderboard-" + roomCode], {}, session);
  for await (const item of iterator) {
    const obj = item.object ?? item;
    const val = obj.value ?? obj;
    if (val.type === 'show-leaderboard' && val.roundId === roundId.value) {
      await fetchLeaderboardWithParticipants();
      showLeaderboard.value = true;
      break;
    }
  }
}

function generateGrid() {
  const [a, b] = pickTwoColors();
  colorA.value = a;
  colorB.value = b;
  const g: string[][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    const row: string[] = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      row.push(Math.random() < 0.5 ? a : b);
    }
    g.push(row);
  }
  solutionGrid.value = g;
}

function startMemorize() {
  clearTimer();
  phase.value = 'memorize';

  if (!isMultiplayer) {
    // Single player - use local timer
    memorizeSeconds.value = MEMORIZE_TIME;
    finished.value = false;
    selectedColor.value = colorA.value || '';
    timerId = window.setInterval(() => {
      memorizeSeconds.value--;
      if (memorizeSeconds.value <= 0) {
        startInput();
      }
    }, 1000) as unknown as number;
  } else {
    // Multiplayer - use synchronized timer
    finished.value = false;
    selectedColor.value = colorA.value || '';

    // Update current server time every 100ms for smooth countdown
    timerId = window.setInterval(() => {
      currentServerTime.value += 100;

      const elapsed = (currentServerTime.value - gameStartTime.value) / 1000;
      if (elapsed >= MEMORIZE_TIME && phase.value === 'memorize') {
        startInput();
      }
    }, 100) as unknown as number;
  }
}

function startInput() {
  clearTimer();
  phase.value = 'input';

  const ug: string[][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    const row: string[] = [];
    for (let c = 0; c < GRID_SIZE; c++) row.push('');
    ug.push(row);
  }
  userGrid.value = ug;
  selectedColor.value = colorA.value || '';

  if (!isMultiplayer) {
    // Single player - use local timer
    inputSeconds.value = INPUT_TIME;
    timerId = window.setInterval(() => {
      inputSeconds.value--;
      if (inputSeconds.value <= 0) {
        finishInput();
      }
    }, 1000) as unknown as number;
  } else {
    // Multiplayer - use synchronized timer
    timerId = window.setInterval(() => {
      currentServerTime.value += 100;

      const elapsed = (currentServerTime.value - gameStartTime.value) / 1000;
      const inputElapsed = elapsed - MEMORIZE_TIME;

      if (inputElapsed >= INPUT_TIME && phase.value === 'input' && !finished.value) {
        finishInput();
      }
    }, 100) as unknown as number;
  }
}

// In finishInput, show leaderboard popup immediately after fetching
function finishInput() {
  clearTimer();
  finished.value = true;
  phase.value = 'finished';

  if (!isMultiplayer) {
    timeTaken.value = INPUT_TIME - inputSeconds.value;
  } else {
    const elapsed = (currentServerTime.value - gameStartTime.value) / 1000;
    const inputElapsed = elapsed - MEMORIZE_TIME;
    timeTaken.value = Math.min(INPUT_TIME, Math.max(0, inputElapsed));
  }

  if (isMultiplayer && roomCode) {
    postScoreToGraffiti().then(() => {
      setTimeout(async () => {
        await broadcastShowLeaderboard();
        await fetchLeaderboardWithParticipants();
        showLeaderboard.value = true;
      }, 1000);
    });
  }
}

function clearTimer() {
  if (timerId !== undefined) {
    clearInterval(timerId);
    timerId = undefined;
  }
}

function restart() {
  generateGrid();
  startMemorize();
}

function selectColor(col: string) {
  selectedColor.value = col;
}

function handleCellClick(r: number, c: number) {
  if (phase.value !== 'input' || finished.value) return;
  if (selectedColor.value === '') {
    userGrid.value[r][c] = '';
  } else {
    userGrid.value[r][c] = selectedColor.value;
  }
}

function cellColor(r: number, c: number) {
  if (phase.value === 'memorize') return solutionGrid.value[r][c];
  const val = userGrid.value[r]?.[c];
  return val && val !== '' ? val : '#111';
}

async function loadMultiplayerGame() {
  console.log('Loading multiplayer game for room:', roomCode);
  const session = $graffitiSession?.value;

  try {
    const iterator = graffiti.discover(["game-" + roomCode], {}, session);

    for await (const item of iterator) {
      // Robustly extract the message
      const obj = item.object ?? item;
      const message = obj.value ?? obj;

      console.log('Discovered message:', message);

      if (message.type === 'start' && message.grid && message.colors && message.ts) {
        console.log('Found game start! Grid:', message.grid, 'Colors:', message.colors, 'TS:', message.ts);

        // Set the colors and grid from the message
        colorA.value = message.colors[0];
        colorB.value = message.colors[1];
        solutionGrid.value = message.grid;

        // Synchronize timer - use server timestamp from message
        gameStartTime.value = message.ts;
        currentServerTime.value = Date.now(); // Current local time

        // Adjust for any drift - assume message.ts is authoritative
        // Calculate where we are in the game timeline
        const elapsed = (Date.now() - message.ts) / 1000;

        if (elapsed < MEMORIZE_TIME) {
          // Still in memorize phase
          phase.value = 'memorize';
          startMemorize();
        } else if (elapsed < MEMORIZE_TIME + INPUT_TIME) {
          // Already in input phase
          phase.value = 'input';
          startInput();
        } else {
          // Game already finished
          console.warn('Game already finished');
          finishInput();
        }

        return true;
      }
    }

    console.warn('No game start message found');
    return false;
  } catch (e) {
    console.error('Error loading multiplayer game:', e);
    return false;
  }
}

onMounted(async () => {
  if (isMultiplayer && roomCode) {
    console.log('Multiplayer mode detected, loading shared game...');
    const success = await loadMultiplayerGame();
    if (!success) {
      console.error('Failed to load multiplayer game');
      alert('Failed to load the multiplayer game. Please try again.');
    } else {
      listenForShowLeaderboard();
    }
  } else {
    // Single player mode
    restart();
  }
});

onBeforeUnmount(() => {
  clearTimer();
});
</script>

<style scoped>
  .gameplay {
    width: 100%;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: #0b0b0b;
    color: white;
    padding: 2rem;
    box-sizing: border-box;
  }

  .header {
    width: 100%;
    max-width: 1100px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .phase { font-size: 0.95rem; }
  .timer { font-size: 1.2rem; }

  .restart {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: none;
    background: #1e1e1e;
    color: white;
    cursor: pointer;
  }

  .back-button {
    padding: 0.5rem 1rem;
    background-color: white;
    color: black;
    text-decoration: none;
    border-radius: 6px;
  }

  .grid-wrap {
    width: 100%;
    max-width: 600px;
    margin-top: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    width: 100%;
  }

  .cell {
    width: 100%;
    padding-top: 100%; /* square */
    position: relative;
    border-radius: 12px;
    box-shadow: 0 6px 18px rgba(0,0,0,0.5);
    overflow: hidden;
    transition: transform 0.12s ease;
  }

  .cell.clickable { cursor: pointer; }
  .cell.clickable:active { transform: scale(0.98); }

  .palette {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    margin-top: 12px;
  }

  .palette-label { color: #ddd; }
  .palette-swatches { display: flex; gap: 0.5rem; align-items: center; }
  .palette-swatch {
    width: 44px;
    height: 44px;
    border-radius: 8px;
    border: 2px solid rgba(255,255,255,0.12);
    cursor: pointer;
  }
  .palette-swatch.selected { outline: 3px solid rgba(255,255,255,0.12); }
  .palette-swatch.eraser { background: #222; color: #ddd; display: flex; align-items: center; justify-content: center; padding: 0 8px; }

  .result { margin-top: 8px; }
  .score { color: #ffd166; font-weight: 700; }

  .leaderboard-modal {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .leaderboard-popup {
    background: #fff;
    color: #23272f;
    border-radius: 16px;
    box-shadow: 0 4px 32px 0 rgba(0,0,0,0.18);
    padding: 2rem 2.5rem 1.5rem 2.5rem;
    min-width: 340px;
    max-width: 90vw;
  }
  .leaderboard-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1.2rem;
  }
  .leaderboard-table th, .leaderboard-table td {
    padding: 0.5rem 0.7rem;
    border-bottom: 1px solid #e0e0e0;
    text-align: center;
  }
  .leaderboard-table th {
    background: #f8f8fa;
    font-weight: 700;
  }
  .leaderboard-table tr:last-child td {
    border-bottom: none;
  }
  .leaderboard-popup button {
    margin-top: 0.5rem;
    padding: 0.5rem 1.2rem;
    border-radius: 7px;
    border: none;
    background: #4f8cff;
    color: #fff;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  .leaderboard-popup button:hover {
    background: #2563eb;
  }

  @media (max-width: 600px) { .grid-wrap { max-width: 320px; } }
</style>
