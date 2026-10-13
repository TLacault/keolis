// Demo network: real TBM stops (coords from OSM), fixed trips from "home" near Pey-Berland.
// ponytail: hard-coded trips, swap for the TBM SIRI/GTFS-RT + journey planner API when it's more than a demo.

export type LatLng = [number, number]

export const LINES = {
  A: { name: 'Tram A', color: '#81197F', colorName: 'violet' },
  B: { name: 'Tram B', color: '#DA003E', colorName: 'rouge' },
  C: { name: 'Tram C', color: '#D35095', colorName: 'rose' },
} as const
export type LineId = keyof typeof LINES

const S = {
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
} satisfies Record<string, { name: string, at: LatLng }>
type Stop = { name: string, at: LatLng }

export const HOME: Stop = { name: 'Chez moi', at: [44.83640, -0.57420] }

export type Step =
  | { kind: 'walk', to: string, from: LatLng, dest: LatLng, minutes: number, meters: number, tip?: string, path?: LatLng[] }
  | { kind: 'wait', line: LineId, stop: string, direction: string, inMin: number, at: LatLng, tip: string }
  | { kind: 'ride', line: LineId, direction: string, stops: Stop[] }

export type Trip = {
  id: string
  label: string
  place: string
  icon: 'stethoscope' | 'basket' | 'heart' | 'trees'
  tint: string
  keywords: RegExp
  dest: LatLng
  steps: Step[]
}

const walk = (from: Stop, to: Stop, minutes: number, meters: number, tip?: string): Step =>
  ({ kind: 'walk', to: to.name, from: from.at, dest: to.at, minutes, meters, tip })

export const TRIPS: Trip[] = [
  {
    id: 'med', label: 'Mon médecin', place: 'Hôpital Pellegrin', icon: 'stethoscope', tint: '#055aba',
    keywords: /m[ée]decin|docteur|h[ôo]pital|pellegrin|rendez/i,
    dest: [44.82930, -0.60590],
    steps: [
      walk(HOME, S.hdv, 3, 220, "L'arrêt est devant la mairie, côté cathédrale."),
      { kind: 'wait', line: 'A', stop: S.hdv.name, direction: 'Mérignac Centre', inMin: 4, at: S.hdv.at, tip: "Montez dans le tram violet. Sur l'avant du tram, il est écrit « Mérignac »." },
      { kind: 'ride', line: 'A', direction: 'Mérignac Centre', stops: [S.hdv, S.palais, S.meriadeck, S.bruno, S.gavinies, S.pellegrin] },
      walk(S.pellegrin, { name: 'Hôpital Pellegrin', at: [44.82930, -0.60590] }, 2, 150, "L'entrée principale est juste en face de l'arrêt."),
    ],
  },
  {
    id: 'market', label: 'Le marché', place: 'Marché des Capucins', icon: 'basket', tint: '#13753a',
    keywords: /march[ée]|course|capucin|manger/i,
    dest: [44.83044, -0.56779],
    steps: [
      walk(HOME, S.hdv, 3, 220, "L'arrêt est devant la mairie, côté cathédrale."),
      { kind: 'wait', line: 'B', stop: S.hdv.name, direction: 'Pessac Centre', inMin: 3, at: S.hdv.at, tip: "Montez dans le tram rouge. Sur l'avant du tram, il est écrit « Pessac »." },
      { kind: 'ride', line: 'B', direction: 'Pessac Centre', stops: [S.hdv, S.musee, S.victoire] },
      walk(S.victoire, { name: 'Marché des Capucins', at: [44.83044, -0.56779] }, 5, 400, 'Traversez la place de la Victoire, puis prenez le cours Aristide-Briand.'),
    ],
  },
  {
    id: 'family', label: 'Chez Marie', place: 'Ma fille · La Bastide', icon: 'heart', tint: '#c2410c',
    keywords: /marie|fille|famille|bastide|enfant/i,
    dest: [44.84230, -0.55520],
    steps: [
      walk(HOME, S.hdv, 3, 220, "L'arrêt est devant la mairie, côté cathédrale."),
      { kind: 'wait', line: 'A', stop: S.hdv.name, direction: 'Floirac Dravemont', inMin: 5, at: S.hdv.at, tip: "Montez dans le tram violet. Sur l'avant du tram, il est écrit « Floirac »." },
      { kind: 'ride', line: 'A', direction: 'Floirac Dravemont', stops: [S.hdv, S.catherine, S.bourgogne, S.stalingrad] },
      walk(S.stalingrad, { name: 'Chez Marie', at: [44.84230, -0.55520] }, 4, 300, 'Prenez l\'avenue Thiers, la maison de Marie est au n°12.'),
    ],
  },
  {
    id: 'park', label: 'Promenade', place: 'Jardin Public', icon: 'trees', tint: '#0f766e',
    keywords: /jardin|parc|promen|balade/i,
    dest: [44.84860, -0.57640],
    steps: [
      walk(HOME, S.hdv, 3, 220, "L'arrêt est devant la mairie, côté cathédrale."),
      { kind: 'wait', line: 'B', stop: S.hdv.name, direction: 'Berges de la Garonne', inMin: 2, at: S.hdv.at, tip: "Montez dans le tram rouge. Sur l'avant du tram, il est écrit « Berges de la Garonne »." },
      { kind: 'ride', line: 'B', direction: 'Berges de la Garonne', stops: [S.hdv, S.gambetta, S.theatre, S.quinconces] },
      { kind: 'wait', line: 'C', stop: S.quinconces.name, direction: 'Parc des Expositions', inMin: 3, at: S.quinconces.at, tip: "C'est un changement : restez sur le même quai et attendez le tram rose « Parc des Expositions »." },
      { kind: 'ride', line: 'C', direction: 'Parc des Expositions', stops: [S.quinconces, S.jardin] },
      walk(S.jardin, { name: 'Jardin Public', at: [44.84860, -0.57640] }, 3, 250, "L'entrée du jardin est à gauche en sortant du tram."),
    ],
  },
]

