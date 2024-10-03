import maplibregl from 'maplibre-gl';

import { HeatmapTileLayer, VectorTileLayer, colorBins, fetchMap } from '@deck.gl/carto';
import { Deck, MapViewState } from '@deck.gl/core';
import { GeoJsonLayer } from '@deck.gl/layers';

import { createStore } from './utils';

// App State
const state = createStore<State>({} as State, render);
type State = {
  builderLayers: [
    VectorTileLayer, VectorTileLayer, HeatmapTileLayer, GeoJsonLayer
  ]
}

// Simple deck render function
let deck: Deck;
function render() {
  const [stations, points, heatmap, buildings] = state.builderLayers;

  const layers = [
    stations.clone({visible: true}),
    buildings.clone({pickable: false, visible: true}),
  ];
  deck.setProps({ layers });
}

// Fetch map with given id, then create deck and basemap
const cartoMapId = '7fe0992f-ee41-4d6d-9dd2-8038d53368b4';
export async function initialize() {
  const { basemap, initialViewState, layers } = await fetchMap({ cartoMapId });

  deck = new Deck({canvas: 'deck-canvas', controller: true, initialViewState});

  const map = new maplibregl.Map({container: 'map',interactive: false, ...(basemap!.props as any) });
  deck.setProps({
    onViewStateChange: ({ viewState }) => {
      const {longitude, latitude, ...rest} = viewState;

      // Apply the new view state to deck
      deck.setProps({ viewState });

      // Sync Maplibre basemap view to deck
      map.jumpTo({ center: [longitude, latitude], ...rest });
    },
  });

  // Update state last as it will trigger the first render
  state.builderLayers = layers as State["builderLayers"];
}