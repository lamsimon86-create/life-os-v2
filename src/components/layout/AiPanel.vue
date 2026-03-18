<template>
  <Transition name="slide-up">
    <div
      v-if="aiStore.isOpen"
      class="fixed inset-0 z-50 flex flex-col bg-slate-950"
    >
      <!-- Header -->
      <header class="flex items-center justify-between h-14 px-4 bg-slate-900 border-b border-slate-800 shrink-0">
        <h2 class="text-lg font-semibold text-white">AI Assistant</h2>
        <button
          class="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
          aria-label="Close AI panel"
          @click="aiStore.close()"
        >
          <X :size="20" />
        </button>
      </header>

      <!-- Messages -->
      <div
        ref="messagesContainer"
        class="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        <!-- Empty state -->
        <div
          v-if="aiStore.messages.length === 0 && !aiStore.isLoading"
          class="flex flex-col items-center justify-center h-full text-slate-500 text-sm text-center px-6"
        >
          <MessageCircle :size="40" class="mb-3 text-slate-600" />
          <p class="font-medium text-slate-400 mb-1">Ask me anything</p>
          <p>Meal ideas, workout adjustments, goal check-ins, or just chat.</p>
        </div>

        <!-- Message bubbles -->
        <div
          v-for="(msg, i) in aiStore.messages"
          :key="i"
          class="flex"
          :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <div class="max-w-[85%]">
            <div
              class="rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
              :class="
                msg.role === 'user'
                  ? 'bg-brand-600 text-white rounded-br-md'
                  : msg.error
                    ? 'bg-red-900/40 text-red-300 rounded-bl-md'
                    : 'bg-slate-800 text-slate-200 rounded-bl-md'
              "
            >
              {{ cleanContent(msg.content) }}
            </div>

            <!-- Action buttons for assistant messages with recipe actions -->
            <div
              v-if="msg.role === 'assistant' && getRecipeAction(msg)"
              class="mt-2"
            >
              <button
                class="text-xs font-medium px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-500 transition-colors"
                @click="onSaveRecipe(getRecipeAction(msg).recipe)"
              >
                Save to Library
              </button>
            </div>

            <!-- Action button for program actions -->
            <div
              v-if="msg.role === 'assistant' && getProgramAction(msg)"
              class="mt-2"
            >
              <button
                class="text-xs font-medium px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-500 transition-colors"
                @click="onCreateProgram(getProgramAction(msg))"
              >
                Activate Program
              </button>
            </div>
          </div>
        </div>

        <!-- Loading indicator -->
        <div v-if="aiStore.isLoading" class="flex justify-start">
          <div class="bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
            <span class="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
            <span class="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
            <span class="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
          </div>
        </div>
      </div>

      <!-- Input area -->
      <div class="shrink-0 border-t border-slate-800 bg-slate-900 px-4 py-3 pb-safe">
        <form class="flex items-center gap-2" @submit.prevent="onSend">
          <input
            ref="inputEl"
            v-model="inputText"
            type="text"
            placeholder="Ask anything..."
            class="flex-1 bg-slate-800 text-white text-sm rounded-xl px-4 py-2.5 border border-slate-700 focus:border-brand-500 focus:outline-none placeholder-slate-500"
            :disabled="aiStore.isLoading"
          />
          <button
            type="submit"
            class="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-brand-600 text-white hover:bg-brand-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            :disabled="!inputText.trim() || aiStore.isLoading"
          >
            <Send :size="18" />
          </button>
        </form>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue'
import { X, Send, MessageCircle } from 'lucide-vue-next'
import { useAiStore } from '@/stores/ai'
import { useAi } from '@/composables/useAi'

const aiStore = useAiStore()
const { handleActions, saveRecipe } = useAi()

const inputText = ref('')
const messagesContainer = ref(null)
const inputEl = ref(null)

async function onSend() {
  const text = inputText.value.trim()
  if (!text || aiStore.isLoading) return

  inputText.value = ''
  await aiStore.sendMessage(text)
  scrollToBottom()
}

function onSaveRecipe(recipe) {
  saveRecipe(recipe)
}

function onCreateProgram(action) {
  handleActions([action])
}

function getRecipeAction(msg) {
  if (!msg.actions || !Array.isArray(msg.actions)) return null
  return msg.actions.find((a) => a.type === 'suggest_recipe') || null
}

function getProgramAction(msg) {
  if (!msg.actions || !Array.isArray(msg.actions)) return null
  return msg.actions.find((a) => a.type === 'create_program') || null
}

function cleanContent(content) {
  // Strip JSON code blocks from the displayed message
  return content.replace(/```json[\s\S]*?```/g, '').trim()
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// Auto-scroll when messages change
watch(
  () => aiStore.messages.length,
  () => scrollToBottom()
)

// Focus input when panel opens
watch(
  () => aiStore.isOpen,
  (open) => {
    if (open) {
      nextTick(() => inputEl.value?.focus())
    }
  }
)
</script>

<style scoped>
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
