<script setup lang="ts">
import { motion } from 'motion-v'
import { MapPin } from 'lucide-vue-next'

const emit = defineEmits<{ done: [] }>()
const ease = [0.22, 1, 0.36, 1] as const
</script>

<template>
  <motion.section
    class="absolute inset-0 z-[400] flex flex-col bg-white px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]"
    :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :exit="{ opacity: 0, y: -24 }" :transition="{ duration: 0.5, ease }"
  >
    <div class="flex flex-1 flex-col items-center justify-center text-center">
      <motion.img
        src="/logo.png" alt="Connect'Age" class="w-56"
        :initial="{ opacity: 0, scale: 0.85 }" :animate="{ opacity: 1, scale: 1 }" :transition="{ duration: 0.9, ease }"
      />
      <motion.div :initial="{ opacity: 0, y: 20 }" :animate="{ opacity: 1, y: 0 }" :transition="{ delay: 0.3, duration: 0.7, ease }">
        <h1 class="mt-6 font-display text-4xl font-bold text-navy">Bonjour !</h1>
        <p class="mt-4 text-[1.375rem] leading-snug text-ink">
          Je vous accompagne pendant tout votre trajet en tram, <strong>étape par étape</strong>.
        </p>
      </motion.div>
    </div>

    <motion.div :initial="{ opacity: 0, y: 30 }" :animate="{ opacity: 1, y: 0 }" :transition="{ delay: 0.55, duration: 0.7, ease }">
      <div class="mb-5 flex items-start gap-3 rounded-2xl bg-sky p-4 text-lg leading-snug text-navy">
        <MapPin :size="30" class="mt-0.5 shrink-0" />
        <p>Le téléphone va vous demander de <strong>partager votre position</strong>. Appuyez sur « Autoriser ».</p>
      </div>
      <button class="press h-18 w-full rounded-2xl bg-navy font-display text-2xl font-semibold text-white shadow-xl shadow-navy/25" @click="emit('done')">
        Commencer
      </button>
    </motion.div>
  </motion.section>
</template>
