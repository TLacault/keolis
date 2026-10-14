<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v'
import {
  Accessibility as AccessIcon, AlertTriangle, ArrowLeft, CalendarDays, Check, CheckCheck, CheckCircle2, Clipboard,
  Clock, ExternalLink, Footprints, MapPin, Phone, PhoneOff, RefreshCcw, Smartphone, Sparkles, User, Volume2,
} from 'lucide-vue-next'
import type { Trip } from '~/utils/trips'
import { ALL_PLACES, resolvePlace, planJourney, type AccessNeed, type ResolvedLayout } from '~/utils/planner'

// ---- the exact Allo TBM call script ----------------------------------------
const GREETING = "Bonjour, vous êtes en communication avec Allo TBM. Je vais vous poser quelques questions pour préparer votre trajet en transports en commun."
const QUESTIONS = [
  "Où souhaitez-vous vous rendre ?",
  "D'où souhaitez-vous partir ?",
  "Pour quel jour souhaitez-vous effectuer ce trajet ?",
  "À quelle heure souhaitez-vous partir ou arriver ?",
  "Pouvez-vous marcher quelques minutes jusqu'à l'arrêt de bus ou de tram ?",
  "Avez-vous besoin d'éviter les escaliers ou de prendre un trajet accessible en fauteuil roulant ?",
] as const
const RECAP = "Je récapitule votre demande, est-ce correct ?"
const READY = "Très bien, votre trajet est prêt !"
const SMS_LINE = "Vous allez recevoir un SMS avec un lien pour consulter votre itinéraire. Vous pourrez y retrouver les informations nécessaires pour vous rendre à destination."
const BYE = "Je vous souhaite un agréable voyage et une très bonne journée. Merci d'avoir contacté Allo TBM. Au revoir !"

type Phase = number // -1 accueil, 0..5 questions, 6 récap, 7 trajet prêt
type LogEntry = { role: 'agent' | 'caller', text: string, sms?: boolean }

const phase = ref<Phase>(-1)
const log = ref<LogEntry[]>([])

const agentName = ref('Marie')
const destText = ref('')
const origText = ref('')
const day = ref<'today' | 'tomorrow' | 'date'>('today')
const dateISO = ref('')
const timeStr = ref(nextHalfHour())
const timeMode = ref<'depart' | 'arrive'>('depart')
const walkOk = ref<boolean | null>(null)
const access = ref<AccessNeed>('none')

const journey = ref<ReturnType<typeof planJourney> | null>(null)
const trip = ref<Trip | null>(null)
const smsLink = ref('')
const copied = ref(false)
const nowNote = ref('')
const openWarn = ref<string | null>(null)

function nextHalfHour() {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 30)
  d.setMinutes(Math.ceil(d.getMinutes() / 30) * 30, 0, 0)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const fmt = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
const minutesOf = (t: string) => { const p = t.split(':').map(Number); return p[0]! * 60 + p[1]! }
const fmtDate = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

// ---- live capture helpers ----------------------------------------------------
function startCall() {
  log.value = []
  journey.value = null
  trip.value = null
  openWarn.value = null
  phase.value = 0
  const n = new Date()
  log.value.push({ role: 'caller', text: `${n.getHours()}:${String(n.getMinutes()).padStart(2, '0')} — appel entrant Allo TBM` })
  pushAgent(GREETING)
}

function pushAgent(text: string) {
  log.value.push({ role: 'agent', text })
  if (voiceOn.value) say(text)
}

function pushCaller(text: string) {
  log.value.push({ role: 'caller', text })
  if (!voiceOn.value) say(`Réponse enregistrée : ${text}`)
}

function nextPhase() {
  phase.value = Math.min(phase.value + 1, 7)
  openWarn.value = null
  if (phase.value <= 5) {
    pushAgent(QUESTIONS[phase.value]!)
  } else if (phase.value === 6) {
    pushAgent(RECAP)
    buildJourney()
  }
}

function back() {
  phase.value = Math.max(phase.value - 1, 0)
  log.value.pop()
  if (log.value.at(-1)?.role === 'caller') log.value.pop()
  openWarn.value = null
}

