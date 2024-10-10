import maplibregl from 'maplibre-gl';

import { HeatmapTileLayer, VectorTileLayer, colorBins, fetchMap } from '@deck.gl/carto';
import { Deck, MapViewState } from '@deck.gl/core';
import { GeoJsonLayer } from '@deck.gl/layers';
import { DataFilterExtension, DataFilterExtensionProps } from '@deck.gl/extensions'; // <-- Add extension

import { createUI, getStationTooltip } from './ui'; // <-- Add basic UI
import { createStore, toSeconds } from './utils';

// App State
type State = {
    builderLayers: [
        VectorTileLayer<any, DataFilterExtensionProps>, VectorTileLayer, HeatmapTileLayer, GeoJsonLayer
    ],
    range: [number, number] // <-- Enhance state with range
}
const state = createStore<State>({ range: [0, 120] as [number, number] } as State, render);
createUI(state); // <-- Display HTML UI

// Simple deck render function
let deck: Deck;
function render() {
    const [stations, points, heatmap, buildings] = state.builderLayers;

    const layers = [
        stations.clone({
            visible: true,
            parameters: { depthWriteEnabled: false },

            // v--- Add in filtering ---v
            extensions: [new DataFilterExtension({ filterSize: 1 })],
            getFilterValue: (d) => d.properties.duration,
            filterRange: toSeconds(state.range)
        }),
        buildings.clone({ pickable: false, visible: true }),
    ];
    deck.setProps({ layers });
}

// Fetch map with given id, then create deck and basemap
const cartoMapId = '7fe0992f-ee41-4d6d-9dd2-8038d53368b4';
export async function initialize() {
    const { basemap, initialViewState, layers } = await fetchMap({ cartoMapId });

    deck = new Deck({
        canvas: 'deck-canvas', controller: true, initialViewState,
        getTooltip: getStationTooltip // <-- Add tooltip
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