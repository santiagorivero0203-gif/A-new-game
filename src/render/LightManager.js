export class LightManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ambientLight = 'rgba(0, 0, 0, 0.8)'; // Dark layer
    this.lights = []; // { x, y, radius, intensity, color, flicker }
  }

  addLight(light) {
    this.lights.push(light);
  }

  update(deltaTime) {
    // Update flickers
    this.lights.forEach(light => {
      if (light.flicker) {
        light.currentRadius = light.radius + Math.random() * 10 - 5;
      } else {
        light.currentRadius = light.radius;
      }
    });
  }

  render(camera) {
    const { ctx, canvas } = this;
    
    // Clear previous frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw global darkness
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = this.ambientLight;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    camera.applyTransform(ctx);

    // Render lights (cutout the darkness)
    ctx.globalCompositeOperation = 'destination-out';

    this.lights.forEach(light => {
      const gradient = ctx.createRadialGradient(
        light.x, light.y, 0,
        light.x, light.y, light.currentRadius
      );
      
      // The inner part removes the darkness completely
      gradient.addColorStop(0, `rgba(255, 255, 255, ${light.intensity})`);
      // The outer part fades out smoothly
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(light.x, light.y, light.currentRadius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Optionally overlay colors if needed (using 'lighter' or custom composite)
    ctx.globalCompositeOperation = 'source-over';
    // Color overlay loop could go here for coloured lights

    camera.restoreTransform(ctx);
  }
}
