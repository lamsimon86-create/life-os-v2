<template>
  <div class="relative">
    <button @click="showDetail = !showDetail" class="focus:outline-none">
      <svg :width="size" :height="size" viewBox="0 0 48 48">
        <!-- Body -->
        <circle
          :cx="24" :cy="bodyY"
          :r="bodyRadius"
          :fill="bodyColor"
          :opacity="mood === 'sad' ? 0.5 : 1"
        >
          <!-- Idle bounce for happy -->
          <animate
            v-if="mood === 'happy'"
            attributeName="cy"
            :values="`${bodyY};${bodyY - 2};${bodyY}`"
            dur="1s"
            repeatCount="indefinite"
          />
        </circle>

        <!-- Eyes -->
        <circle :cx="24 - eyeOffset" :cy="eyeY" r="2" fill="#0f172a" />
        <circle :cx="24 + eyeOffset" :cy="eyeY" r="2" fill="#0f172a" />

        <!-- Mouth -->
        <path
          v-if="mood === 'happy'"
          :d="`M${24 - mouthWidth} ${mouthY} Q24 ${mouthY + 4} ${24 + mouthWidth} ${mouthY}`"
          fill="none" stroke="#0f172a" stroke-width="1.5" stroke-linecap="round"
        />
        <line
          v-else-if="mood === 'tired'"
          :x1="24 - mouthWidth" :y1="mouthY" :x2="24 + mouthWidth" :y2="mouthY"
          stroke="#0f172a" stroke-width="1.5" stroke-linecap="round"
        />
        <path
          v-else-if="mood === 'sad'"
          :d="`M${24 - mouthWidth} ${mouthY + 3} Q24 ${mouthY - 1} ${24 + mouthWidth} ${mouthY + 3}`"
          fill="none" stroke="#0f172a" stroke-width="1.5" stroke-linecap="round"
        />
        <line
          v-else
          :x1="24 - mouthWidth" :y1="mouthY" :x2="24 + mouthWidth" :y2="mouthY"
          stroke="#0f172a" stroke-width="1.5" stroke-linecap="round"
        />

        <!-- Crown/extras for higher stages -->
        <polygon
          v-if="stage >= 3"
          :points="crownPoints"
          :fill="crownColor"
          :opacity="mood === 'sad' ? 0.3 : 0.8"
        />

        <!-- Glow for stage 4+ -->
        <circle
          v-if="stage >= 4"
          cx="24" :cy="bodyY" :r="bodyRadius + 4"
          fill="none" :stroke="glowColor" stroke-width="1" opacity="0.4"
        >
          <animate
            attributeName="opacity"
            values="0.2;0.5;0.2"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>

        <!-- Mythic aura for stage 5 -->
        <circle
          v-if="stage >= 5"
          cx="24" :cy="bodyY" :r="bodyRadius + 8"
          fill="none" :stroke="glowColor" stroke-width="0.5" opacity="0.2"
        >
          <animate
            attributeName="r"
            :values="`${bodyRadius + 6};${bodyRadius + 10};${bodyRadius + 6}`"
            dur="3s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>
    </button>

    <!-- Detail popover (only on interactive instances) -->
    <div
      v-if="showDetail && interactive"
      class="absolute right-0 top-full mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-xl z-50"
    >
      <div class="flex items-center gap-3 mb-3">
        <AvatarCompanion :stage="stage" :mood="mood" :size="56" :interactive="false" />
        <div>
          <div class="text-sm font-bold">{{ stageName }}</div>
          <div class="text-xs text-slate-400">Level {{ level }} · {{ levelTitle }}</div>
        </div>
      </div>

      <div class="text-xs text-slate-400 mb-2">Mood: <span class="text-slate-200 capitalize">{{ mood }}</span></div>

      <div class="flex flex-col gap-1 text-[10px] text-slate-500">
        <div>{{ workoutDone ? '✓' : '○' }} Workout</div>
        <div>{{ allMealsLogged ? '✓' : '○' }} Meals</div>
        <div>{{ checkinDone ? '✓' : '○' }} Check-in</div>
      </div>

      <div v-if="nextStageName" class="mt-3 pt-2 border-t border-slate-700 text-[10px] text-slate-500">
        Next evolution: <span class="text-purple-400">{{ nextStageName }}</span> at Level {{ nextStageLevel }}
      </div>
    </div>

    <!-- Backdrop to close popover -->
    <div v-if="showDetail && interactive" class="fixed inset-0 z-40" @click="showDetail = false"></div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  stage: { type: Number, default: 1 },
  mood: { type: String, default: 'neutral' },
  size: { type: Number, default: 44 },
  level: { type: Number, default: 1 },
  levelTitle: { type: String, default: '' },
  stageName: { type: String, default: 'Hatchling' },
  nextStageName: { type: String, default: null },
  nextStageLevel: { type: Number, default: null },
  workoutDone: { type: Boolean, default: false },
  allMealsLogged: { type: Boolean, default: false },
  checkinDone: { type: Boolean, default: false },
  interactive: { type: Boolean, default: true }
})

const showDetail = ref(false)

// Scale body based on stage
const bodyRadius = computed(() => 8 + props.stage * 2) // 10, 12, 14, 16, 18
const bodyY = computed(() => 28 - (props.stage - 1)) // shifts up slightly each stage
const eyeOffset = computed(() => 3 + props.stage * 0.5)
const eyeY = computed(() => bodyY.value - 2)
const mouthWidth = computed(() => 3 + props.stage * 0.5)
const mouthY = computed(() => bodyY.value + 3)

const moodColors = {
  happy: '#22c55e',
  neutral: '#3b82f6',
  tired: '#94a3b8',
  sad: '#64748b'
}

const bodyColor = computed(() => moodColors[props.mood] || moodColors.neutral)
const crownColor = computed(() => props.stage >= 4 ? '#eab308' : '#a78bfa')
const glowColor = computed(() => props.stage >= 5 ? '#eab308' : '#a78bfa')

const crownPoints = computed(() => {
  const cx = 24
  const top = bodyY.value - bodyRadius.value - 6
  const base = bodyY.value - bodyRadius.value + 1
  const w = bodyRadius.value * 0.6
  return `${cx - w},${base} ${cx - w / 2},${top} ${cx},${base - 2} ${cx + w / 2},${top} ${cx + w},${base}`
})
</script>
