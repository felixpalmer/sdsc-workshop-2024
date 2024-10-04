import maplibregl from 'maplibre-gl';

import { HeatmapTileLayer, VectorTileLayer, colorBins, fetchMap } from '@deck.gl/carto';
import { Deck, FlyToInterpolator, MapViewState } from '@deck.gl/core';
import { GeoJsonLayer } from '@deck.gl/layers';

import { getStationTooltip } from './ui';
import { createStore, easeInOutCubic } from './utils';
import DiamondLayer from './diamond-layer'; // <-- Add custom layer

// App State
type State = {
  builderLayers: [
    VectorTileLayer, VectorTileLayer, HeatmapTileLayer, GeoJsonLayer
  ],
  selectedStation: number // <-- Enhance state with selected station
}
const state = createStore<State>({} as State, render);
let currentViewState: MapViewState;

// v--- Handler for click event ---v
function onStationClick(info) {
  if (info.object) {
    state.selectedStation = info.object.properties.start_station_id;
  }
}

// Simple deck render function
let deck: Deck;
function render() {
  const [stations, points, heatmap, buildings] = state.builderLayers;

  const layers = [
    stations.clone({
      visible: true,

      // v--- Highlight selected station ---v
      onClick: onStationClick,
      getPointRadius: (p) => p.properties.start_station_id === state.selectedStation ? 20 : 10,
      // pointRadiusScale: 5,
      updateTriggers: {getPointRadius: state.selectedStation},
      transitions: { getPointRadius: { type: 'spring', damping: 0.1 } },

      _subLayerProps: {
        'points-circle': {
          type: DiamondLayer // <-- Inject custom layer instead of ScatterplotLayer
        }
      }
    })
  ];
  deck.setProps({ layers, viewState: currentViewState });
}

// Fetch map with given id, then create deck and basemap
const cartoMapId = '7fe0992f-ee41-4d6d-9dd2-8038d53368b4';
export async function initialize() {
  const { basemap, initialViewState, layers } = await fetchMap({ cartoMapId });

  deck = new Deck({
    canvas: 'deck-canvas', controller: true, initialViewState: {...initialViewState, zoom: 15},
    getTooltip: getStationTooltip
  });

  const map = new maplibregl.Map({ container: 'map', interactive: false, ...(basemap!.props as any) });
  deck.setProps({
    onViewStateChange: ({ viewState }) => {
      const { longitude, latitude, ...rest } = viewState;

      // Apply the new view state to deck
      deck.setProps({ viewState });

      // Sync Maplibre basemap view to deck
      map.jumpTo({ center: [longitude, latitude], ...rest });
    },
  });

  // Update state last as it will trigger the first render
  state.builderLayers = layers as State["builderLayers"];
}