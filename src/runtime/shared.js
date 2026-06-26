export const runtime = Object.create(null);

export function expose(name, getter, setter) {
  Object.defineProperty(runtime, name, {
    configurable: true,
    enumerable: true,
    get: getter,
    set: setter,
  });
}
