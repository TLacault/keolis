<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import { Heart, MapPin, PhoneCall, X } from 'lucide-vue-next'

const props = defineProps<{ open: boolean, trip: Trip | null, step: number }>()
const emit = defineEmits<{ close: [] }>()

watch(() => props.open, o => o && say("Pas d'inquiétude. Vous pouvez appeler un proche ou un agent TBM."))

function whereAmI() {
  const s = props.trip?.steps[props.step]
  const text = !s ? 'Vous êtes à Bordeaux, près de chez vous.'
    : s.kind === 'walk' ? `Vous marchez vers ${s.to}. C'est à environ ${s.minutes} minutes.`
      : s.kind === 'wait' ? `Vous êtes à l'arrêt ${s.stop}. Vous attendez le tram ${s.line}, direction ${s.direction}.`
        : `Vous êtes dans le tram ${s.line}. Vous descendrez à ${s.stops.at(-1)!.name}.`
  say(text)
}
</script>

<template>
  <AnimatePresence>
    <motion.div
      v-if="open" key="backdrop" class="absolute inset-0 z-[900] bg-navy/50 backdrop-blur-[2px]"
      :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :exit="{ opacity: 0 }" @click="emit('close')"
    />
    <motion.div
      v-if="open" key="sheet" role="dialog" aria-modal="true" aria-label="Aide"
      class="absolute inset-x-0 bottom-0 z-[901] rounded-t-[2rem] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6"
      :initial="{ y: '100%' }" :animate="{ y: 0 }" :exit="{ y: '100%' }" :transition="{ type: 'spring', damping: 30, stiffness: 280 }"
    >
      <h2 class="font-display text-[1.75rem] font-bold text-navy">Pas d'inquiétude.</h2>
      <p class="mt-1 text-xl text-muted">Quelqu'un peut vous aider tout de suite.</p>

      <div class="mt-5 space-y-3">
        <a href="tel:+33600000000" class="press flex h-20 items-center gap-4 rounded-2xl bg-sky px-4 text-navy">
          <span class="grid size-12 place-items-center rounded-full bg-[#c2410c] text-white"><Heart :size="26" /></span>
          <span><span class="block text-xl font-bold">Appeler Marie</span><span class="text-base text-muted">ma fille</span></span>
        </a>
        <a href="tel:+33557578888" class="press flex h-20 items-center gap-4 rounded-2xl bg-sky px-4 text-navy">
          <span class="grid size-12 place-items-center rounded-full bg-help text-white"><PhoneCall :size="26" /></span>
          <span><span class="block text-xl font-bold">Appeler un agent TBM</span><span class="text-base text-muted">Allo TBM · 05 57 57 88 88</span></span>
        </a>
        <button class="press flex h-20 w-full items-center gap-4 rounded-2xl bg-sky px-4 text-left text-navy" @click="whereAmI">
          <span class="grid size-12 place-items-center rounded-full bg-blue text-white"><MapPin :size="26" /></span>
          <span><span class="block text-xl font-bold">Où suis-je ?</span><span class="text-base text-muted">Je vous le dis à voix haute</span></span>
        </button>
      </div>

      <button class="press mt-4 flex h-16 w-full items-center justify-center gap-2 rounded-2xl text-xl font-bold text-navy ring-2 ring-line" @click="emit('close')">
        <X :size="24" /> Fermer
      </button>
    </motion.div>
  </AnimatePresence>
</template>
