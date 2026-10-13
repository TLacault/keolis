<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import { BellRing, Check, Footprints, Hourglass, Info, Armchair, Volume2 } from 'lucide-vue-next'

const props = defineProps<{ trip: Trip }>()
const step = defineModel<number>('step', { required: true })
const me = defineModel<LatLng | null>('me', { required: true })
const emit = defineEmits<{ done: [] }>()
const ease = [0.22, 1, 0.36, 1] as const

// Demo time compression: a real trip is ~20 min, the demo plays it in ~1 min.
const WALK_MS = 10_000
const MINUTE_MS = 2_500
const STOP_MS = 5_000

const s = computed(() => props.trip.steps[step.value]!)
const isLast = computed(() => step.value === props.trip.steps.length - 1)

const reached = ref(false) // walk: at the stop · wait: tram is here · ride: get off now
const waitLeft = ref(0)
const stopIdx = ref(0)
const remaining = computed(() => s.value.kind === 'ride' ? s.value.stops.length - 1 - stopIdx.value : 0)

let raf = 0
let timer: ReturnType<typeof setInterval> | undefined
const stopSim = () => { cancelAnimationFrame(raf); clearInterval(timer) }

function animate(path: LatLng[], ms: number, then?: () => void) {
  cancelAnimationFrame(raf)
  const t0 = performance.now()
  const tick = (now: number) => {
    const t = (now - t0) / ms
    me.value = along(path, t)
    if (t < 1) raf = requestAnimationFrame(tick)
    else then?.()
  }
  raf = requestAnimationFrame(tick)
}

function speech(x: Step) {
  if (x.kind === 'walk') return `Marchez jusqu'à ${isLast.value ? '' : "l'arrêt "}${x.to}. Environ ${x.minutes} minutes. ${x.tip ?? ''}`
  if (x.kind === 'wait') return `Attendez le tram ${x.line}, direction ${x.direction}. Il arrive dans ${x.inMin} minutes. ${x.tip}`
  return `Restez dans le tram. Vous descendrez à ${x.stops.at(-1)!.name}, dans ${x.stops.length - 1} arrêts. Je vous préviendrai.`
}

function run() {
  stopSim()
  reached.value = false
  const x = s.value
  say(speech(x))
  if (x.kind === 'walk') {
    animate(stepPath(x), WALK_MS, () => {
      reached.value = true
      buzz(150)
      say(isLast.value ? `Vous êtes arrivé : ${x.to}.` : `Vous êtes à l'arrêt ${x.to}.`)
    })
  }
  else if (x.kind === 'wait') {
    me.value = x.at
    waitLeft.value = x.inMin
    timer = setInterval(() => {
      if (--waitLeft.value > 0) return
      clearInterval(timer)
      reached.value = true
      buzz([200, 100, 200])
      say(`Le tram ${LINES[x.line].colorName} arrive. Vérifiez qu'il est écrit ${x.direction}, puis montez.`)
    }, MINUTE_MS)
  }
  else {
    stopIdx.value = 0
    me.value = x.stops[0]!.at
    timer = setInterval(() => {
      const i = stopIdx.value
      animate([x.stops[i]!.at, x.stops[i + 1]!.at], 1800, () => {
        stopIdx.value = i + 1
        if (remaining.value === 1) {
          buzz([300, 150, 300])
          say(`Attention. Prochain arrêt : ${x.stops.at(-1)!.name}. Préparez-vous à descendre.`)
        }
        if (remaining.value === 0) {
          clearInterval(timer)
          reached.value = true
          buzz([400, 150, 400, 150, 400])
          say(`Descendez maintenant. Vous êtes à ${x.stops.at(-1)!.name}.`)
        }
      })
    }, STOP_MS)
  }
}

watch(step, run)
onMounted(run)
onBeforeUnmount(stopSim)

function next() {
  if (isLast.value) return emit('done')
  step.value++
}

const action = computed(() => {
  const x = s.value
  if (x.kind === 'walk') return isLast.value ? 'Je suis arrivé' : "Je suis à l'arrêt"
  return x.kind === 'wait' ? 'Je suis monté' : 'Je suis descendu'
})

const kindLabel = computed(() => ({ walk: 'À pied', wait: 'Sur le quai', ride: 'Dans le tram' })[s.value.kind])
const kindIcon = computed(() => ({ walk: Footprints, wait: Hourglass, ride: Armchair })[s.value.kind])
const accent = computed(() => s.value.kind === 'walk' ? '#002862' : LINES[s.value.line].color)
</script>

