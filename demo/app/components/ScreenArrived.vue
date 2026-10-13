<script setup lang="ts">
import { motion } from 'motion-v'
import { Check, House, MessageSquareText } from 'lucide-vue-next'

const props = defineProps<{ trip: Trip }>()
const emit = defineEmits<{ home: [] }>()
const ease = [0.22, 1, 0.36, 1] as const
const sms = `sms:?&body=${encodeURIComponent(`Je suis bien arrivé·e : ${props.trip.place} (${clock(new Date())}).`)}`
</script>

<template>
  <motion.section
    class="absolute inset-0 z-[400] flex flex-col bg-white px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]"
    :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :exit="{ opacity: 0 }" :transition="{ duration: 0.5, ease }"
  >
    <div class="flex flex-1 flex-col items-center justify-center text-center">
      <div class="relative grid place-items-center">
        <motion.span
          class="absolute size-40 rounded-full bg-good/20"
          :initial="{ scale: 0.6, opacity: 1 }" :animate="{ scale: 1.8, opacity: 0 }" :transition="{ delay: 0.3, duration: 1.2, ease }"
        />
        <motion.span
          class="grid size-40 place-items-center rounded-full bg-good text-white shadow-2xl shadow-good/40"
          :initial="{ scale: 0 }" :animate="{ scale: 1 }" :transition="{ type: 'spring', damping: 12, stiffness: 180, delay: 0.1 }"
        >
          <Check :size="88" :stroke-width="3" />
        </motion.span>
      </div>
      <motion.div :initial="{ opacity: 0, y: 20 }" :animate="{ opacity: 1, y: 0 }" :transition="{ delay: 0.45, duration: 0.6, ease }">
        <h1 class="mt-10 font-display text-4xl font-bold text-navy">Vous êtes arrivé !</h1>
        <p class="mt-3 text-2xl text-ink">{{ trip.place }}</p>
        <p class="mt-1 text-lg text-muted">à {{ clock(new Date()) }} · bravo 👏</p>
      </motion.div>
    </div>

    <motion.div class="space-y-3" :initial="{ opacity: 0, y: 30 }" :animate="{ opacity: 1, y: 0 }" :transition="{ delay: 0.7, duration: 0.6, ease }">
      <a :href="sms" class="press flex h-18 w-full items-center justify-center gap-3 rounded-2xl bg-blue font-display text-[1.375rem] font-semibold text-white shadow-xl shadow-blue/30">
        <MessageSquareText :size="28" /> Prévenir un proche
      </a>
      <button class="press flex h-18 w-full items-center justify-center gap-3 rounded-2xl bg-sky font-display text-[1.375rem] font-semibold text-navy" @click="emit('home')">
        <House :size="28" /> Retour à l'accueil
      </button>
    </motion.div>
  </motion.section>
</template>
