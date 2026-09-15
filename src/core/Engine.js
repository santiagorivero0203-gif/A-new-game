export class Engine {
  constructor(update, render) {
    this.update = update;
    this.render = render;
    
    this.lastTime = 0;
    this.deltaTime = 0;
    this.isRunning = false;
    
    // Max deltaTime to prevent spiraling (e.g. if tab is inactive)
    this.maxDelta = 0.1; 
  }

  start() {
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  stop() {
    this.isRunning = false;
  }

  loop(currentTime) {
    if (!this.isRunning) return;

    let dt = (currentTime - this.lastTime) / 1000;
    if (dt > this.maxDelta) {
      dt = this.maxDelta;
    }
    this.deltaTime = dt;
    this.lastTime = currentTime;

    // Orchestrate
    this.update(this.deltaTime);
    this.render();

    requestAnimationFrame(this.loop.bind(this));
  }
}
