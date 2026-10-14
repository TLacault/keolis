// Mini journey-planner over the demo TBM network (real BdX stop coords, lines A/B/C).
// Used by the /agent portal: it turns the caller's answers into the best/optimised trip
// (shortest total time, fewest changes, level-access aware) in the same Step[] format
// the Facili'TBM traveller app renders. Swap the schedule for TBM SIRI/GTFS-RT later.

import type { LatLng, LineId, Step, Trip } from './trips'
import { HOME } from './trips'

export type AccessNeed = 'none' | 'stairs' | 'wheelchair'

export type ResolvedLayout = {
  kind: 'home' | 'poi' | 'stop'
  name: string
  at: LatLng
  stop: string
  footMin: number
  footM: number
}

const stop = (id: string) => STOP_BY_ID[id]!
const meter = (a: LatLng, b: LatLng) => {
  const dLat = (b[0] - a[0]) * 111320
  const dLng = (b[1] - a[1]) * 111320 * Math.cos(a[0] * Math.PI / 180)
  return Math.hypot(dLat, dLng)
}
const walkOf = (m: number) => ({ minutes: Math.max(1, Math.round(m / 78)), meters: Math.round(m) })

type StopInfo = { name: string, at: LatLng }
const STOP_BY_ID: Record<string, StopInfo> = {
  hdv: { name: 'Hôtel de Ville', at: [44.83775, -0.57695] },
  palais: { name: 'Palais de Justice', at: [44.83628, -0.58157] },
  meriadeck: { name: 'Mériadeck', at: [44.83745, -0.58560] },
  bruno: { name: 'Saint-Bruno', at: [44.83742, -0.58927] },
  gavinies: { name: 'Gaviniès', at: [44.83312, -0.5932] },
  pellegrin: { name: 'Hôpital Pellegrin', at: [44.83019, -0.60462] },
  musee: { name: "Musée d'Aquitaine", at: [44.83549, -0.57537] },
  victoire: { name: 'Victoire', at: [44.83085, -0.57255] },
  catherine: { name: 'Sainte-Catherine', at: [44.83825, -0.57190] },
  bourgogne: { name: 'Porte de Bourgogne', at: [44.83721, -0.56629] },
  stalingrad: { name: 'Stalingrad', at: [44.84055, -0.55950] },
  gambetta: { name: 'Gambetta', at: [44.84095, -0.58050] },
  theatre: { name: 'Grand Théâtre', at: [44.84201, -0.57529] },
  quinconces: { name: 'Quinconces', at: [44.84500, -0.57390] },
  jardin: { name: 'Jardin Public', at: [44.84790, -0.57310] },
}

const STOP_TAGS: Record<string, string[]> = {
  hdv: ['mairie', 'hotel de ville', 'cathédrale', 'place'],
  palais: ['palais', 'justice', 'tribunal', 'cour'],
  meriadeck: ['meriadeck', 'bibliothèque', 'prefecture', 'piscine'],
  bruno: ['bruno', 'saint bruno', 'eglise'],
  gavinies: ['gaviniès', 'gavinies'],
  pellegrin: ['pellegrin', 'hopital', 'clinique', 'medical', 'médecine'],
  musee: ['musee', 'aquitaine'],
  victoire: ['victoire', 'fac', 'universite', 'lycée'],
  catherine: ['sainte catherine', 'catherine'],
  bourgogne: ['bourgogne', 'porte'],
  stalingrad: ['stalingrad', 'bastide', 'pont'],
  gambetta: ['gambetta'],
  theatre: ['theatre', 'opera', 'concert', 'grand theatre'],
  quinconces: ['quinconces', 'allées'],
  jardin: ['jardin public', 'parc', 'jardin'],
}