function submitDest() {
  const r = resolvePlace(destText.value)
  if (destText.value) {
    pushCaller(r ? r.name : `« ${destText.value} »`)
    if (!r) openWarn.value = "Arrêt non reconnu — choisissez dans les suggestions ou vérifiez avec le client."
    nextPhase()
  }
}
function submitOrig() {
  const r = resolvePlace(origText.value)
  if (origText.value) {
    pushCaller(r ? r.name : `« ${origText.value} »`)
    if (!r) openWarn.value = "Point de départ non reconnu — vérifiez avec le client (départ estimé Bordeaux centre)."
    nextPhase()
  }
}
function submitDayChoice(v: 'today' | 'tomorrow' | 'date') {
  day.value = v
  if (v === 'date') { dateISO.value ||= new Date().toISOString().slice(0, 10) }
  else { pushCaller(v === 'today' ? "Aujourd'hui" : 'Demain'); nextPhase() }
}
function submitTime() {
  const h = minutesOf(timeStr.value)
  const isToday = day.value === 'today' || (day.value === 'date' && dateISO.value === new Date().toISOString().slice(0, 10))
  if (isToday && h < new Date().getHours() * 60 + new Date().getMinutes()) {
    nowNote.value = "Cette heure est déjà passée aujourd'hui — vérifiez avec le client."
    return
  }
  nowNote.value = ''
  pushCaller(`${timeMode.value === 'depart' ? 'Partir' : 'Arriver'} à ${fmt(h)}`)
  nextPhase()
}
function submitWalk(v: boolean) {
  walkOk.value = v
  pushCaller(v ? 'Oui, quelques minutes à pied, ça va.' : 'Non, le moins de marche possible.')
  nextPhase()
}
function submitAccess(v: AccessNeed) {
  access.value = v
  pushCaller(v === 'none' ? 'Non, pas de contrainte particulière.' : v === 'stairs' ? 'Il faut éviter les escaliers.' : 'Il faut un trajet accessible en fauteuil roulant.')
  nextPhase()
}

// ---- journey + handoff ---------------------------------------------------------
const fallbackCenter: ResolvedLayout = { kind: 'stop', name: 'Bordeaux centre', at: [44.83775, -0.57695], stop: 'hdv', footMin: 3, footM: 220 }

function asOf() {
  const d = day.value === 'today' ? new Date() : day.value === 'tomorrow' ? new Date(Date.now() + 86400e3) : new Date(dateISO.value || Date.now())
  return d
}

function buildJourney() {
  const from = resolvePlace(origText.value) ?? fallbackCenter
  const to = resolvePlace(destText.value) ?? fallbackCenter
  const h = minutesOf(timeStr.value)
  const j = planJourney({ from, to, day: asOf(), h, mode: timeMode.value, walk: walkOk.value ? 'yes' : 'no', access: access.value })
  journey.value = j
  if (!j) {
    openWarn.value = "Aucun trajet possible entre ces deux arrêts sur le réseau de démonstration — proposez un autre lieu au client."
    return
  }
  const total = j.total
  const arrive = timeMode.value === 'arrive' ? h : Math.min(h + total, 1439)
  const smsH = `${String(Math.floor(arrive / 60)).padStart(2, '0')}:${String(arrive % 60).padStart(2, '0')}`
  const root = location.origin + location.pathname.replace(/\/agent\/?$/, '') + '/'
  const de = agentName.value ? `${agentName.value} · Allo TBM` : 'Allo TBM'
  smsLink.value = `${root}?t=${j.trip.id}&h=${smsH}&de=${encodeURIComponent(de)}`
}

function confirmRecap() {
  const j = journey.value
  if (!j) return
  trip.value = j.trip
  try {
    const all = JSON.parse(localStorage.getItem('ca-agent-trips') ?? '{}')
    all[j.trip.id] = j.trip
    localStorage.setItem('ca-agent-trips', JSON.stringify(all))
  } catch {}
  pushCaller('Oui, c\'est correct.')
  phase.value = 7
  pushAgent(`${READY} En ${j.total} minutes pour ${j.trip.place}.`)
  pushAgent(SMS_LINE)
}

function endCall() {
  pushAgent(BYE)
  setTimeout(() => {
    log.value = []
    phase.value = -1
    journey.value = null
    trip.value = null
    destText.value = ''
    origText.value = ''
    day.value = 'today'
    timeStr.value = nextHalfHour()
    timeMode.value = 'depart'
    walkOk.value = null
    access.value = 'none'
    copied.value = false
  }, 900)
}

async function copyLink() {
  try { await navigator.clipboard.writeText(smsLink.value) } catch {}
  copied.value = true
  setTimeout(() => copied.value = false, 1600)
}

const speed = computed(() => {
  const j = journey.value
  if (!j) return null
  const h = minutesOf(timeStr.value)
  const arrive = timeMode.value === 'arrive' ? h : Math.min(h + j.total, 1439)
  const depart = timeMode.value === 'depart' ? h : Math.max(4 * 60, arrive - j.total)
  return { depart, arrive, total: j.total, lines: [...new Set(j.trip.steps.filter(s => s.kind === 'ride').map(s => s.line))] }
})

