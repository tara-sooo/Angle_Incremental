const DOUBLE_ACTIVATION_WINDOW_MS = 450;
const POINTER_CLICK_SUPPRESSION_WINDOW_MS = 1000;

function bindDoubleActivation(element, { id, onActivate, onDoubleActivate } = {}) {
  if (!element || typeof onActivate !== "function" || typeof onDoubleActivate !== "function") {
    return () => {};
  }

  let lastActivationAt = -Infinity;
  const pointerActivationTimes = [];

  function prunePointerActivationTimes(timestamp) {
    while (
      pointerActivationTimes.length > 0
      && timestamp - pointerActivationTimes[0] > POINTER_CLICK_SUPPRESSION_WINDOW_MS
    ) {
      pointerActivationTimes.shift();
    }
  }

  function activate(timestamp) {
    const isDouble = lastActivationAt !== -Infinity
      && timestamp >= lastActivationAt
      && timestamp - lastActivationAt <= DOUBLE_ACTIVATION_WINDOW_MS;
    onActivate(id);
    if (!isDouble) {
      lastActivationAt = timestamp;
      return;
    }
    lastActivationAt = -Infinity;
    onDoubleActivate(id);
  }

  function handlePointerUp(event) {
    if (
      (event.pointerType === "mouse" || event.pointerType === "pen")
      && event.button !== 0
    ) return;
    const timestamp = Date.now();
    prunePointerActivationTimes(timestamp);
    pointerActivationTimes.push(timestamp);
    activate(timestamp);
  }

  function handleClick() {
    const timestamp = Date.now();
    prunePointerActivationTimes(timestamp);
    if (pointerActivationTimes.length > 0) {
      pointerActivationTimes.shift();
      return;
    }
    activate(timestamp);
  }

  element.addEventListener("pointerup", handlePointerUp);
  element.addEventListener("click", handleClick);
  return () => {
    element.removeEventListener("pointerup", handlePointerUp);
    element.removeEventListener("click", handleClick);
  };
}

export { bindDoubleActivation };
