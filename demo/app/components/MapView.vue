<script setup lang="ts">
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

maplibregl.setWorkerUrl(workerUrl)

const props = defineProps<{ trip: Trip | null, step: number, me: LatLng | null, padBottom: number }>()

const el = useTemplateRef<HTMLElement>('el')
let map: maplibregl.Map
let ready = false
let meMarker: maplibregl.Marker | null = null
let destMarker: maplibregl.Marker | null = null

const ll = ([lat, lng]: LatLng): [number, number] => [lng, lat]
const lineColor = (s: Step) => s.kind === 'walk' ? '#002862' : LINES[s.line].color

function routeData(): GeoJSON.FeatureCollection {
  const t = props.trip
  if (!t) return { type: 'FeatureCollection', features: [] }
  return {
    type: 'FeatureCollection',
    features: t.steps.flatMap((s, i) => {
      if (s.kind === 'wait') return []
      const opacity = props.step < 0 || i === props.step ? 1 : i < props.step ? 0.25 : 0.4
      const props_ = { kind: s.kind, color: lineColor(s), opacity }
      const line = { type: 'Feature' as const, properties: props_, geometry: { type: 'LineString' as const, coordinates: stepPath(s).map(ll) } }
      const stops = s.kind === 'ride'
        ? s.stops.map(st => ({ type: 'Feature' as const, properties: { ...props_, kind: 'stop' }, geometry: { type: 'Point' as const, coordinates: ll(st.at) } }))
        : []
      return [line, ...stops]
    }),
  }
}

function draw() {
  if (!ready) return
  ;(map.getSource('route') as maplibregl.GeoJSONSource).setData(routeData())
  destMarker?.remove()
  destMarker = null
  if (props.trip) {
    const pin = document.createElement('div')
    pin.innerHTML = '<div class="dest-pin"><span>✓</span></div>'
    destMarker = new maplibregl.Marker({ element: pin, anchor: 'bottom' }).setLngLat(ll(props.trip.dest)).addTo(map)
  }
}

function frame() {
  const t = props.trip
  if (!ready || !t) return
  const pts = props.step < 0 ? t.steps.flatMap(stepPath) : stepPath(t.steps[props.step]!)
  if (props.me) pts.push(props.me)
  const b = new maplibregl.LngLatBounds()
  pts.forEach(p => b.extend(ll(p)))
  map.fitBounds(b, { padding: { top: 110, left: 50, right: 50, bottom: props.padBottom + 40 }, maxZoom: 17, duration: 1400, essential: true })
}

onMounted(() => {
  map = new maplibregl.Map({
    container: el.value!,
    style: 'https://tiles.openfreemap.org/styles/positron',
    center: ll(HOME.at),
    zoom: 15,
    attributionControl: { compact: true },
    pitchWithRotate: false,
    dragRotate: false,
  })
  map.on('error', e => console.error('[map]', e.error?.message))
  map.on('load', () => {
    map.addSource('route', { type: 'geojson', data: routeData() })
    const isRide = ['==', ['get', 'kind'], 'ride'] as any
    map.addLayer({ id: 'ride-casing', type: 'line', source: 'route', filter: isRide, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fff', 'line-width': 13, 'line-opacity': ['get', 'opacity'] } })
    map.addLayer({ id: 'ride', type: 'line', source: 'route', filter: isRide, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 8, 'line-opacity': ['get', 'opacity'] } })
    map.addLayer({ id: 'walk', type: 'line', source: 'route', filter: ['==', ['get', 'kind'], 'walk'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 6, 'line-dasharray': [0, 2], 'line-opacity': ['get', 'opacity'] } })
    map.addLayer({ id: 'stops', type: 'circle', source: 'route', filter: ['==', ['get', 'kind'], 'stop'], paint: { 'circle-radius': 6, 'circle-color': '#fff', 'circle-stroke-width': 4, 'circle-stroke-color': ['get', 'color'], 'circle-opacity': ['get', 'opacity'], 'circle-stroke-opacity': ['get', 'opacity'] } })
    ready = true
    draw()
    frame()
  })
})

watch(() => [props.trip, props.step], () => { draw(); frame() })

watch(() => props.me, (p) => {
  if (!p || !map) return
  if (!meMarker) {
    const dot = document.createElement('div')
    dot.className = 'me-dot'
    meMarker = new maplibregl.Marker({ element: dot }).setLngLat(ll(p)).addTo(map)
  }
  else meMarker.setLngLat(ll(p))
}, { immediate: true })

onBeforeUnmount(() => map?.remove())
</script>

<template>
  <div ref="el" class="h-full w-full" role="img" aria-label="Carte du trajet" />
</template>
