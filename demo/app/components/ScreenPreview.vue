<script setup lang="ts">
import { motion } from 'motion-v'
import { ArrowLeft, Clock, Flag, Footprints, Repeat } from 'lucide-vue-next'

const props = defineProps<{ trip: Trip }>()
const emit = defineEmits<{ back: [], go: [] }>()
const ease = [0.22, 1, 0.36, 1] as const

const mins = tripMinutes(props.trip)
const arrival = clock(new Date(Date.now() + mins * 60_000))
const trams = props.trip.steps.filter(s => s.kind === 'ride').length

// Collapse wait+ride into one readable line per leg.
const legs = computed(() => props.trip.steps.flatMap((s, i) => {
  if (s.kind === 'walk') return [{ kind: 'walk' as const, text: `Marcher ${s.minutes} min`, sub: `jusqu'à ${s.to}` }]
  if (s.kind === 'ride') {
    const prev = props.trip.steps[i - 1]
    const change = i > 1 && prev?.kind === 'wait' && props.trip.steps[i - 2]?.kind === 'ride'
    return [{ kind: 'ride' as const, line: s.line, change, text: `${LINES[s.line].name} · ${s.stops.length - 1} arrêt${s.stops.length > 2 ? 's' : ''}`, sub: `direction ${s.direction}` }]
  }
  return []
}))

onMounted(() => say(`Trajet vers ${props.trip.place}. ${mins} minutes, ${trams > 1 ? `${trams} trams` : 'un seul tram'}. Appuyez sur C'est parti quand vous êtes prêt.`))
</script>

<template>
  <motion.section class="absolute inset-0 z-[400] flex flex-col justify-end" :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :exit="{ opacity: 0 }">
    <button
      class="press absolute left-4 top-[max(1rem,env(safe-area-inset-top))] flex h-14 items-center gap-2 rounded-full bg-white px-5 text-lg font-bold text-navy shadow-lg"
      @click="emit('back')"
    >
      <ArrowLeft :size="26" /> Retour
    </button>

    <motion.div
      class="rounded-t-[2rem] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_-12px_rgb(0_40_98/.35)]"
      :initial="{ y: '100%' }" :animate="{ y: 0 }" :exit="{ y: '100%' }" :transition="{ type: 'spring', damping: 30, stiffness: 260 }"
    >
      <div class="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" />
      <p class="text-lg text-muted">Votre trajet vers</p>
      <h2 class="font-display text-[1.75rem] font-bold leading-tight text-navy">{{ trip.place }}</h2>

      <div class="mt-4 grid grid-cols-2 gap-3">
        <div class="rounded-2xl bg-good-soft p-3.5">
          <p class="text-base text-good">Départ</p>
          <p class="font-display text-[1.375rem] font-bold text-good">Maintenant</p>
        </div>
        <div class="rounded-2xl bg-sky p-3.5">
          <p class="flex items-center gap-1.5 text-base text-blue"><Clock :size="18" /> Arrivée vers</p>
          <p class="font-display text-[1.375rem] font-bold text-navy">{{ arrival }}</p>
        </div>
      </div>

      <ol class="mt-5 space-y-1">
        <motion.li
          v-for="(l, i) in legs" :key="i" class="flex items-center gap-3.5"
          :initial="{ opacity: 0, x: -16 }" :animate="{ opacity: 1, x: 0 }" :transition="{ delay: 0.25 + i * 0.08, duration: 0.45, ease }"
        >
          <div class="flex w-11 flex-col items-center self-stretch">
            <LineBadge v-if="l.kind === 'ride'" :line="l.line" :size="40" />
            <span v-else class="grid size-10 place-items-center rounded-full bg-bg text-navy"><Footprints :size="22" /></span>
            <span v-if="i < legs.length - 1" class="my-1 w-1 flex-1 rounded-full bg-line" />
          </div>
          <div class="pb-3">
            <p v-if="l.kind === 'ride' && l.change" class="flex items-center gap-1 text-base font-bold text-alert"><Repeat :size="16" /> Changement</p>
            <p class="text-xl font-bold leading-tight">{{ l.text }}</p>
            <p class="text-base text-muted">{{ l.sub }}</p>
          </div>
        </motion.li>
        <li class="flex items-center gap-3.5">
          <span class="grid size-10 place-items-center rounded-full bg-navy text-white"><Flag :size="20" /></span>
          <p class="text-xl font-bold">Arrivée</p>
        </li>
      </ol>

      <button class="press mt-5 h-18 w-full rounded-2xl bg-blue font-display text-2xl font-semibold text-white shadow-xl shadow-blue/30" @click="emit('go')">
        C'est parti
      </button>
    </motion.div>
  </motion.section>
</template>