// Places people actually say, mapped to the alighting stop + final sidewalk.
const POIS: (ResolvedLayout & { tags: string[] })[] = [
  { kind: 'poi', name: 'Hôpital Pellegrin', at: [44.82930, -0.60590], stop: 'pellegrin', footMin: 3, footM: 150, tags: ['rendez vous', 'rdv', 'consultation', 'medecin', 'docteur', 'hopital', 'pellegrin', 'clinique', 'malade'] },
  { kind: 'poi', name: "Chez Marie (La Bastide)", at: [44.84230, -0.55520], stop: 'stalingrad', footMin: 4, footM: 300, tags: ['marie', 'fille', 'famille', 'bastide', 'enfant', 'petit fils', 'petite fille'] },
  { kind: 'poi', name: 'Marché des Capucins', at: [44.83044, -0.56779], stop: 'victoire', footMin: 5, footM: 400, tags: ['marche', 'marches', 'capucins', 'course', 'courses', 'manger', 'alimentation', 'marche des capucins'] },
  { kind: 'poi', name: 'Jardin Public', at: [44.84860, -0.57640], stop: 'jardin', footMin: 3, footM: 250, tags: ['jardin public', 'promenade', 'balade', 'jardin', 'parc'] },
  { kind: 'poi', name: 'Bibliothèque Mériadeck', at: [44.83710, -0.58500], stop: 'meriadeck', footMin: 0, footM: 40, tags: ['bibliotheque', 'meriadeck'] },
  { kind: 'poi', name: 'Grand Théâtre', at: [44.84210, -0.57520], stop: 'theatre', footMin: 0, footM: 40, tags: ['theatre', 'opera', 'spectacle', 'concert'] },
  { kind: 'poi', name: 'Hôtel de Ville', at: [44.83775, -0.57695], stop: 'hdv', footMin: 0, footM: 0, tags: ['mairie', 'hotel de ville', 'mariage'] },
]

const SUGGESTED_STOPS: { name: string, at: LatLng }[] = Object.values(STOP_BY_ID)

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export const ALL_PLACES = [
  { name: 'Chez moi', hint: 'domicile du client' },
  ...POIS.map(p => ({ name: p.name, hint: `derrière l'arrêt ${stop(p.stop).name}` })),
  ...SUGGESTED_STOPS.map(s => ({ name: s.name, hint: "arrêt de tram" })),
]

/** Turn free-form caller speech ("à l'hôpital…", "la mairie", "chez ma fille") into a place on the network. */
export function resolvePlace(text: string): ResolvedLayout | null {
  const t = norm(text)
  if (!t) return null
  if (/(^|\b)(chez moi|maison|domicile)(\b|$)/.test(t)) {
    const w = walkOf(meter(HOME.at, stop('hdv').at))
    return { kind: 'home', name: 'Chez moi', at: HOME.at, stop: 'hdv', footMin: w.minutes, footM: w.meters }
  }
  for (const p of POIS) {
    for (const tag of p.tags) if (norm(tag) && t.includes(norm(tag))) return p
  }
  let best: ResolvedLayout | null = null
  let bestScore = 0
  for (const [id, s] of Object.entries(STOP_BY_ID)) {
    const name = norm(s.name)
    const score = t.includes(name) ? name.length : (name.includes(t) ? t.length : 0)
    for (const tag of STOP_TAGS[id] ?? []) {
      const tn = norm(tag)
      if (t.includes(tn) && tn.length > score) { best = { kind: 'stop', name: s.name, at: s.at, stop: id, footMin: 0, footM: 0 }; bestScore = tn.length }
    }
    if (score > bestScore) { best = { kind: 'stop', name: s.name, at: s.at, stop: id, footMin: 0, footM: 0 }; bestScore = score }
  }
  // one-word fuzzy: count how many of the caller's words appear in a stop name
  if (!best || bestScore < 4) {
    const words = t.split(/[^a-z0-9]+/).filter(w => w.length >= 3)
    for (const [id, s] of Object.entries(STOP_BY_ID)) {
      const nameWords = new Set(norm(s.name).split(/[^a-z0-9]+/))
      const hit = words.filter(w => nameWords.has(w)).length
      if (hit >= 1 && hit / words.length >= 0.5 && !best) best = { kind: 'stop', name: s.name, at: s.at, stop: id, footMin: 0, footM: 0 }
    }
  }
  return best
}

// ---- network graph ---------------------------------------------------------

type Route = { to: string, line: LineId }
type LineRoute = { direction: string, path: string[] }
const LINE_ROUTES: Record<LineId, LineRoute[]> = {
  A: [
    { direction: 'Mérignac Centre', path: ['hdv', 'palais', 'meriadeck', 'bruno', 'gavinies', 'pellegrin'] },
    { direction: 'Floirac Dravemont', path: ['hdv', 'catherine', 'bourgogne', 'stalingrad'] },
  ],
  B: [
    { direction: 'Pessac Centre', path: ['hdv', 'musee', 'victoire'] },
    { direction: 'Berges de la Garonne', path: ['hdv', 'gambetta', 'theatre', 'quinconces'] },
  ],
  C: [
    { direction: 'Parc des Expositions', path: ['quinconces', 'jardin'] },
    { direction: 'Gare de Bègles', path: ['jardin', 'quinconces'] },
  ],
}

