export function createStore<T extends {}>(state: T, onChange: Function) {
  return new Proxy(state, {
    set(obj, prop, value) {
      obj[prop] = value;
      onChange();
      return true;
    },
  });
}
