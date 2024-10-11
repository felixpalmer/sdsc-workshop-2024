export function createUI(state: { brushingRadius?: number, range?: [number, number] }) {
  document.getElementById('story-card')!.style.display = 'block';

  const minSlider = document.querySelector<HTMLSelectElement>(
    '#min-duration-slider'
  )!;
  const maxSlider = document.querySelector<HTMLSelectElement>(
    '#max-duration-slider'
  )!;
  const minLabel = document.querySelector('#duration-label')!;

  const populationLabel = document.getElementById('slider-value');
  function onSliderInput() {
    let minValue = Number(minSlider.value);
    let maxValue = Number(maxSlider.value);
    minValue = Math.min(minValue, maxValue);
    minSlider.value = `${minValue}`;
    state.range = [minValue, maxValue];
    minLabel!.textContent = `${minValue} - ${maxValue} minutes`;
  }
  minSlider?.addEventListener('input', onSliderInput, false);
  maxSlider?.addEventListener('input', onSliderInput, false);


  const brushingSlider = document.querySelector<HTMLSelectElement>(
    '#brushing-radius-slider'
  )!;
  const brushingLabel = document.querySelector('#brushing-radius-label')!;

  function onBrushingInput() {
    const brushingRadius = Number(brushingSlider.value);
    state.brushingRadius = brushingRadius;
    if (brushingRadius) {
      brushingLabel!.textContent = `${brushingRadius} miles`;
    } else {
      brushingLabel!.textContent = 'Disabled';
    }
  }
  brushingSlider?.addEventListener('input', onBrushingInput, false);
}
const tooltipStyle = {
  left: '10px',
  top: '10px',
  background: '#fdfdfe',
  boxShadow: '4px 4px 8px #30303099',
  borderRadius: '4px',
  color: '#000'
}

export function getStationTooltip(info: any) {
  if (!info?.object) return null;
  const { start_station_id, ...rest } = info.object.properties;
  let html = start_station_id ? `<h3>Station: ${start_station_id}</h3>` : '';
  for (const [name, value] of Object.entries(rest)) {
    html += `<strong>${name.replace('_', ' ')}</strong>: ${value}<br/>`;
  }
  return { html, style: tooltipStyle }
}