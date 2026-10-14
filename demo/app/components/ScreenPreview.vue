<script setup lang="ts">
import { motion } from 'motion-v'
import { ArrowLeft, Footprints, Heart } from 'lucide-vue-next'

const props = defineProps<{ trip: Trip, invite?: { by: string | null, at: string | null } | null }>()
const emit = defineEmits<{ back: [], go: [] }>()
const ease = [0.22, 1, 0.36, 1] as const

const mins = tripMinutes(props.trip)
const MARGIN = 5 // minutes of slack before an appointment

// With an appointment time: leave early enough. Otherwise: leave now.
const leaveAt = computed(() => {
  const at = props.invite?.at
  if (!at) return null
  const [h, m] = at.split(':').map(Number)
  const d = new Date()
  d.setHours(h!, m! - mins - MARGIN, 0, 0)
  return d > new Date() ? d : null
})

type PreviewLeg = { kind: 'walk', label: string } | { kind: 'ride', line: LineId, label: string }

// Icons only: walk → tram → walk. The words stay for screen readers.
const legs = computed<PreviewLeg[]>(() => props.trip.steps.flatMap<PreviewLeg>((s) => {
  if (s.kind === 'walk') return [{ kind: 'walk' as const, label: `Marcher jusqu'à ${s.to}` }]
  if (s.kind === 'ride') return [{ kind: 'ride' as const, line: s.line, label: `${LINES[s.line].name}, direction ${s.direction}` }]
  return []
}))

onMounted(() => say(`${props.invite?.by ? `${props.invite.by} a préparé votre trajet. ` : ''}Trajet vers ${props.trip.place}. ${leaveAt.value ? `Partez à ${clock(leaveAt.value)}.` : ''} Appuyez sur C'est parti quand vous êtes prêt.`))
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
      class="max-h-[64%] overflow-y-auto rounded-t-[2rem] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-12px_40px_-12px_rgb(0_40_98/.35)]"
      :initial="{ y: '100%' }" :animate="{ y: 0 }" :exit="{ y: '100%' }" :transition="{ type: 'spring', damping: 30, stiffness: 260 }"
    >
      <p v-if="invite?.by" class="mb-2 flex items-center gap-1.5 text-base font-bold text-[#c2410c]">
        <Heart :size="18" /> Préparé par {{ invite.by }}
      </p>
      <h2 class="font-display text-[1.75rem] font-bold leading-tight text-navy">{{ trip.place }}</h2>
      <p class="mt-1 text-xl text-ink">
        <template v-if="leaveAt">Partez à <strong class="text-good">{{ clock(leaveAt) }}</strong></template>
        <template v-else><strong class="text-good">Partez maintenant</strong></template>
      </p>

      <ol class="mt-5 flex items-center" aria-label="Le trajet">
        <template v-for="(l, i) in legs" :key="i">
          <motion.li
            :aria-label="l.label"
            :initial="{ opacity: 0, scale: 0.6 }" :animate="{ opacity: 1, scale: 1 }" :transition="{ delay: 0.2 + i * 0.08, duration: 0.4, ease }"
          >
            <LineBadge v-if="l.kind === 'ride'" :line="l.line" :size="56" />
            <span v-else class="grid size-14 place-items-center rounded-full bg-sky text-navy"><Footprints :size="30" /></span>
          </motion.li>
          <li v-if="i < legs.length - 1" aria-hidden="true" class="mx-2 h-1.5 flex-1 rounded-full bg-line" />
        </template>
      </ol>

      <button class="press mt-6 h-18 w-full rounded-2xl bg-blue font-display text-2xl font-semibold text-white shadow-xl shadow-blue/30" @click="emit('go')">
        C'est parti
      </button>
    </motion.div>
  </motion.section>
</template>
