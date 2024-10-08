import './style.css';
import 'maplibre-gl/dist/maplibre-gl.css';

import maplibregl from 'maplibre-gl';

import { HeatmapTileLayer, VectorTileLayer, colorBins, fetchMap } from '@deck.gl/carto';
import { Deck, FlyToInterpolator, MapView, MapViewState } from '@deck.gl/core';
import { DataFilterExtension } from '@deck.gl/extensions';
import { ArcLayer, GeoJsonLayer } from '@deck.gl/layers';

import DiamondLayer from './diamond-layer';
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
    selectedStation: 3254,
  } as State,
  render
);
createUI(state);

const cartoMapId = '7fe0992f-ee41-4d6d-9dd2-8038d53368b4';

let currentViewState: Record<'main', MapViewState> = {
  main: { latitude: 40, longitude: -73, zoom: 12 }
};

const VIEWS = [
  new MapView({
    id: 'main',
    controller: true,
  })
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
      }
    };

    deck.setProps({ viewState: currentViewState });
    state.selectedStation = info.object.properties.start_station_id;
  }
}

function render() {
  const [stations, points, heatmap, buildings] = state.builderLayers;

  const layers = [
    stations.clone({
      id: 'stations',
      visible: true,
      pickable: true,
      onClick: onStationClick,
      parameters: { depthWriteEnabled: false },
      _subLayerProps: { 'points-circle': { type: DiamondLayer } },
      getPointRadius: (p) =>
        p.properties.start_station_id === state.selectedStation ? 20 : 10,
      updateTriggers: { getPointRadius: state.selectedStation },
      transitions: { getPointRadius: { type: 'spring', damping: 0.1 } },
    }),

    points.clone({
      id: 'arcs',
      pointType: 'circle',
      visible: true,
      pickable: false,
      opacity: 1,
      _subLayerProps: {
        'points-circle': {
          type: ArcLayer,
          dataTransform: pointToArcDataTransform,
          getSourcePosition: (d) => d.geometry[0],
          getTargetPosition: (d) => d.geometry[1],
          getSourceColor: getArcColor,
          getTargetColor: getArcColor,

          // Filtering
          extensions: [new DataFilterExtension({ filterSize: 2 })],
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
  ];
  deck.setProps({ layers });
}

export async function initialize() {
  const { basemap, initialViewState, layers } = await fetchMap({ cartoMapId });
  currentViewState = { main: initialViewState };
  deck = new Deck({
    canvas: 'deck-canvas',
    controller: true,
    initialViewState: currentViewState,
    getTooltip: getStationTooltip,
    views: VIEWS,
  });

  // Add basemap
  const map = new maplibregl.Map({ container: 'map', interactive: false, ...(basemap!.props as any) });
  deck.setProps({
    onViewStateChange: ({ viewState, viewId }) => {
      const { longitude, latitude } = viewState;
      currentViewState = { main: viewState };

      // Apply the new view state to deck
      deck.setProps({ viewState: currentViewState });

      // Sync Maplibre basemap view to deck
      map.jumpTo({ center: [longitude, latitude], ...currentViewState.main });
    },
  });

  // Update state last as it will trigger the first render
  state.builderLayers = layers as State["builderLayers"];
}