const GRAPH: Record<string, Route[]> = (() => {
  const g: Record<string, Route[]> = {}
  for (const [line, routes] of Object.entries(LINE_ROUTES)) {
    for (const r of routes) {
      for (let i = 0; i < r.path.length - 1; i++) {
        const a: string = r.path[i]!
        const b: string = r.path[i + 1]!
        if (!g[a]) g[a] = []
        if (!g[b]) g[b] = []
        g[a]!.push({ to: b, line: line as LineId })
        g[b]!.push({ to: a, line: line as LineId })
      }
    }
  }
  return g
})()

// stubbornly demo, but deterministic: a plausible headway per line from 4h30 ↔ 23h30.
const SCHEDULE: Record<LineId, { interval: number, offset: number }> = {
  A: { interval: 10, offset: 3 },
  B: { interval: 9, offset: 6 },
  C: { interval: 12, offset: 2 },
}
const FIRST_SVC = 4 * 60 + 15
const LAST_SVC = 23 * 60 + 30
const nextDeparture = (line: LineId, now: number) => {
  const { interval, offset } = SCHEDULE[line]
  const k = Math.max(0, Math.ceil((now - FIRST_SVC - offset) / interval))
  return FIRST_SVC + offset + k * interval
}

type Leg = { line: LineId, from: string, to: string, stops: string[], direction: string }

const transferPenalty = (access: AccessNeed) => access === 'wheelchair' ? 4 : access === 'stairs' ? 3 : 1

/** Dijkstra over (stop, line-arrived-on): ride 2 min/hop, transfer penalty when switching lines. */
export function planLegs(fromStop: string, toStop: string, access: AccessNeed): Leg[] {
  const best: Map<string, { cost: number, prev: string, line: LineId | null }> = new Map()
  const key = (s: string, l: LineId | null) => `${s}|${l ?? ''}`
  const start = key(fromStop, null)
  best.set(start, { cost: 0, prev: '', line: null })
  const pq: { k: string, cost: number }[] = [{ k: start, cost: 0 }]
  const pushed = new Set([start])
  let goal: string | null = null
  while (pq.length) {
    pq.sort((a, b) => a.cost - b.cost)
    const { k, cost } = pq.shift()!
    if (cost > best.get(k)!.cost) continue
    const st = k.split('|'), stopId = st[0]!, lineIn = st[1] ?? ''
    if (stopId === toStop) { goal = k; break }
    for (const r of GRAPH[stopId] ?? []) {
      const costIn = cost + 2 + (lineIn && lineIn !== r.line ? transferPenalty(access) : 0)
      const nk = key(r.to, r.line)
      if (!best.has(nk) || costIn < best.get(nk)!.cost) {
        best.set(nk, { cost: costIn, prev: k, line: r.line })
        if (!pushed.has(nk)) { pushed.add(nk); pq.push({ k: nk, cost: costIn }) }
      }
    }
  }
  if (!goal) return []
  const nodes: { stop: string, line: LineId | null }[] = []
  for (let k = goal; k; k = best.get(k)!.prev!) { const st = k.split('|'); const stopId = st[0]!; const line = (st[1] as LineId | undefined) ?? null; nodes.unshift({ stop: stopId, line }) }
  const legs: Leg[] = []
  let cur: Leg | null = null
  for (let i = 1; i < nodes.length; i++) {
    const line = nodes[i]!.line!
    if (!cur || cur.line !== line) {
      cur = { line, from: nodes[i - 1]!.stop, to: nodes[i]!.stop, stops: [nodes[i - 1]!.stop], direction: '' }
      legs.push(cur)
    }
    cur.to = nodes[i]!.stop
    cur.stops.push(nodes[i]!.stop)
  }
  for (const leg of legs) {
    for (const r of LINE_ROUTES[leg.line]) {
      const i = r.path.indexOf(leg.from), j = r.path.indexOf(leg.to)
      if (i >= 0 && j > i) { leg.direction = r.direction; break }
      if (i >= 0 && j < i) { // ride against a route: label with the opposite terminus
        leg.direction = LINE_ROUTES[leg.line].filter(o => o !== r).map(o => o.direction)[0] ?? ''
        break
      }
    }
  }
  return legs
}

