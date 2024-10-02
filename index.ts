import './style.css';
import 'maplibre-gl/dist/maplibre-gl.css';

import maplibregl from 'maplibre-gl';

import { colorBins, fetchMap } from '@deck.gl/carto';
import {
  Deck,
  FlyToInterpolator,
  Layer,
  MapView,
  MapViewState,
} from '@deck.gl/core';
import { DataFilterExtension } from '@deck.gl/extensions';
import { ArcLayer } from '@deck.gl/layers';

import DiamondLayer from './diamond-layer';
import { pointToArcDataTransform } from './arc-utils';
import { createUI } from './ui';
import { createStore, easeInOutCubic } from './utils';

let deck: Deck;

// App State
const state = createStore(
  {
    builderLayers: [] as Layer[],
    range: [0, 120] as [number, number],
    selectedStation: -1,
  },
  render
);
createUI(state);

const cartoMapId = '7fe0992f-ee41-4d6d-9dd2-8038d53368b4';

let currentViewState: Record<string, MapViewState> = {
  main: {
    latitude: 40.7075643973699,
    longitude: -73.98119878435548,
    zoom: 12,
  },
  minimap: {
    latitude: 40.7075643973699,
    longitude: -73.98119878435548,
    zoom: 12,
  },
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
    clear: { color: [0, 0, 0, 0.8], depth: true },

    controller: {
      scrollZoom: true,
      maxZoom: 17,
      minZoom: 12,
      dragRotate: false,
      keyboard: false,
    },
  }),
];

fetchMap({ cartoMapId }).then(({ basemap, initialViewState, layers }) => {
  currentViewState = {
    main: initialViewState,
    minimap: { ...initialViewState, zoom: 12 },
  };
  deck = new Deck({
    canvas: 'deck-canvas',
    controller: true,
    initialViewState: currentViewState,
    getTooltip: ({ object }) => {
      return (
        object && {
          html: `
        <strong>Station id</strong>: ${object.properties.start_station_id}<br/>
        <strong>Rides</strong>: ${object.properties.ride_count}<br/>
      `,
        }
      );
    },
    layerFilter: ({ layer, viewport, isPicking }) => {
      const { cartoLabel } = layer.props;

      if (viewport.id === 'minimap') {
        return layer.id.includes('minimap');
      } else if (layer.id.includes('minimap')) {
        return false;
      }

      if (isPicking && viewport.id === 'minimap') {
        // Do not pick anything in the minimap
        return false;
      }

      if (viewport.zoom > 12) {
        if (cartoLabel === 'Heatmap') {
          return false;
        }
      } else {
        if (cartoLabel !== 'Heatmap') {
          return false;
        }
      }

      return true;
    },
    views: VIEWS,
  });

  // Add basemap
  const map = new maplibregl.Map({
    container: 'map',
    interactive: false,
    ...(basemap.props as any), // TODO fix!!!
  });
  deck.setProps({
    onViewStateChange: ({ viewState, viewId }) => {
      if (viewId === 'main') {
        // When user moves the camera in the first-person view, the minimap should follow
        currentViewState = {
          main: viewState,
          minimap: {
            ...currentViewState.minimap,
            longitude: viewState.longitude,
            latitude: viewState.latitude,
            bearing: viewState.bearing,
            //pitch: viewState.pitch,
          },
        };

        const { longitude, latitude, ...rest } = viewState;
        map.jumpTo({ center: [longitude, latitude], ...rest });
      } else {
        // Only allow the user to change the zoom in the minimap
        currentViewState = {
          main: currentViewState.main,
          minimap: {
            ...currentViewState.minimap,
            zoom: viewState.zoom,
          },
        };
      }
      // Apply the new view state
      deck.setProps({ viewState: currentViewState });
    },
  });

  // Update state last as it will trigger the first render
  state.builderLayers = layers;
});

function toSeconds(minutes) {
  return 60 * minutes;
}

const getArcColor = colorBins({
  attr: 'duration',
  domain: [15, 30, 60].map(toSeconds),
  colors: 'Safe',
});

function render() {
  const [stations, points, heatmap, buildings] = state.builderLayers;

  const layers = [
    stations.clone({
      id: 'stations',
      visible: true,
      pickable: true,
      parameters: { depthTest: false },
      onClick: (info) => {
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
      },
      _subLayerProps: { 'points-circle': { type: DiamondLayer } },
      getPointRadius: (p) =>
        p.properties.start_station_id === state.selectedStation ? 20 : 10,
      updateTriggers: { getPointRadius: state.selectedStation },
      transitions: { getPointRadius: { type: 'spring', damping: 0.1 } },
    }),
    stations.clone({
      id: 'stations-minimap',
      visible: true,
      pickable: false,
      pointRadiusScale: 0.8,
      lineWidthScale: 0.5,
      _subLayerProps: { 'points-circle': { type: DiamondLayer } },
    }),

    buildings.clone({
      id: 'buildings-minimap',
      pickable: false,
    }),

    points.clone({
      id: 'arcs',
      pointType: 'circle',
      visible: true,
      pickable: false,
      opacity: 0.5,
      _subLayerProps: {
        'points-circle': {
          type: ArcLayer,
          dataTransform: pointToArcDataTransform,
          getSourcePosition: (d) => d.geometry[0],
          getTargetPosition: (d) => d.geometry[1],
          getSourceColor: getArcColor,
          getTargetColor: getArcColor,
          widthScale: 2,

          // Filtering
          extensions: [new DataFilterExtension({ filterSize: 2 })],
          getFilterValue: (d) => [
            d.properties.start_station_id,
            d.properties.duration,
          ],
          filterRange: [
            [state.selectedStation - 0.5, state.selectedStation + 0.5],
            state.range.map(toSeconds),
          ],
        },
      },
    }),

    heatmap.clone({
      pickable: false,
      visible: true,
      colorRange: [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
      ],
      getWeight: (p) => p.properties.ride_count_sum,
      radiusPixels: 40,
      intensity: 3,
    }),
  ];
  deck.setProps({ layers });
}
