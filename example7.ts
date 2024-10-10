import './style.css';
import 'maplibre-gl/dist/maplibre-gl.css';

import maplibregl from 'maplibre-gl';

import { HeatmapTileLayer, VectorTileLayer, colorBins, fetchMap } from '@deck.gl/carto';
import { Deck, FlyToInterpolator, MapView, MapViewState } from '@deck.gl/core';
import { BrushingExtension, DataFilterExtension } from '@deck.gl/extensions';
import { ArcLayer, GeoJsonLayer } from '@deck.gl/layers';

import DiamondLayer from './diamond-layer';
import GlowingArcLayer, { ADDITIVE_BLEND_PARAMETERS } from './glowing-arc-layer';
import { pointToArcDataTransform } from './arc-utils';
import { createUI, getStationTooltip } from './ui';
import { createStore, easeInOutCubic, toSeconds } from './utils';

// App State
type State = {
  builderLayers: [
    VectorTileLayer, VectorTileLayer, HeatmapTileLayer, GeoJsonLayer
  ],
  range: [number, number],
  selectedStation: number
}
const state = createStore<State>(
  {
    range: [0, 120] as [number, number],
    selectedStation: -1,
  } as State,
  render
);
createUI(state);

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

const getArcColor = colorBins({
  attr: 'duration',
  domain: [15, 30, 60].map(toSeconds),
  colors: 'Safe',
});

function onStationClick(info) {
  if (info.object) {
    const [longitude, latitude] = info.object.geometry.coordinates;
    currentViewState = {
      main: {
        ...currentViewState.main,
        longitude,
        latitude,
        transitionInterpolator: new FlyToInterpolator({ speed: 0.3 }),
        transitionDuration: 'auto',
        transitionEasing: easeInOutCubic,
      },
      minimap: currentViewState.minimap,
    };

    deck.setProps({ viewState: currentViewState });
    state.selectedStation = info.object.properties.start_station_id;
  }
}

function render() {
  const [stations, points, heatmap, buildings] = state.builderLayers;

  const diamonds = stations.clone({
    id: 'stations',
    visible: true,
    pickable: true,
    parameters: { depthWriteEnabled: false },
    _subLayerProps: { 'points-circle': { type: DiamondLayer } },
    getPointRadius: (p) =>
      p.properties.start_station_id === state.selectedStation ? 20 : 10,
    updateTriggers: { getPointRadius: state.selectedStation },
    transitions: { getPointRadius: { type: 'spring', damping: 0.1 } },
  });

  const layers = [
    diamonds.clone({ id: 'stations', onClick: onStationClick }),

    diamonds.clone({ id: 'stations-minimap', pointRadiusScale: 0.8, lineWidthScale: 0.5 }),

    buildings.clone({ id: 'buildings-minimap', pickable: false, visible: true }),

    points.clone({
      id: 'arcs',
      pointType: 'circle',
      visible: true,
      pickable: false,
      opacity: 0.5,
      _subLayerProps: {
        'points-circle': {
          type: GlowingArcLayer,
          dataTransform: pointToArcDataTransform,
          getSourcePosition: (d) => d.geometry[0],
          getTargetPosition: (d) => d.geometry[1],
          getSourceColor: getArcColor,
          getTargetColor: getArcColor,
          widthScale: 12,
          parameters: ADDITIVE_BLEND_PARAMETERS,

          // Filtering
          extensions: [new DataFilterExtension({filterSize: 2}), new BrushingExtension()],
          brushingEnabled: true,
          brushingRadius: 1000,
          brushingTarget: 'target',
          getFilterValue: (d) => [
            d.properties.start_station_id,
            d.properties.duration,
          ],
          filterRange: [
            [state.selectedStation - 0.5, state.selectedStation + 0.5],
            toSeconds(state.range),
          ],
        },
      },
    }),

    heatmap.clone({ id: 'heatmap', pickable: false, visible: true, radiusPixels: 50, intensity: 5, tileSize: 1024 }),
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
    getTooltip: getStationTooltip,
    layerFilter: ({ layer, viewport, isPicking }) => {
      // Only render layers tagged `minimap` in minimap
      if (viewport.id === 'minimap') {
        // Do not pick anything in the minimap
        if (isPicking) return false;
        return layer.id.includes('minimap');
      } else if (layer.id.includes('minimap')) {
        return false;
      }

      // Heatmap only above 12
      if (viewport.zoom > 12) {
        if (layer.id === 'heatmap') return false;
      } else {
        if (layer.id !== 'heatmap') return false;
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