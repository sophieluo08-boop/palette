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
        <div class="score">Score: <strong>{{ score }}/9</strong></div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';

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

const phaseLabel = computed(() => {
  if (phase.value === 'memorize') return 'Memorize';
  if (phase.value === 'input') return 'Input';
  return 'Finished';
});

const displaySeconds = computed(() => (phase.value === 'memorize' ? memorizeSeconds.value : inputSeconds.value));

const score = computed(() => {
  if (!finished.value) return 0;
  let s = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (userGrid.value[r][c] && userGrid.value[r][c] === solutionGrid.value[r][c]) s++;
    }
  }
  return s;
});

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
  memorizeSeconds.value = MEMORIZE_TIME;
  finished.value = false;
  selectedColor.value = colorA.value || '';
  timerId = window.setInterval(() => {
    memorizeSeconds.value--;
    if (memorizeSeconds.value <= 0) {
      startInput();
    }
  }, 1000) as unknown as number;
}

function startInput() {
  clearTimer();
  phase.value = 'input';
  inputSeconds.value = INPUT_TIME;
  const ug: string[][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    const row: string[] = [];
    for (let c = 0; c < GRID_SIZE; c++) row.push('');
    ug.push(row);
  }
  userGrid.value = ug;
  selectedColor.value = colorA.value || '';
  timerId = window.setInterval(() => {
    inputSeconds.value--;
    if (inputSeconds.value <= 0) {
      finishInput();
    }
  }, 1000) as unknown as number;
}

function finishInput() {
  clearTimer();
  finished.value = true;
  phase.value = 'finished';
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

onMounted(() => {
  restart();
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

  @media (max-width: 600px) { .grid-wrap { max-width: 320px; } }

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

  @media (max-width: 600px) { .grid-wrap { max-width: 320px; } }
</style>
