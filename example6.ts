import './style.css';
import 'maplibre-gl/dist/maplibre-gl.css';

import maplibregl from 'maplibre-gl';

import { HeatmapTileLayer, VectorTileLayer, colorBins, fetchMap } from '@deck.gl/carto';
import { Deck, MapView, MapViewState } from '@deck.gl/core';
import { GeoJsonLayer } from '@deck.gl/layers';

import { createStore, easeInOutCubic, toSeconds } from './utils';

// App State
type State = {
  builderLayers: [
    VectorTileLayer, VectorTileLayer, HeatmapTileLayer, GeoJsonLayer
  ]
}
const state = createStore<State>({} as State, render);

const cartoMapId = '7fe0992f-ee41-4d6d-9dd2-8038d53368b4';

let currentViewState: Record<'main' | 'minimap', MapViewState> = {
  main: { latitude: 40, longitude: -73, zoom: 12 },
  minimap: { latitude: 40, longitude: -73, zoom: 12 }
};

const VIEWS = [
  new MapView({
    id: 'main',
    controller: true,
  }),
  new MapView({
    id: 'minimap',

    // Position bottom-left of main map
    x: '1%',
    y: '69%',
    width: '30%',
    height: '30%',

    // Minimap is overlaid on top of an existing view, so need to clear the background
    // @ts-expect-error
    clear: { color: [0, 0, 0, 0.8], depth: true },

    controller: {
      scrollZoom: true,
      // @ts-expect-error
      maxZoom: 17,
      minZoom: 12,
      dragRotate: false,
      keyboard: false,
    },
  }),
];

let deck: Deck<typeof VIEWS>;

function render() {
  const [stations, points, heatmap, buildings] = state.builderLayers;

  const layers = [
    stations.clone({ id: 'stations-minimap', visible: true, pickable: false, parameters: { depthWriteEnabled: false } }),
    
    buildings.clone({ id: 'buildings-minimap', pickable: false, visible: true, parameters: { depthWriteEnabled: false } }),

    heatmap.clone({ id: 'heatmap', pickable: false, visible: true, radiusPixels: 20, tileSize: 1024 }),
  ];
  deck.setProps({ layers });
}

export async function initialize() {
  const { basemap, initialViewState, layers } = await fetchMap({ cartoMapId });
  currentViewState = {
    main: initialViewState,
    minimap: { ...initialViewState, zoom: 12 },
  };
  deck = new Deck({
    canvas: 'deck-canvas',
    controller: true,
    initialViewState: currentViewState,
    layerFilter: ({ layer, viewport, isPicking }) => {
      // Only render layers tagged `minimap` in minimap
      if (viewport.id === 'minimap') {
        return layer.id.includes('minimap');
      } else if (layer.id.includes('minimap')) {
        return false;
      }
      return true;
    },
    views: VIEWS,
  });

  // Add basemap
  const map = new maplibregl.Map({
    container: 'map',
    interactive: false,
    ...(basemap!.props as any)
  });
  deck.setProps({
    onViewStateChange: ({ viewState, viewId }) => {
      const { longitude, latitude, bearing } = viewState;
      if (viewId === 'main') {
        // When user moves the camera in the first-person view, the minimap should follow
        currentViewState = {
          main: viewState,
          minimap: { ...currentViewState.minimap, longitude, latitude, bearing },
        };
      } else {
        // Only allow the user to change the zoom in the minimap
        currentViewState = {
          main: currentViewState.main,
          minimap: { ...currentViewState.minimap, zoom: viewState.zoom },
        };
      }

      // Apply the new view state to deck
      deck.setProps({ viewState: currentViewState });

      // Sync Maplibre basemap view to deck
      map.jumpTo({ center: [longitude, latitude], ...currentViewState.main });
    },
  });

  // Update state last as it will trigger the first render
  state.builderLayers = layers as State["builderLayers"];
}