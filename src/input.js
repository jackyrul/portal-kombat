// Keyboard input, layout-independent (KeyboardEvent.code).
// Exposes per-player virtual pads with held keys and edge-triggered presses.

const P1_MAP = {
  KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
  KeyU: 'lp', KeyI: 'hp', KeyJ: 'lk', KeyK: 'hk', KeyO: 'sp1', KeyL: 'sp2',
};

const P2_MAP = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  Numpad1: 'lp', Numpad2: 'hp', Numpad4: 'lk', Numpad5: 'hk', Numpad3: 'sp1', Numpad6: 'sp2',
};

const BUTTONS = ['left', 'right', 'up', 'down', 'lp', 'hp', 'lk', 'hk', 'sp1', 'sp2'];

class Pad {
  constructor() {
    this.held = {};
    this.pressed = {};   // set on keydown, consumed once per frame by endFrame()
    for (const b of BUTTONS) { this.held[b] = false; this.pressed[b] = false; }
  }
  down(btn) {
    if (!this.held[btn]) this.pressed[btn] = true;
    this.held[btn] = true;
  }
  up(btn) { this.held[btn] = false; }
  endFrame() { for (const b of BUTTONS) this.pressed[b] = false; }
  clear() { for (const b of BUTTONS) { this.held[b] = false; this.pressed[b] = false; } }
}

export class Input {
  constructor() {
    this.pads = [new Pad(), new Pad()];
    this.anyKey = null; // callback for menus

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (this.anyKey) this.anyKey(e.code);
      const b1 = P1_MAP[e.code]; if (b1) { this.pads[0].down(b1); e.preventDefault(); }
      const b2 = P2_MAP[e.code]; if (b2) { this.pads[1].down(b2); e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => {
      const b1 = P1_MAP[e.code]; if (b1) this.pads[0].up(b1);
      const b2 = P2_MAP[e.code]; if (b2) this.pads[1].up(b2);
    });
    window.addEventListener('blur', () => { this.pads[0].clear(); this.pads[1].clear(); });
  }
  endFrame() { this.pads[0].endFrame(); this.pads[1].endFrame(); }
}

// A neutral pad the AI writes into every frame.
export class VirtualPad extends Pad {
  press(btn) { this.pressed[btn] = true; }
  neutral() { for (const b of BUTTONS) this.held[b] = false; }
}
