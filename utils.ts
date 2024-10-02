export function createStore<T extends {}>(state: T, onChange: Function) {
  return new Proxy(state, {
    set(obj, prop, value) {
      obj[prop] = value;
      onChange();
      return true;
    },
  });
}

export function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function toSeconds(minutes) {
  return 60 * minutes;
}