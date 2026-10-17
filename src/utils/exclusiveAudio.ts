// One sound at a time: when any registered audio starts playing, every other one pauses
const registered = new Set<HTMLMediaElement>();

export function exclusive<T extends HTMLMediaElement>(el: T): T {
  if (registered.has(el)) return el;
  registered.add(el);
  el.addEventListener("play", () => {
    for (const other of registered) if (other !== el && !other.paused) other.pause();
  });
  return el;
}

export function release(el: HTMLMediaElement | null) {
  if (el) registered.delete(el);
}
