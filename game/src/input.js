// Keyboard and mouse input. Arrows / WASD fly the plane, Shift throttles up,
// Ctrl (or S) throttles down, Space is the airbrake, P pauses, R restarts,
// M mutes, Enter starts. The mouse steers too: hold the left button and the
// plane banks toward the cursor; clicks also press on-screen buttons.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.key.toLowerCase());
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - r.left) / r.width) * 1280;
      this.mouseY = ((e.clientY - r.top) / r.height) * 720;
    });
    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      this.mouseClicked = true;
      const r = canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - r.left) / r.width) * 1280;
      this.mouseY = ((e.clientY - r.top) / r.height) * 720;
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // True only on the frame the key went down.
  wasPressed(key) {
    return this.pressed.has(key.toLowerCase());
  }

  held(...keys) {
    return keys.some((k) => this.keys.has(k.toLowerCase()));
  }

  // -1..1 roll input: keyboard arrows/A-D, or mouse steering while held.
  rollInput() {
    let roll = 0;
    if (this.held('arrowleft', 'a')) roll -= 1;
    if (this.held('arrowright', 'd')) roll += 1;
    if (this.mouseDown) {
      roll += Math.max(-1, Math.min(1, (this.mouseX - 640) / 320));
    }
    return Math.max(-1, Math.min(1, roll));
  }

  // -1..1 pitch input: up climbs, down descends (arrow keys or W/S).
  pitchInput() {
    let pitch = 0;
    if (this.held('arrowup', 'w')) pitch += 1;
    if (this.held('arrowdown', 's')) pitch -= 1;
    if (this.mouseDown) {
      pitch += Math.max(-1, Math.min(1, (360 - this.mouseY) / 200));
    }
    return Math.max(-1, Math.min(1, pitch));
  }

  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
  }
}
