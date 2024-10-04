import { NumberArray2, NumberArray3, NumberArray4 } from "@math.gl/types";

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

export function toSeconds<T extends number | NumberArray2 | NumberArray3 | NumberArray4>(minutes: T) : T {
  if (typeof minutes === 'number') {
    return minutes * 60 as T;
  }

  return minutes.map(n => 60 *n) as T;
}