// ---- journey build ----------------------------------------------------------

export type Journey = { trip: Trip, total: number, legsCount: number }

/** Optimised journey from the caller's answers; h = departure (mode 'depart') or arrival (mode 'arrive') of the day. */
export function planJourney(opts: {
  from: ResolvedLayout, to: ResolvedLayout,
  day: Date, h: number, mode: 'depart' | 'arrive',
  walk: 'yes' | 'no', access: AccessNeed,
}): Journey | null {
  const legs = planLegs(opts.from.stop, opts.to.stop, opts.access)
  if (!legs.length) return null
  const cappedWalk = opts.walk === 'no' && opts.from.footM > 400 ? { minutes: Math.round(400 / 78), meters: 400 } : null
  const walkOut = cappedWalk ?? walkOf(opts.from.footM)
  const destWalk = walkOf(opts.to.footM)

  let start = opts.h
  if (opts.mode === 'arrive') { // rough total first, then centre the start so arrival ≈ h
    const rough = buildSteps(legs, Math.max(FIRST_SVC, start - 240), walkOut, destWalk, opts)
    if (rough) start = Math.max(FIRST_SVC, start - rough.total)
  }
  start = Math.min(Math.max(start, FIRST_SVC), LAST_SVC - 5)
  const t = buildSteps(legs, start, walkOut, destWalk, opts)
  if (!t) return null
  const trip: Trip = {
    id: `ag-${Math.random().toString(36).slice(2, 9)}`,
    label: opts.to.name,
    place: opts.to.name,
    icon: 'trees',
    tint: '#055aba',
    keywords: /^$/,
    dest: opts.to.at,
    steps: t.steps,
  }
  return { trip, total: t.total, legsCount: legs.length }
}

function buildSteps(legs: Leg[], start: number, walkOut: { minutes: number, meters: number }, destWalk: { minutes: number, meters: number }, opts: {
  from: ResolvedLayout, to: ResolvedLayout, access: AccessNeed, walk: 'yes' | 'no'
}): { steps: Step[], total: number } | null {
  const steps: Step[] = []
  const from = opts.from, to = opts.to
  if (walkOut.minutes > 0) {
    steps.push({
      kind: 'walk', to: stop(from.stop).name, from: from.at, dest: stop(from.stop).at,
      minutes: walkOut.minutes, meters: walkOut.meters,
      tip: opts.walk === 'no' ? 'Arrêt le plus proche du départ.' : `Arrêt ${stop(from.stop).name}, à ${walkOut.minutes} min à pied.`,
    })
  }
  let now = start + walkOut.minutes
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i]!
    const prev = legs[i - 1]
    const transfer = prev && prev.line !== leg.line
    const dep = Math.max(now, nextDeparture(leg.line, now))
    steps.push({
      kind: 'wait', line: leg.line, stop: stop(leg.from).name, direction: leg.direction,
      inMin: dep - now, at: stop(leg.from).at,
      tip: transfer ? `Changement ${opts.access !== 'none' ? 'accessible de plein-pied' : 'sur le même quai'} : attendez le ${LINES_NAME[leg.line]} direction ${leg.direction}.` :
        `Montez dans le ${LINES_NAME[leg.line]} direction ${leg.direction}.`,
    })
    const stopList = leg.stops.map(id => stop(id))
    steps.push({ kind: 'ride', line: leg.line, direction: leg.direction, stops: stopList })
    now = dep + (leg.stops.length - 1) * 2
  }
  if (destWalk.minutes > 0) {
    const last = legs.at(-1)!
    steps.push({
      kind: 'walk', to: to.name, from: stop(last.to).at, dest: to.at,
      minutes: destWalk.minutes, meters: destWalk.meters,
      tip: opts.access !== 'none' ? `${to.name} est à ${destWalk.minutes} min, chemin de plain-pied.` : `Puis environ ${destWalk.minutes} min à pied jusqu'à ${to.name}.`,
    })
  }
  return { steps, total: steps.reduce((m, s) => m + (s.kind === 'walk' ? s.minutes : s.kind === 'wait' ? s.inMin : (s.stops.length - 1) * 2), 0) }
}

const LINES_NAME: Record<LineId, string> = { A: 'tram A', B: 'tram B', C: 'tram C' }

export const stopCoords = (id: string) => STOP_BY_ID[id]?.at ?? HOME.at
export { nextDeparture, STOP_BY_ID }