export const tripMinutes = (t: Trip) => t.steps.reduce((m, s) =>
  m + (s.kind === 'walk' ? s.minutes : s.kind === 'wait' ? s.inMin : (s.stops.length - 1) * 2), 0)

export const stepPath = (s: Step): LatLng[] =>
  s.kind === 'walk' ? (s.path ?? [s.from, s.dest]) : s.kind === 'ride' ? s.stops.map(x => x.at) : [s.at]

export const clock = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')

// Real street-following walking paths (free FOSSGIS OSRM), straight line on failure.
export async function loadWalkPaths(trip: Trip) {
  await Promise.all(trip.steps.map(async (s) => {
    if (s.kind !== 'walk' || s.path) return
    try {
      const q = `${s.from[1]},${s.from[0]};${s.dest[1]},${s.dest[0]}`
      const r = await fetch(`https://routing.openstreetmap.de/routed-foot/route/v1/foot/${q}?overview=full&geometries=geojson`)
      const coords: [number, number][] = (await r.json()).routes[0].geometry.coordinates
      s.path = coords.map(([lng, lat]) => [lat, lng])
    }
    catch { /* straight line it is */ }
  }))
}

// Point at fraction t (0..1) along a polyline, by distance.
export function along(path: LatLng[], t: number): LatLng {
  if (path.length < 2) return path[0]!
  const seg = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i]![0], p[1] - path[i]![1]))
  let d = Math.min(Math.max(t, 0), 1) * seg.reduce((a, b) => a + b, 0)
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i]! || i === seg.length - 1) {
      const k = seg[i] ? Math.min(d / seg[i]!, 1) : 1
      const a = path[i]!, b = path[i + 1]!
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
    }
    d -= seg[i]!
  }
  return path.at(-1)!
}
