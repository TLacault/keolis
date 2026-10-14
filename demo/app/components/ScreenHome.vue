<script setup lang="ts">
import { motion } from 'motion-v'
import { ShoppingBasket as Basket, ChevronRight, Heart, Mic, Stethoscope, Trees } from 'lucide-vue-next'

const emit = defineEmits<{ pick: [Trip] }>()
const icons = { stethoscope: Stethoscope, basket: Basket, heart: Heart, trees: Trees }
const ease = [0.22, 1, 0.36, 1] as const

const hello = new Date().getHours() < 18 ? 'Bonjour' : 'Bonsoir'
const listening = ref(false)
const heard = ref('')

async function speak() {
  heard.value = ''
  listening.value = true
  say('Où allez-vous ?')
  try {
    const text = await listen()
    heard.value = `« ${text} »`
    const t = TRIPS.find(t => t.keywords.test(text))
    if (t) { say(`D'accord, je prépare le trajet : ${t.place}.`); setTimeout(() => emit('pick', t), 900) }
    else say("Je n'ai pas compris. Touchez simplement l'endroit où vous allez.")
  }
  catch (e: any) {
    heard.value = e?.message === 'unsupported' ? 'La voix ne marche pas sur ce téléphone.' : "Je n'ai rien entendu."
  }
  finally { listening.value = false }
}
</script>

<template>
  <motion.section
    class="absolute inset-0 z-[400] flex flex-col overflow-y-auto bg-bg px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.75rem,env(safe-area-inset-top))]"
    :initial="{ opacity: 0, y: 24 }" :animate="{ opacity: 1, y: 0 }" :exit="{ opacity: 0, scale: 0.97 }" :transition="{ duration: 0.45, ease }"
  >
    <img src="/logo.png" alt="Facili'TBM" class="h-6 self-start">

    <h1 class="mt-6 font-display text-[1.75rem] font-bold leading-tight text-navy">
      <span class="block text-xl font-medium text-muted">{{ hello }} !</span>
      Où allez-vous ?
    </h1>

    <!-- One row per place: icon, name, where. Full-width targets, nothing to wrap. -->
    <div class="mt-5 space-y-3">
      <motion.button
        v-for="(t, i) in TRIPS" :key="t.id"
        class="press flex w-full items-center gap-4 rounded-2xl bg-white p-3 pr-4 text-left shadow-[0_2px_0_#d3dce9,0_8px_24px_-12px_rgb(0_40_98/.25)]"
        :initial="{ opacity: 0, y: 16 }" :animate="{ opacity: 1, y: 0 }" :transition="{ delay: 0.06 * i + 0.1, duration: 0.5, ease }"
        @click="emit('pick', t)"
      >
        <span class="grid size-14 shrink-0 place-items-center rounded-xl text-white" :style="{ background: t.tint }">
          <component :is="icons[t.icon]" :size="30" :stroke-width="2.2" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block font-display text-xl font-semibold leading-tight text-ink">{{ t.label }}</span>
          <span class="block truncate text-base leading-tight text-muted">{{ t.place }}</span>
        </span>
        <ChevronRight :size="26" class="shrink-0 text-muted" />
      </motion.button>
    </div>

    <div class="mt-auto pt-6">
      <p class="mb-2 min-h-7 text-center text-lg text-muted" aria-live="polite">
        {{ listening ? 'Je vous écoute…' : heard || 'Ou dites-le :' }}
      </p>
      <button
        class="press relative flex h-16 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl font-display text-[1.375rem] font-semibold text-white shadow-xl"
        :class="listening ? 'bg-help shadow-help/30' : 'bg-navy shadow-navy/25'"
        @click="speak"
      >
        <span v-if="listening" class="absolute size-24 animate-ping rounded-full bg-white/20" />
        <Mic :size="28" /> {{ listening ? 'Parlez maintenant' : 'Parler' }}
      </button>
    </div>
  </motion.section>
</template>
