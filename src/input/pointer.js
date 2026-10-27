// Drag input using Pointer Events, so a mouse, a finger and a pen all work
// the same way.
//
// We only follow ONE pointer at a time (the first finger down). A second
// finger touching the screen is ignored instead of making the aim jump.
// Positions are reported in CSS pixels relative to the canvas.

export class PointerInput {
  constructor(canvas, { onStart, onMove, onEnd }) {
    this.canvas = canvas;
    this.activeId = null;

    const position = (event) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    canvas.addEventListener('pointerdown', (event) => {
      if (this.activeId !== null || event.button > 0) return;
      this.activeId = event.pointerId;
      // Keep getting move/up events even if the finger slides off the canvas.
      canvas.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      onStart(position(event));
    });

    canvas.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.activeId) return;
      event.preventDefault();
      onMove(position(event));
    });

    const finish = (cancelled) => (event) => {
      if (event.pointerId !== this.activeId) return;
      this.activeId = null;
      onEnd(position(event), cancelled);
    };
    canvas.addEventListener('pointerup', finish(false));
    canvas.addEventListener('pointercancel', finish(true));

    // No right-click menu or long-press menu on the game.
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  /** Forget the current drag (for example when the game is paused mid-aim). */
  reset() {
    this.activeId = null;
  }
}
