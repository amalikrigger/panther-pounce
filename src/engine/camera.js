// The camera: decides which part of the world is on screen and how big it is.
//
// The world uses units with y pointing UP. The screen uses CSS pixels with y
// pointing DOWN. The camera converts between them.
//
// Instead of a fixed view, we tell the camera "make sure this rectangle of the
// world is visible" (the slingshot plus the whole structure). It picks the
// biggest zoom that fits, on any screen shape, and glides there smoothly.

export class Camera {
  constructor() {
    this.x = 0; // world point at the center of the screen
    this.y = 0;
    this.zoom = 20; // CSS pixels per world unit
    this.target = { x: 0, y: 0, zoom: 20 };
    this.screenWidth = 1;
    this.screenHeight = 1;
    this.pixelRatio = 1;
    // Space (CSS px) kept clear for the score bar at the top and the edges.
    this.padding = { top: 70, side: 16, bottom: 8 };
    this.shakeAmount = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  setScreen(width, height, pixelRatio) {
    this.screenWidth = width;
    this.screenHeight = height;
    this.pixelRatio = pixelRatio;
    // Small screens can't spare as much room for the score bar.
    this.padding.top = Math.min(70, height * 0.14);
  }

  /** Aim the camera so the world rectangle {left, right, bottom, top} fits on screen. */
  frame(rect, { instant = false } = {}) {
    const { top, side, bottom } = this.padding;
    const usableWidth = Math.max(1, this.screenWidth - side * 2);
    const usableHeight = Math.max(1, this.screenHeight - top - bottom);
    const zoom = Math.min(usableWidth / (rect.right - rect.left), usableHeight / (rect.top - rect.bottom));

    // Keep the ground at the bottom of the screen; any spare height becomes
    // sky above. Any spare width is shared equally left and right.
    this.target.zoom = zoom;
    this.target.x = (rect.left + rect.right) / 2;
    this.target.y = rect.bottom + (this.screenHeight / 2 - bottom) / zoom;
    if (instant) Object.assign(this, { x: this.target.x, y: this.target.y, zoom: this.target.zoom });
  }

  update(dt) {
    // Glide a fixed fraction of the remaining distance each second, which
    // feels smooth at any frame rate.
    const t = 1 - Math.exp(-dt * 4);
    this.x += (this.target.x - this.x) * t;
    this.y += (this.target.y - this.y) * t;
    this.zoom += (this.target.zoom - this.zoom) * t;

    this.shakeAmount *= Math.exp(-dt * 9);
    this.shakeX = (Math.random() * 2 - 1) * this.shakeAmount;
    this.shakeY = (Math.random() * 2 - 1) * this.shakeAmount;
  }

  /** Shake the screen. `amount` is in CSS pixels. */
  shake(amount) {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
  }

  /** Set the canvas transform so drawing commands use world units, y up. */
  applyTransform(ctx) {
    const s = this.zoom * this.pixelRatio;
    const offsetX = (this.screenWidth / 2 - this.x * this.zoom + this.shakeX) * this.pixelRatio;
    const offsetY = (this.screenHeight / 2 + this.y * this.zoom + this.shakeY) * this.pixelRatio;
    ctx.setTransform(s, 0, 0, -s, offsetX, offsetY);
  }

  /** Convert a CSS-pixel point on the canvas to world units. */
  toWorld(screenX, screenY) {
    return {
      x: (screenX - this.screenWidth / 2) / this.zoom + this.x,
      y: (this.screenHeight / 2 - screenY) / this.zoom + this.y,
    };
  }

  /** The world rectangle currently on screen. */
  visibleRect() {
    const halfWidth = this.screenWidth / 2 / this.zoom;
    const halfHeight = this.screenHeight / 2 / this.zoom;
    return { left: this.x - halfWidth, right: this.x + halfWidth, bottom: this.y - halfHeight, top: this.y + halfHeight };
  }
}
