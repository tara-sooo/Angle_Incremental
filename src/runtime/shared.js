export const runtime = Object.create(null);

export function expose(name, getter, setter) {
  const resolvedGetter = name === "ACHIEVEMENT_COUNT"
    ? () => runtime.ACHIEVEMENTS?.length || getter()
    : getter;
  Object.defineProperty(runtime, name, {
    configurable: true,
    enumerable: true,
    get: resolvedGetter,
    set: setter,
  });
}
