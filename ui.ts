export function createUI(state: { range: [number, number] }) {
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
}