const destResolved = computed(() => resolvePlace(destText.value))
const origResolved = computed(() => resolvePlace(origText.value))
const dayLabel = computed(() => day.value === 'today' ? "Aujourd'hui" : day.value === 'tomorrow' ? 'Demain' : fmtDate(new Date(dateISO.value || Date.now())))
const canAdvance = computed(() => {
  if (phase.value === 0) return destText.value.trim().length >= 2
  if (phase.value === 1) return origText.value.trim().length >= 2
  if (phase.value === 2) return day.value !== 'date' || !!dateISO.value
  if (phase.value === 3) return !!timeStr.value && !nowNote.value
  if (phase.value === 4) return walkOk.value !== null
  if (phase.value === 5) return true
  return false
})
</script>

<template>
  <div class="min-h-dvh bg-bg font-sans text-ink">
    <header class="sticky top-0 z-20 bg-navy text-white shadow-[0_4px_20px_-8px_rgb(0_0_0/.5)]">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <img src="/logo.png" alt="Allo TBM" class="h-10 rounded-xl bg-white px-2 py-1">
        <div class="leading-tight">
          <p class="font-display text-lg font-bold">Allo TBM · Portail conseiller</p>
          <p class="text-sm text-white/70">Préparez le trajet de l'appelant en suivant le script de l'appel</p>
        </div>
        <div class="ml-auto flex items-center gap-3">
          <label class="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm">
            <User :size="18" class="text-white/70" />
            <input v-model="agentName" class="w-24 bg-transparent font-bold outline-none placeholder:text-white/50" placeholder="Agent">
          </label>
          <span
            class="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold"
            :class="phase >= 0 ? 'bg-good text-white' : 'bg-white/10 text-white/70'"
          >
            <span v-if="phase >= 0" class="size-2 animate-pulse rounded-full bg-white" />
            {{ phase >= 0 ? 'Appel en cours' : 'Hors ligne' }}
          </span>
          <button
            v-if="phase >= 0"
            class="press flex items-center gap-1.5 rounded-xl bg-help px-4 py-2.5 text-sm font-bold text-white"
            @click="endCall"
          >
            <PhoneOff :size="18" /> Terminer l'appel
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_350px]">
      <!-- ============ colonne conversation ============ -->
      <section class="flex flex-col gap-4">
        <AnimatePresence mode="wait">
          <!-- accueil -->
          <motion.div v-if="phase === -1" key="start" class="grid place-items-center rounded-3xl bg-white p-10 text-center shadow-sm"
            :initial="{ opacity: 0, y: 16 }" :animate="{ opacity: 1, y: 0 }" :exit="{ opacity: 0 }">
            <div class="mx-auto grid size-20 place-items-center rounded-3xl bg-good-soft text-good"><Phone :size="40" /></div>
            <h1 class="mt-5 font-display text-3xl font-bold text-navy">Un appel, un trajet clé en main</h1>
            <p class="mt-2 max-w-xl text-lg text-muted">
              Posez les questions dans l'ordre, notez les réponses de l'appelant : le portail calcule le trajet le plus
              optimisé sur le réseau TBM puis envoie le lien d'itinéraire par SMS.
            </p>
            <button class="press mt-6 flex items-center gap-2 rounded-2xl bg-blue px-8 py-4 font-display text-xl font-semibold text-white shadow-xl shadow-blue/30" @click="startCall">
              <Phone :size="24" /> Démarrer l'appel
            </button>
          </motion.div>

          <!-- script + log + contrôles -->
          <motion.div v-else key="call" class="flex flex-col gap-4" :initial="{ opacity: 0, y: 16 }" :animate="{ opacity: 1, y: 0 }" :exit="{ opacity: 0 }">
            <div class="flex items-center gap-3 rounded-2xl bg-sky px-4 py-3 text-navy">
              <Sparkles :size="20" class="shrink-0" />
              <p class="text-sm font-semibold">
                <template v-if="phase <= 5">Question {{ phase + 1 }}/6 — lisez la phrase à l'appelant, puis saisissez sa réponse (ou lisez-la : <button class="underline underline-offset-2" @click="say(QUESTIONS[phase]!)">🔊</button>)</template>
                <template v-else-if="phase === 6">Récapitulatif à confirmer</template>
                <template v-else>Itinéraire prêt — envoyez le SMS</template>
              </p>
            </div>

            <!-- fil de l'appel -->
            <div class="flex max-h-[38vh] flex-col gap-2.5 overflow-y-auto rounded-3xl bg-white p-4 shadow-sm">
              <template v-for="(e, i) in log" :key="i">
                <p v-if="e.role === 'caller'" class="self-start rounded-2xl rounded-bl-sm bg-bg px-4 py-2.5 text-base text-muted" :class="{ 'bg-alert-soft text-alert': e.text.startsWith('appel entrant') }">
                  {{ e.text }}
                </p>
                <div v-else class="max-w-[92%] self-end">
                  <div class="rounded-2xl rounded-br-sm bg-navy px-4 py-2.5 text-base text-white shadow-sm">
                    <span class="mr-2 whitespace-nowrap text-xs font-bold uppercase tracking-wide text-white/60">Allo TBM</span>{{ e.text }}
                  </div>
                  <button class="mt-1 ml-auto flex items-center gap-1 text-xs font-semibold text-muted hover:text-navy" @click="say(e.text)">
                    <Volume2 :size="14" /> relire
                  </button>
                </div>
              </template>
            </div>

            <button v-if="phase > 0 && phase <= 6" class="press flex w-fit items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-muted shadow-sm" @click="back">
              <ArrowLeft :size="18" /> Question précédente
            </button>

            <div class="rounded-3xl bg-white p-5 shadow-sm">
              <AnimatePresence mode="wait">
                <!-- 1 · destination -->
                <motion.div v-if="phase === 0" key="q0" :initial="{ opacity: 0, x: 24 }" :animate="{ opacity: 1, x: 0 }" :exit="{ opacity: 0, x: -24 }">
                  <MapPin class="mb-2 text-blue" :size="28" />
                  <label class="block text-lg font-bold text-navy">Destination de l'appelant</label>
                  <div class="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      v-model="destText" list="places" placeholder="Ex. l'hôpital, la mairie, le marché…"
                      class="min-w-64 flex-1 rounded-2xl border-2 border-line bg-bg px-4 py-3.5 text-lg outline-none focus:border-blue"
                      @keydown.enter="submitDest"
                    >
                    <button class="press rounded-2xl bg-blue px-6 py-3.5 font-display text-lg font-semibold text-white shadow-lg shadow-blue/30 disabled:opacity-40" :disabled="!canAdvance" @click="submitDest">
                      Suivant
                    </button>
                  </div>
                  <datalist id="places">
                    <option v-for="p in ALL_PLACES" :key="p.name" :value="p.name">{{ p.hint }}</option>
                  </datalist>
                  <div v-if="destText.trim().length >= 2" class="mt-3 flex flex-wrap gap-2">
                    <button v-for="s in ALL_PLACES.filter(pl => pl.name.toLowerCase().includes(destText.toLowerCase()) || destText.toLowerCase().includes(pl.name.toLowerCase())).slice(0, 4)" :key="s.name"
                      class="press rounded-full bg-sky px-3.5 py-1.5 text-sm font-bold text-navy" @click="destText = s.name">
                      {{ s.name }}
                    </button>
                  </div>
                  <p v-if="destResolved && destText === destResolved.name" class="mt-3 flex items-center gap-1.5 text-sm font-semibold text-good">
                    <Check :size="16" /> Arrêt reconnu : {{ destResolved.name }}
                  </p>
                </motion.div>

                <!-- 2 · départ -->
                <motion.div v-else-if="phase === 1" key="q1" :initial="{ opacity: 0, x: 24 }" :animate="{ opacity: 1, x: 0 }" :exit="{ opacity: 0, x: -24 }">
                  <MapPin class="mb-2 text-blue" :size="28" />
                  <label class="block text-lg font-bold text-navy">Point de départ de l'appelant</label>
                  <div class="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      v-model="origText" list="places" placeholder="Ex. chez moi, un arrêt, une adresse…"
                      class="min-w-64 flex-1 rounded-2xl border-2 border-line bg-bg px-4 py-3.5 text-lg outline-none focus:border-blue"
                      @keydown.enter="submitOrig"
                    >
                    <button class="press rounded-2xl bg-blue px-6 py-3.5 font-display text-lg font-semibold text-white shadow-lg shadow-blue/30 disabled:opacity-40" :disabled="!canAdvance" @click="submitOrig">
                      Suivant
                    </button>
                  </div>
                  <button v-if="origText !== 'Chez moi'" class="press mt-3 flex items-center gap-1.5 rounded-full bg-sky px-4 py-2 text-sm font-bold text-navy" @click="origText = 'Chez moi'">
                    <MapPin :size="16" /> C'est son domicile (Chez moi)
                  </button>
                  <p v-if="origResolved && origText === origResolved.name" class="mt-3 flex items-center gap-1.5 text-sm font-semibold text-good">
                    <Check :size="16" /> Arrêt reconnu : {{ origResolved.name }}
                  </p>
                </motion.div>


                <!-- 3 · jour -->
                <motion.div v-else-if="phase === 2" key="q2" :initial="{ opacity: 0, x: 24 }" :animate="{ opacity: 1, x: 0 }" :exit="{ opacity: 0, x: -24 }">
                  <CalendarDays class="mb-2 text-blue" :size="28" />
                  <label class="block text-lg font-bold text-navy">Le jour du trajet</label>
                  <div class="mt-3 flex flex-wrap gap-2">
                    <button class="press rounded-2xl px-6 py-3.5 font-display text-lg font-semibold disabled:opacity-40" :class="day === 'today' ? 'bg-navy text-white shadow-lg shadow-navy/25' : 'bg-bg text-ink ring-2 ring-line'" @click="submitDayChoice('today')">
                      Aujourd'hui
                    </button>
                    <button class="press rounded-2xl px-6 py-3.5 font-display text-lg font-semibold disabled:opacity-40" :class="day === 'tomorrow' ? 'bg-navy text-white shadow-lg shadow-navy/25' : 'bg-bg text-ink ring-2 ring-line'" @click="submitDayChoice('tomorrow')">
                      Demain
                    </button>
                    <button class="press rounded-2xl px-6 py-3.5 font-display text-lg font-semibold disabled:opacity-40" :class="day === 'date' ? 'bg-navy text-white shadow-lg shadow-navy/25' : 'bg-bg text-ink ring-2 ring-line'" @click="submitDayChoice('date')">
                      Choisir une date
                    </button>
                  </div>
                  <input v-if="day === 'date'" v-model="dateISO" type="date"
                    class="mt-3 rounded-2xl border-2 border-line bg-bg px-4 py-3 text-lg outline-none focus:border-blue"
                    @change="pushCaller(fmtDate(new Date(dateISO))); nextPhase()">
                  <p v-if="day === 'date'" class="mt-2 text-sm text-muted">Validez la date puis cliquez sur Suivant.</p>
                </motion.div>

                <!-- 4 · heure -->
                <motion.div v-else-if="phase === 3" key="q3" :initial="{ opacity: 0, x: 24 }" :animate="{ opacity: 1, x: 0 }" :exit="{ opacity: 0, x: -24 }">
                  <Clock class="mb-2 text-blue" :size="28" />
                  <label class="block text-lg font-bold text-navy">L'heure du trajet</label>
                  <div class="mt-3 inline-flex overflow-hidden rounded-2xl ring-2 ring-line">
                    <button class="press px-5 py-3 font-display text-base font-semibold" :class="timeMode === 'depart' ? 'bg-blue text-white' : 'bg-bg text-ink'" @click="timeMode = 'depart'">
                      Partir à
                    </button>
                    <button class="press px-5 py-3 font-display text-base font-semibold" :class="timeMode === 'arrive' ? 'bg-blue text-white' : 'bg-bg text-ink'" @click="timeMode = 'arrive'">
                      Arriver à
                    </button>
                  </div>
                  <div class="mt-3 flex flex-wrap items-center gap-2">
                    <input v-model="timeStr" type="time" class="rounded-2xl border-2 border-line bg-bg px-4 py-3 text-lg outline-none focus:border-blue">
                    <button class="press rounded-2xl bg-blue px-6 py-3.5 font-display text-lg font-semibold text-white shadow-lg shadow-blue/30 disabled:opacity-40" :disabled="!canAdvance" @click="submitTime">
                      Suivant
                    </button>
                  </div>
                  <div class="mt-3 flex flex-wrap gap-2">
                    <button v-for="c in ['09:00', '12:00', '14:00', '17:30']" :key="c" class="press rounded-full bg-sky px-3.5 py-1.5 text-sm font-bold text-navy" @click="timeStr = c">
                      {{ c }}
                    </button>
                  </div>
                  <p v-if="nowNote" class="mt-3 flex items-center gap-1.5 text-sm font-semibold text-alert">
                    <AlertTriangle :size="16" /> {{ nowNote }}
                  </p>
                </motion.div>

                <!-- 5 · marche -->
                <motion.div v-else-if="phase === 4" key="q4" :initial="{ opacity: 0, x: 24 }" :animate="{ opacity: 1, x: 0 }" :exit="{ opacity: 0, x: -24 }">
                  <Footprints class="mb-2 text-blue" :size="28" />
                  <label class="block text-lg font-bold text-navy">Est-ce que l'appelant peut marcher ?</label>
                  <div class="mt-3 grid gap-2 sm:grid-cols-2">
                    <button class="press rounded-2xl px-6 py-4 text-left" :class="walkOk === true ? 'bg-navy text-white shadow-lg shadow-navy/25' : 'bg-bg text-ink ring-2 ring-line'" @click="submitWalk(true)">
                      <p class="font-display text-lg font-semibold">Oui</p>
                      <p class="text-sm opacity-70">Quelques minutes à pied</p>
                    </button>
                    <button class="press rounded-2xl px-6 py-4 text-left" :class="walkOk === false ? 'bg-navy text-white shadow-lg shadow-navy/25' : 'bg-bg text-ink ring-2 ring-line'" @click="submitWalk(false)">
                      <p class="font-display text-lg font-semibold">Non</p>
                      <p class="text-sm opacity-70">Arrêt le plus proche du départ</p>
                    </button>
                  </div>
                </motion.div>

                <!-- 6 · accessibilité -->
                <motion.div v-else-if="phase === 5" key="q5" :initial="{ opacity: 0, x: 24 }" :animate="{ opacity: 1, x: 0 }" :exit="{ opacity: 0, x: -24 }">
                  <AccessIcon class="mb-2 text-blue" :size="28" />
                  <label class="block text-lg font-bold text-navy">Accessibilité requise ?</label>
                  <div class="mt-3 grid gap-2">
                    <button class="press flex items-center justify-between rounded-2xl px-6 py-3.5 text-left" :class="access === 'none' ? 'bg-navy text-white shadow-lg shadow-navy/25' : 'bg-bg text-ink ring-2 ring-line'" @click="submitAccess('none')">
                      <span class="font-display text-lg font-semibold">Non, aucune contrainte</span>
                      <CheckCircle2 :size="22" class="opacity-60" />
                    </button>
                    <button class="press flex items-center justify-between rounded-2xl px-6 py-3.5 text-left" :class="access === 'stairs' ? 'bg-navy text-white shadow-lg shadow-navy/25' : 'bg-bg text-ink ring-2 ring-line'" @click="submitAccess('stairs')">
                      <span class="font-display text-lg font-semibold">Éviter les escaliers</span>
                      <Footprints :size="22" class="opacity-60" />
                    </button>
                    <button class="press flex items-center justify-between rounded-2xl px-6 py-3.5 text-left" :class="access === 'wheelchair' ? 'bg-navy text-white shadow-lg shadow-navy/25' : 'bg-bg text-ink ring-2 ring-line'" @click="submitAccess('wheelchair')">
                      <span class="font-display text-lg font-semibold">Trajet accessible en fauteuil roulant</span>
                      <AccessIcon :size="22" class="opacity-60" />
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>

              <!-- 7 · récapitulatif -->
              <div v-if="phase === 6">
                <CheckCheck class="mb-2 text-good" :size="28" />
                <label class="block text-lg font-bold text-navy">Vérifiez avec l'appelant</label>
                <div class="mt-3 rounded-2xl bg-bg p-4">
                  <p v-if="openWarn" class="mb-3 flex items-center gap-1.5 text-sm font-semibold text-alert"><AlertTriangle :size="16" /> {{ openWarn }}</p>
                  <dl class="grid gap-x-6 gap-y-2 text-base sm:grid-cols-2">
                    <div class="flex justify-between gap-3 border-b border-line pb-1.5"><dt class="text-muted">Destination</dt><dd class="text-right font-bold text-ink">{{ destResolved?.name ?? destText }}</dd></div>
                    <div class="flex justify-between gap-3 border-b border-line pb-1.5"><dt class="text-muted">Départ</dt><dd class="text-right font-bold text-ink">{{ origResolved?.name ?? origText }}</dd></div>
                    <div class="flex justify-between gap-3 border-b border-line pb-1.5"><dt class="text-muted">Jour</dt><dd class="text-right font-bold text-ink">{{ dayLabel }}</dd></div>
                    <div class="flex justify-between gap-3 border-b border-line pb-1.5"><dt class="text-muted">Heure</dt><dd class="text-right font-bold text-ink">{{ timeMode === 'depart' ? 'Partir à ' : 'Arriver à ' }}{{ fmt(minutesOf(timeStr)) }}</dd></div>
                    <div class="flex justify-between gap-3 border-b border-line pb-1.5"><dt class="text-muted">Marche</dt><dd class="text-right font-bold text-ink">{{ walkOk ? 'Oui' : 'Non, au minimum' }}</dd></div>
                    <div class="flex justify-between gap-3"><dt class="text-muted">Accessibilité</dt><dd class="text-right font-bold text-ink">{{ access === 'none' ? 'Aucune contrainte' : access === 'stairs' ? 'Éviter les escaliers' : 'Fauteuil roulant' }}</dd></div>
                  </dl>
                  <p v-if="speed" class="mt-3 rounded-xl bg-good-soft px-3 py-2 text-sm font-semibold text-good">
                    <Sparkles :size="15" class="mr-1 inline" /> Trajet optimisé : {{ fmt(speed.depart) }} → {{ fmt(speed.arrive) }} · {{ speed.total }} min
                    <span v-for="l in speed.lines" :key="l" class="ml-1"><LineBadge :line="l" :size="22" /></span>
                  </p>
                </div>
                <div class="mt-4 flex flex-wrap gap-2">
                  <button class="press flex items-center gap-2 rounded-2xl bg-good px-6 py-3.5 font-display text-lg font-semibold text-white shadow-lg shadow-good/30 disabled:opacity-40" :disabled="!journey" @click="confirmRecap">
                    <Check :size="22" /> Oui, c'est correct
                  </button>
                  <button class="press rounded-2xl bg-bg px-6 py-3.5 font-display text-lg font-semibold text-ink ring-2 ring-line" @click="back">
                    <RefreshCcw :size="20" class="mr-1 inline" /> Revenir aux questions
                  </button>
                </div>
              </div>


              <!-- 8 · trajet prêt + SMS -->
              <div v-if="phase === 7 && trip && speed">
                <div class="mb-3 flex items-center gap-2">
                  <Check class="text-good" :size="28" />
                  <h2 class="font-display text-2xl font-bold text-navy">{{ READY }}</h2>
                </div>
                <div class="rounded-2xl bg-bg p-4">
                  <div class="flex flex-wrap items-center gap-2 text-lg">
                    <span class="font-bold">Départ {{ fmt(speed.depart) }}</span>
                    <span class="text-muted">→</span>
                    <span class="font-bold">{{ trip.place }}</span>
                    <span class="text-muted">arrivée {{ fmt(speed.arrive) }}</span>
                    <span class="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-bold text-good"><Clock :size="15" /> {{ speed.total }} min</span>
                  </div>
                  <ol class="mt-3 flex flex-wrap items-center gap-2">
                    <template v-for="(s, i) in trip.steps" :key="i">
                      <span v-if="s.kind === 'walk'" class="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm font-semibold text-muted"><Footprints :size="14" /> {{ s.minutes }} min</span>
                      <span v-else-if="s.kind === 'ride'" class="flex items-center gap-1.5 rounded-full bg-white px-2 py-1"><LineBadge :line="s.line" :size="26" /> <span class="text-sm font-bold">{{ s.direction }}</span></span>
                      <span v-else class="text-muted">attente {{ s.inMin }} min</span>
                      <span v-if="i < trip.steps.length - 1" class="text-muted">→</span>
                    </template>
                  </ol>
                  <p v-if="access !== 'none'" class="mt-2 flex items-center gap-1.5 text-sm font-semibold text-good">
                    <AccessIcon :size="15" /> Trajet adapté : {{ access === 'stairs' ? 'sans escalier' : 'accessible en fauteuil roulant' }}, changements de plain-pied.
                  </p>
                </div>

                <p class="mt-4 text-lg">{{ SMS_LINE }}</p>

                <!-- le SMS que reçoit l'appelant -->
                <div class="mt-4 overflow-hidden rounded-3xl border-4 border-navy bg-white shadow-lg">
                  <div class="flex items-center gap-2 bg-navy px-4 py-2 text-sm font-bold text-white">
                    <Smartphone :size="16" /> Aperçu du SMS envoyé au client
                  </div>
                  <div class="p-4">
                    <div class="rounded-2xl rounded-bl-sm bg-bg px-4 py-3">
                      <p class="text-sm font-bold text-navy">Allo TBM</p>
                      <p class="mt-1 text-base">
                        Votre itinéraire vers <strong>{{ trip.place }}</strong> est prêt
                        ({{ speed.total }} min, arrivée {{ fmt(speed.arrive) }}). Ouvrez le lien :
                      </p>
                      <a class="mt-2 flex items-center gap-1.5 break-all rounded-xl bg-sky px-3 py-2 text-sm font-semibold text-blue underline" :href="smsLink" target="_blank">
                        <ExternalLink :size="15" /> {{ smsLink }}
                      </a>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <a class="press flex items-center gap-2 rounded-2xl bg-blue px-5 py-3 font-display text-base font-semibold text-white shadow-lg shadow-blue/30" :href="smsLink" target="_blank">
                        <ExternalLink :size="20" /> Ouvrir l'itinéraire (côté client)
                      </a>
                      <button class="press flex items-center gap-2 rounded-2xl bg-bg px-5 py-3 font-display text-base font-semibold text-ink ring-2 ring-line" @click="copyLink">
                        <Clipboard :size="20" /> {{ copied ? 'Lien copié !' : 'Copier le lien' }}
                      </button>
                      <button class="press ml-auto flex items-center gap-2 rounded-2xl bg-good px-5 py-3 font-display text-base font-semibold text-white shadow-lg shadow-good/30" @click="endCall">
                        <PhoneOff :size="20" /> Terminer l'appel
                      </button>
                    </div>
                  </div>
                </div>
                <p class="mt-4 text-lg font-semibold text-navy">{{ BYE }}</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </section>

      <!-- ============ fiche appel (live) ============ -->
      <aside class="hidden lg:block">
        <div class="sticky top-24 rounded-3xl bg-white p-5 shadow-sm">
          <h2 class="flex items-center gap-2 font-display text-lg font-bold text-navy"><User :size="20" /> Fiche de l'appelant</h2>
          <p class="mt-1 text-sm text-muted">Mise à jour en direct pendant l'appel</p>
          <dl class="mt-4 grid gap-3 text-base">
            <div class="rounded-2xl bg-bg px-4 py-3">
              <dt class="text-sm font-semibold text-muted">Destination</dt>
              <dd class="font-bold text-ink">{{ destResolved?.name ?? '—' }}</dd>
              <dd v-if="destResolved && destText !== destResolved.name && destText" class="text-sm text-muted">(saisi : {{ destText }})</dd>
            </div>
            <div class="rounded-2xl bg-bg px-4 py-3">
              <dt class="text-sm font-semibold text-muted">Départ</dt>
              <dd class="font-bold text-ink">{{ origResolved?.name ?? '—' }}</dd>
              <dd v-if="origResolved && origText !== origResolved.name && origText" class="text-sm text-muted">(saisi : {{ origText }})</dd>
            </div>
            <div class="rounded-2xl bg-bg px-4 py-3">
              <dt class="text-sm font-semibold text-muted">Jour / heure</dt>
              <dd class="font-bold text-ink">{{ phase >= 3 ? `${dayLabel} · ${timeMode === 'depart' ? 'partir à' : 'arriver à'} ${fmt(minutesOf(timeStr))}` : '—' }}</dd>
            </div>
            <div class="rounded-2xl bg-bg px-4 py-3">
              <dt class="text-sm font-semibold text-muted">Marche / accessibilité</dt>
              <dd class="font-bold text-ink">{{ phase >= 5 ? (walkOk ? 'Peut marcher' : 'Marche minimale') : '—' }}</dd>
              <dd v-if="phase >= 6" class="text-sm font-semibold text-good">{{ access === 'none' ? 'Aucune contrainte' : access === 'stairs' ? 'Éviter les escaliers' : 'Fauteuil roulant' }}</dd>
            </div>
          </dl>

          <div class="mt-4 rounded-2xl bg-alert-soft px-4 py-3">
            <p class="flex items-center gap-1.5 text-sm font-semibold text-alert" :class="openWarn ? 'flex' : 'hidden'">
              <AlertTriangle :size="16" /> {{ openWarn }}
            </p>
            <p v-if="!openWarn" class="text-sm text-muted">
              <span v-if="phase <= 5">Écoutez l'appelant et notez chaque réponse : le script complet est à gauche.</span>
              <span v-else-if="phase === 6">Tout est saisi — confirmez le récapitulatif avec l'appelant.</span>
              <span v-else>Trajet calculé et envoyé. Bonne fin de journée !</span>
            </p>
          </div>

          <div v-if="speed" class="mt-4 rounded-2xl bg-good-soft px-4 py-3">
            <p class="flex items-center gap-1.5 text-sm font-bold text-good"><Sparkles :size="16" /> Trajet optimisé par le portail</p>
            <p class="mt-1 text-2xl font-bold text-ink">{{ fmt(speed.depart) }} → {{ fmt(speed.arrive) }}</p>
            <p class="text-sm font-semibold text-muted">{{ speed.total }} min dès {{ dayLabel.toLowerCase() }}</p>
            <p class="mt-1.5 flex gap-1.5">
              <LineBadge v-for="l in speed.lines" :key="l" :line="l" :size="26" />
              <span v-if="speed.lines.length > 1" class="text-sm font-semibold text-muted">avec changement à pied sec</span>
            </p>
          </div>
        </div>
      </aside>
    </main>
  </div>
</template>
