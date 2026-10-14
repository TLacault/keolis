<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import { LifeBuoy, Map as MapIcon, Volume2, VolumeX } from 'lucide-vue-next'

type Screen = 'welcome' | 'home' | 'preview' | 'guide' | 'arrived'

const seen = (() => { try { return localStorage.getItem('ca-welcome') === '1' } catch { return false } })()

// Main entry: a link sent by SMS (by a relative or the TBM phone line), e.g. ?t=med&h=14:30&de=Marie
// opens straight on that prepared trip. t = trip id, h = appointment time, de = who prepared it.
const q = new URLSearchParams(location.search)
// An agent (Allo TBM) can prepare a custom trip: it is stored in localStorage, keyed by its id.
const AGENT_TRIPS: Record<string, Trip> = (() => { try { return JSON.parse(localStorage.getItem('ca-agent-trips') ?? '{}') } catch { return {} } })()
const linked = AGENT_TRIPS[q.get('t') ?? ''] ?? TRIPS.find(t => t.id === q.get('t')) ?? null
const invite = linked ? { by: q.get('de'), at: q.get('h')?.match(/^\d{1,2}[:h]\d{2}$/) ? q.get('h')!.replace('h', ':') : null } : null

const screen = ref<Screen>(linked ? 'preview' : seen ? 'home' : 'welcome')
const trip = ref<Trip | null>(linked)
const step = ref(-1)
const me = ref<LatLng | null>(null)
const realGps = ref<LatLng | null>(null)
const help = ref(false)
const mapOpen = ref(false) // guide is full screen; the map is opt-in

// ponytail: real GPS only replaces the demo "home" when you're actually in Bordeaux; the guided part is simulated.
const nearBordeaux = (p: LatLng) => Math.abs(p[0] - 44.84) < 0.15 && Math.abs(p[1] + 0.58) < 0.2

function startGps() {
  navigator.geolocation?.watchPosition(
    (p) => {
      const firstFix = !realGps.value
      realGps.value = [p.coords.latitude, p.coords.longitude]
      // Opened from a link: re-plan the first walk from where the person really is.
      if (firstFix && screen.value === 'preview' && trip.value && nearBordeaux(realGps.value)) pick(trip.value)
      if (screen.value === 'home' || screen.value === 'welcome') me.value = nearBordeaux(realGps.value) ? realGps.value : HOME.at
    },
    () => { me.value ??= HOME.at },
    { enableHighAccuracy: true, maximumAge: 5000 },
  )
}
onMounted(() => {
  me.value = HOME.at
  if (seen || linked) startGps()
  if (linked) loadWalkPaths(linked).then(() => { if (trip.value?.id === linked.id) trip.value = { ...linked } })
})

function welcomeDone() {
  try { localStorage.setItem('ca-welcome', '1') } catch {}
  startGps()
  screen.value = 'home'
}

async function pick(t: Trip) {
  const first = t.steps[0]
  if (first?.kind === 'walk' && realGps.value && nearBordeaux(realGps.value)) { first.from = realGps.value; first.path = undefined }
  trip.value = t
  step.value = -1
  screen.value = 'preview'
  await loadWalkPaths(t)
  trip.value = { ...t } // redraw with street paths
}

function go() {
  step.value = 0
  mapOpen.value = false
  screen.value = 'guide'
  keepAwake(true)
}

function finish() {
  keepAwake(false)
  screen.value = 'arrived'
  say(`Bravo, vous êtes arrivé. ${trip.value?.place}.`)
  buzz([120, 80, 120])
}

function home() {
  hush()
  keepAwake(false)
  help.value = false
  screen.value = 'home'
  trip.value = null
  step.value = -1
  me.value = realGps.value && nearBordeaux(realGps.value) ? realGps.value : HOME.at
}

function toggleVoice() {
  voiceOn.value = !voiceOn.value
  if (voiceOn.value) say('La voix est activée.')
  else hush()
}

const sheetH = computed(() => screen.value === 'guide' ? 260 : 400)
const showMap = computed(() => screen.value === 'preview' || screen.value === 'guide')
</script>

<template>
  <div class="relative mx-auto h-dvh w-full max-w-[440px] overflow-hidden bg-bg shadow-2xl">
    <!-- Map lives behind the trip screens so preview → guide is one continuous camera move. -->
    <motion.div
      class="absolute inset-0"
      :initial="false"
      :animate="{ opacity: showMap ? 1 : 0, scale: showMap ? 1 : 1.06 }"
      :transition="{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }"
    >
      <MapView :trip="trip" :step="step" :me="me" :pad-bottom="sheetH" />
    </motion.div>

    <!-- Always-on controls during a trip: big, labelled, never hidden behind a menu. -->
    <AnimatePresence>
      <motion.div
        v-if="screen === 'guide' || screen === 'preview'"
        class="pointer-events-none absolute inset-x-0 top-0 z-[500] flex justify-end gap-2 p-4 pt-[max(1rem,env(safe-area-inset-top))]"
        :initial="{ opacity: 0, y: -16 }" :animate="{ opacity: 1, y: 0 }" :exit="{ opacity: 0, y: -16 }"
      >
        <button
          v-if="screen === 'guide'"
          class="press pointer-events-auto flex h-14 items-center gap-2 rounded-full px-4 font-bold shadow-lg ring-1 ring-line"
          :class="mapOpen ? 'bg-navy text-white' : 'bg-white text-navy'"
          :aria-pressed="mapOpen"
          @click="mapOpen = !mapOpen"
        >
          <MapIcon :size="26" /> Carte
        </button>
        <button
          class="press pointer-events-auto flex h-14 items-center gap-2 rounded-full bg-white px-4 font-bold text-navy shadow-lg ring-1 ring-line"
          :aria-label="voiceOn ? 'Couper la voix' : 'Activer la voix'"
          @click="toggleVoice"
        >
          <component :is="voiceOn ? Volume2 : VolumeX" :size="26" />
          <span>{{ voiceOn ? 'Voix' : 'Muet' }}</span>
        </button>
        <button
          class="press pointer-events-auto flex h-14 items-center gap-2 rounded-full bg-help px-5 font-bold text-white shadow-lg"
          @click="help = true"
        >
          <LifeBuoy :size="26" /> Aide
        </button>
      </motion.div>
    </AnimatePresence>

    <AnimatePresence mode="wait">
      <ScreenWelcome v-if="screen === 'welcome'" key="welcome" @done="welcomeDone" />
      <ScreenHome v-else-if="screen === 'home'" key="home" @pick="pick" />
      <ScreenPreview v-else-if="screen === 'preview' && trip" key="preview" :trip="trip" :invite="trip.id === linked?.id ? invite : null" @back="home" @go="go" />
      <ScreenGuide v-else-if="screen === 'guide' && trip" key="guide" v-model:step="step" v-model:me="me" :trip="trip" :full="!mapOpen" @done="finish" />
      <ScreenArrived v-else-if="screen === 'arrived' && trip" key="arrived" :trip="trip" @home="home" />
    </AnimatePresence>

    <HelpSheet :open="help" :trip="trip" :step="step" @close="help = false" @stop="home" />
  </div>
</template>