<template>
  <motion.section class="absolute inset-0 z-[400] flex flex-col justify-end" :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :exit="{ opacity: 0 }">
    <!-- Get-off alert: impossible to miss, sits above the card. -->
    <AnimatePresence>
      <motion.div
        v-if="s.kind === 'ride' && remaining === 1"
        class="mx-4 mb-3 flex items-center gap-3 rounded-2xl bg-alert-soft p-4 text-alert shadow-xl ring-2 ring-alert/30"
        :initial="{ opacity: 0, y: 30, scale: 0.9 }" :animate="{ opacity: 1, y: 0, scale: 1 }" :exit="{ opacity: 0, y: 20 }"
        :transition="{ type: 'spring', damping: 18, stiffness: 300 }"
        role="alert"
      >
        <BellRing :size="34" class="shrink-0 animate-[wiggle_0.6s_ease-in-out_3]" />
        <p class="text-xl font-bold leading-snug">Prochain arrêt : c'est le vôtre.<br><span class="font-normal">Préparez-vous à descendre.</span></p>
      </motion.div>
    </AnimatePresence>

    <motion.div
      class="rounded-t-[2rem] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-12px_40px_-12px_rgb(0_40_98/.35)]"
      :initial="{ y: 60 }" :animate="{ y: 0 }" :transition="{ type: 'spring', damping: 28, stiffness: 240 }"
    >
      <!-- Progress: one segment per step, coloured like the line. -->
      <div class="flex gap-1.5" :aria-label="`Étape ${step + 1} sur ${trip.steps.length}`">
        <span
          v-for="(x, i) in trip.steps" :key="i"
          class="h-2 flex-1 rounded-full transition-colors duration-500"
          :style="{ background: i <= step ? (x.kind === 'walk' ? '#002862' : LINES[x.line].color) : '#d3dce9', opacity: i < step ? 0.4 : 1 }"
        />
      </div>
      <div class="mt-3 flex items-center justify-between text-base text-muted">
        <span class="flex items-center gap-1.5 font-bold" :style="{ color: accent }"><component :is="kindIcon" :size="20" /> {{ kindLabel }}</span>
        <span>Étape {{ step + 1 }} sur {{ trip.steps.length }}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          :key="step"
          class="mt-3 min-h-[184px]"
          :initial="{ opacity: 0, x: 40 }" :animate="{ opacity: 1, x: 0 }" :exit="{ opacity: 0, x: -40 }" :transition="{ duration: 0.35, ease }"
        >
          <!-- Walk -->
          <template v-if="s.kind === 'walk'">
            <h2 class="font-display text-[1.75rem] font-bold leading-tight text-navy">
              Marchez jusqu'à<br><span class="text-blue">{{ isLast ? s.to : `l'arrêt ${s.to}` }}</span>
            </h2>
            <p class="mt-2 text-xl text-ink">Environ <strong>{{ s.minutes }} min</strong> · {{ s.meters }} m</p>
            <p v-if="s.tip" class="mt-3 flex gap-2 rounded-xl bg-bg p-3 text-lg leading-snug text-muted"><Info :size="22" class="mt-0.5 shrink-0" />{{ s.tip }}</p>
          </template>

          <!-- Wait on platform -->
          <template v-else-if="s.kind === 'wait'">
            <div class="flex items-center gap-4">
              <LineBadge :line="s.line" :size="64" />
              <div>
                <p class="text-lg text-muted">Attendez le tram</p>
                <p class="font-display text-[1.5rem] font-bold leading-tight text-ink">direction<br>{{ s.direction }}</p>
              </div>
            </div>
            <div class="mt-4 flex items-center gap-3 rounded-2xl p-3.5" :class="reached ? 'bg-good-soft text-good' : 'bg-sky text-navy'">
              <AnimatePresence mode="wait">
                <motion.p
                  :key="reached ? 'here' : waitLeft"
                  class="font-display text-2xl font-bold"
                  :initial="{ opacity: 0, y: 12 }" :animate="{ opacity: 1, y: 0 }" :exit="{ opacity: 0, y: -12 }" :transition="{ duration: 0.25 }"
                >
                  {{ reached ? 'Le tram arrive !' : `Il arrive dans ${waitLeft} min` }}
                </motion.p>
              </AnimatePresence>
            </div>
            <p class="mt-3 flex gap-2 text-lg leading-snug text-muted"><Info :size="22" class="mt-0.5 shrink-0" />{{ s.tip }}</p>
          </template>

          <!-- On board -->
          <template v-else>
            <div class="flex items-center gap-4">
              <div class="relative grid size-24 shrink-0 place-items-center rounded-full text-white" :style="{ background: accent }">
                <AnimatePresence mode="wait">
                  <motion.span
                    :key="remaining"
                    class="font-display text-5xl font-bold"
                    :initial="{ opacity: 0, scale: 0.5 }" :animate="{ opacity: 1, scale: 1 }" :exit="{ opacity: 0, scale: 1.4 }" :transition="{ duration: 0.3 }"
                  >
                    <Check v-if="remaining === 0" :size="52" :stroke-width="3" />
                    <template v-else>{{ remaining }}</template>
                  </motion.span>
                </AnimatePresence>
              </div>
              <div>
                <p class="font-display text-[1.5rem] font-bold leading-tight text-ink">
                  {{ remaining === 0 ? 'Descendez maintenant' : remaining === 1 ? 'arrêt avant de descendre' : 'arrêts avant de descendre' }}
                </p>
                <p class="mt-1 text-lg text-muted">Restez assis, je vous préviens.</p>
              </div>
            </div>
            <div class="mt-4 flex items-center justify-between rounded-2xl bg-bg p-3.5">
              <span class="text-lg text-muted">Descendez à</span>
              <span class="font-display text-xl font-bold" :style="{ color: accent }">{{ s.stops.at(-1)!.name }}</span>
            </div>
            <p class="mt-2 text-base text-muted">Arrêt actuel : <strong class="text-ink">{{ s.stops[stopIdx]!.name }}</strong></p>
          </template>
        </motion.div>
      </AnimatePresence>

      <div class="mt-4 flex gap-3">
        <button class="press grid size-18 shrink-0 place-items-center rounded-2xl bg-sky text-navy" aria-label="Répéter à voix haute" @click="say(speech(s))">
          <Volume2 :size="32" />
        </button>
        <button
          class="press h-18 flex-1 rounded-2xl font-display text-[1.375rem] font-semibold text-white shadow-xl transition-colors duration-500"
          :class="reached ? 'animate-[nudge_1.6s_ease-in-out_infinite] bg-good shadow-good/30' : 'bg-navy shadow-navy/25'"
          @click="next"
        >
          {{ action }}
        </button>
      </div>
    </motion.div>
  </motion.section>
</template>

<style>
@keyframes nudge { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.035) } }
@keyframes wiggle { 0%, 100% { rotate: 0deg } 25% { rotate: -14deg } 75% { rotate: 14deg } }
</style>
