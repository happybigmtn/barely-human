/**
 * Animated Art Generator for real-time crack evolution visualization
 * Shows the live growth of cracks like the original color.html
 */

class AnimatedArtGenerator {
  constructor(seed, botId, seriesId, canvas) {
    this.seed = seed;
    this.botId = botId;
    this.seriesId = seriesId;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.rng = new SeededRandom(seed);
    
    // Get bot personality
    this.bot = window.BarelyHumanArt.BOT_PERSONALITIES[botId] || window.BarelyHumanArt.BOT_PERSONALITIES[0];
    this.theme = window.BarelyHumanArt.THEMES[this.bot.theme];
    this.formation = window.BarelyHumanArt.CRACK_FORMATIONS[this.bot.crackFormation];
    
    // Canvas scaling
    this.scale = canvas.width / 1000;
    
    // Generate traits and mountain
    this.traits = this.generateTraits();
    this.mountainProfile = this.generateMountainProfile();
    this.cracks = [];
    this.environment = this.generateEnvironment();
    
    // Animation state
    this.targetDensity = this.calculateTargetDensity();
    this.currentDensity = 0;
    this.mountainArea = this.calculateMountainArea();
    this.globalAge = 0;
    
    // Initialize canvas
    this.setupCanvas();
    this.generateInitialCracks();
  }
  
  setupCanvas() {
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw background gradient
    this.renderBackground();
    
    // Draw mountain silhouette
    this.renderMountain();
    
    // Draw environment features
    this.renderEnvironment();
  }
  
  generateTraits() {
    const traits = {};
    const RARITY_TRAITS = window.BarelyHumanArt.RARITY_TRAITS;
    
    for (const [category, options] of Object.entries(RARITY_TRAITS)) {
      const rand = this.rng.next();
      let cumulative = 0;
      
      for (const [trait, config] of Object.entries(options)) {
        cumulative += config.weight;
        if (rand <= cumulative) {
          traits[category] = trait;
          break;
        }
      }
    }
    
    traits.botPersonality = this.bot.name;
    traits.theme = this.bot.theme;
    traits.formation = this.bot.crackFormation;
    traits.series = this.seriesId;
    
    return traits;
  }
  
  calculateTargetDensity() {
    const densityConfig = window.BarelyHumanArt.RARITY_TRAITS.density[this.traits.density];
    return densityConfig.range[0] + this.rng.next() * (densityConfig.range[1] - densityConfig.range[0]);
  }
  
  generateMountainProfile() {
    const profile = [];
    const shapes = ["jagged", "twin", "sharp", "plateau", "cascade"];
    const shapeType = this.rng.choice(shapes);
    
    const aggression = this.bot.aggression;
    const centerX = 1000 * (0.3 + this.rng.next() * 0.4);
    const mountainWidth = 1000 * (0.5 + this.rng.next() * 0.4);
    const peakHeight = 1000 * (0.6 + this.rng.next() * 0.3) * (0.8 + aggression * 0.4);
    
    for (let x = 0; x < 1000; x++) {
      const t = (x - centerX + mountainWidth / 2) / mountainWidth;
      let height = 0;
      
      if (t >= 0 && t <= 1) {
        switch (shapeType) {
          case "jagged":
            height = Math.sin(t * Math.PI) * peakHeight;
            height += Math.sin(t * 20) * peakHeight * 0.15 * aggression;
            height += Math.sin(t * 50) * peakHeight * 0.08 * aggression;
            break;
          case "twin":
            const peak1 = Math.exp(-Math.pow((t - 0.3) * 5, 2)) * peakHeight;
            const peak2 = Math.exp(-Math.pow((t - 0.7) * 5, 2)) * peakHeight * 0.8;
            height = Math.max(peak1, peak2);
            break;
          case "sharp":
            height = t < 0.5 ? t * 2 * peakHeight : (1 - t) * 2 * peakHeight;
            break;
          case "plateau":
            if (t < 0.2) height = t * 5 * peakHeight;
            else if (t > 0.8) height = (1 - t) * 5 * peakHeight;
            else height = peakHeight * 0.9;
            break;
          case "cascade":
            for (let i = 0; i < 4; i++) {
              const peakT = (i + 1) / 5;
              const peakH = peakHeight * (1 - i * 0.2);
              height = Math.max(height, Math.exp(-Math.pow((t - peakT) * 8, 2)) * peakH);
            }
            break;
        }
        
        if (aggression > 0.5) {
          height += Math.sin(t * 100) * peakHeight * 0.06 * aggression;
        }
      }
      
      profile[x] = 1000 * 0.95 - height;
    }
    
    return profile;
  }
  
  generateEnvironment() {
    const features = [];
    const specialTrait = this.traits.specialFeatures;
    
    if (specialTrait !== "None") {
      const featureCount = specialTrait === "Legendary" ? 3 : specialTrait === "Mystical" ? 2 : 1;
      
      for (let i = 0; i < featureCount; i++) {
        const feature = this.generateEnvironmentalFeature();
        if (feature) features.push(feature);
      }
    }
    
    return features;
  }
  
  generateEnvironmentalFeature() {
    const theme = this.bot.theme;
    const x = this.rng.next() * 1000;
    const y = this.rng.next() * 600;
    
    const possibleFeatures = [];
    if (["dawn", "volcanic"].includes(theme)) possibleFeatures.push("sun");
    if (["void", "mist", "storm"].includes(theme)) possibleFeatures.push("moon");
    if (["dawn", "mist", "zen"].includes(theme)) possibleFeatures.push("birds");
    if (["void", "storm", "aurora"].includes(theme)) possibleFeatures.push("stars");
    
    if (possibleFeatures.length === 0) return null;
    
    return {
      type: this.rng.choice(possibleFeatures),
      x: x,
      y: y,
      size: 20 + this.rng.next() * 30,
      intensity: 0.5 + this.rng.next() * 0.5,
      color: this.rng.choice(this.bot.palette)
    };
  }
  
  renderBackground() {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    const bgColors = this.theme.background;
    
    gradient.addColorStop(0, bgColors[0]);
    gradient.addColorStop(0.5, bgColors[1]);
    gradient.addColorStop(1, bgColors[2]);
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
  
  renderMountain() {
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.mountainProfile[0] * this.scale);
    
    for (let x = 1; x < 1000; x++) {
      this.ctx.lineTo(x * this.scale, this.mountainProfile[x] * this.scale);
    }
    
    this.ctx.lineTo(this.canvas.width, this.canvas.height);
    this.ctx.lineTo(0, this.canvas.height);
    this.ctx.closePath();
    
    const mountainColor = this.theme.mountain[Math.floor(this.theme.mountain.length / 2)];
    this.ctx.fillStyle = mountainColor + '20'; // Add transparency
    this.ctx.fill();
  }
  
  renderEnvironment() {
    for (const feature of this.environment) {
      this.ctx.save();
      this.ctx.globalAlpha = feature.intensity * 0.8;
      
      switch (feature.type) {
        case "sun":
          // Sun glow
          const sunGradient = this.ctx.createRadialGradient(
            feature.x * this.scale, feature.y * this.scale, 0,
            feature.x * this.scale, feature.y * this.scale, feature.size * this.scale
          );
          sunGradient.addColorStop(0, '#FFD700');
          sunGradient.addColorStop(1, 'transparent');
          
          this.ctx.fillStyle = sunGradient;
          this.ctx.fillRect(
            (feature.x - feature.size) * this.scale,
            (feature.y - feature.size) * this.scale,
            feature.size * 2 * this.scale,
            feature.size * 2 * this.scale
          );
          break;
          
        case "moon":
          this.ctx.strokeStyle = '#FFFFFF';
          this.ctx.fillStyle = '#E6E6FA';
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.arc(
            feature.x * this.scale,
            feature.y * this.scale,
            feature.size * 0.4 * this.scale,
            0, Math.PI * 2
          );
          this.ctx.fill();
          this.ctx.stroke();
          break;
          
        case "stars":
          for (let i = 0; i < 5; i++) {
            const starX = (feature.x + (this.rng.next() - 0.5) * 100) * this.scale;
            const starY = (feature.y + (this.rng.next() - 0.5) * 100) * this.scale;
            const starSize = (1 + this.rng.next() * 2) * this.scale;
            
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.beginPath();
            this.ctx.arc(starX, starY, starSize, 0, Math.PI * 2);
            this.ctx.fill();
          }
          break;
      }
      
      this.ctx.restore();
    }
  }
  
  generateInitialCracks() {
    // Generate base cracks
    const baseSeeds = 8 + this.rng.nextInt(0, 6);
    for (let i = 0; i < baseSeeds; i++) {
      const x = 1000 * 0.05 + 1000 * 0.9 * (i / (baseSeeds - 1));
      const y = 1000 * 0.9;
      
      if (this.insideMountain(x, y)) {
        this.cracks.push({
          x: x,
          y: y,
          angle: -90 + (this.rng.next() - 0.5) * 60,
          type: "base",
          active: true,
          formation: this.bot.crackFormation,
          color: this.rng.choice(this.bot.palette),
          path: [{x, y}],
          age: 0,
          speed: 1.0 + this.rng.next() * 0.5,
          sandPoints: []
        });
      }
    }
    
    // Generate contour cracks
    for (let level = 0; level < 3; level++) {
      const contourSeeds = 6 + this.rng.nextInt(0, 4);
      for (let i = 0; i < contourSeeds; i++) {
        const x = 1000 * 0.15 + 1000 * 0.7 * (i / (contourSeeds - 1));
        const y = this.mountainProfile[Math.floor(x)] + 30 + level * 60;
        
        if (this.insideMountain(x, y)) {
          this.cracks.push({
            x: x,
            y: y,
            angle: this.rng.next() * 360,
            type: "contour",
            active: true,
            formation: this.bot.crackFormation,
            color: this.rng.choice(this.bot.palette),
            path: [{x, y}],
            age: 0,
            speed: 0.8 + this.rng.next() * 0.4,
            sandPoints: []
          });
        }
      }
    }
  }
  
  step() {
    this.globalAge++;
    
    // Update active cracks
    const activeCracks = this.cracks.filter(crack => crack.active);
    if (activeCracks.length === 0 && this.currentDensity < this.targetDensity) {
      this.addSeed();
      return;
    }
    
    // Process a batch of cracks each step
    const batchSize = Math.min(20, activeCracks.length);
    for (let i = 0; i < batchSize; i++) {
      const crack = activeCracks[i];
      if (this.rng.next() < 0.9) {
        this.growCrack(crack);
      }
    }
    
    // Calculate density periodically
    if (this.globalAge % 10 === 0) {
      const totalLength = this.cracks.reduce((sum, crack) => sum + crack.path.length, 0);
      this.currentDensity = totalLength / this.mountainArea;
    }
    
    // Add seeds if needed
    if (activeCracks.length < 15 && this.globalAge % 30 === 0 && this.rng.next() < 0.4) {
      this.addSeed();
    }
    
    // Clean up excessive cracks
    if (this.cracks.length > 1000) {
      this.cracks = this.cracks.filter(crack => crack.active || crack.path.length > 10);
    }
  }
  
  growCrack(crack) {
    const formation = window.BarelyHumanArt.CRACK_FORMATIONS[crack.formation];
    const oldX = crack.x;
    const oldY = crack.y;
    
    crack.age++;
    
    // Formation-specific behavior
    let wobble = 0;
    
    switch (crack.formation) {
      case "chaotic":
        wobble = Math.sin(crack.age * 0.1 * formation.wobbleFreq) * formation.wobbleAmp;
        crack.angle += (this.rng.next() - 0.5) * formation.angleVariation + wobble;
        crack.angle += Math.sin(crack.x * 0.005 + crack.y * 0.003) * formation.drift;
        break;
        
      case "curved":
        wobble = Math.sin(crack.age * 0.1 * formation.wobbleFreq) * formation.wobbleAmp;
        crack.angle += wobble * formation.curveAmount;
        break;
        
      case "circuit":
        if (crack.age % 20 === 0 && this.rng.next() < formation.turnProbability) {
          crack.angle = Math.round((crack.angle + (this.rng.next() < 0.5 ? 90 : -90)) / 90) * 90;
        }
        break;
        
      case "spiral":
        crack.angle += formation.spiralDirection * formation.spiralTightness * 180;
        wobble = Math.sin(crack.age * 0.05) * 2;
        break;
        
      case "crystalline":
        if (crack.age % formation.segmentLength === 0) {
          crack.angle = this.rng.choice(formation.angleOptions);
        }
        break;
        
      case "lightning":
        if (crack.age % (formation.segmentLength || 35) === 0) {
          crack.angle += (this.rng.next() < 0.5 ? 1 : -1) * formation.zigzagAngle + (this.rng.next() - 0.5) * 20;
        }
        break;
        
      case "organic":
        const growthWave = Math.sin(crack.age * 0.05) * formation.wobbleAmp;
        crack.angle += growthWave + Math.sin(crack.x * 0.01 + crack.y * 0.01) * 3;
        crack.speed = Math.max(0.2, crack.speed * formation.growthRate);
        break;
        
      case "branching":
        if (this.globalAge < 150) {
          wobble = Math.sin(crack.age * 0.1 * formation.wobbleFreq) * formation.wobbleAmp;
          crack.angle += wobble + Math.sin(crack.age * 0.1) * 2;
        }
        break;
        
      case "zen":
        crack.angle += (this.rng.next() - 0.5) * 5;
        const drift = Math.sin(crack.x * 0.005 + crack.y * 0.003) * 2;
        crack.angle += drift;
        break;
        
      default:
        crack.angle += (this.rng.next() - 0.5) * 5;
        break;
    }
    
    // Move crack
    const speed = crack.speed * (1 + this.bot.aggression * 0.5);
    crack.x += Math.cos(crack.angle * Math.PI / 180) * speed;
    crack.y += Math.sin(crack.angle * Math.PI / 180) * speed;
    
    // Check boundaries
    if (!this.insideMountain(crack.x, crack.y)) {
      crack.active = false;
      return;
    }
    
    // Add to path
    crack.path.push({x: crack.x, y: crack.y});
    
    // Add sand painting points
    this.addSandPainting(crack, oldX, oldY);
    
    // Branching
    if (crack.formation === "branching" && crack.age % 25 === 0 && this.rng.next() < 0.3) {
      this.createBranch(crack);
    } else if (crack.formation === "organic" && crack.age > 20 && this.rng.next() < 0.08) {
      this.createBranch(crack);
    }
  }
  
  addSandPainting(crack, oldX, oldY) {
    const numPoints = 2 + this.rng.nextInt(0, 3);
    for (let i = 0; i < numPoints; i++) {
      const offsetX = (this.rng.next() - 0.5) * 3;
      const offsetY = (this.rng.next() - 0.5) * 3;
      
      crack.sandPoints.push({
        x: crack.x + offsetX,
        y: crack.y + offsetY,
        intensity: 0.3 + this.rng.next() * 0.7,
        color: crack.color
      });
    }
    
    // Limit sand points
    if (crack.sandPoints.length > 50) {
      crack.sandPoints = crack.sandPoints.slice(-25);
    }
  }
  
  createBranch(parentCrack) {
    const branchAngle = parentCrack.angle + (this.rng.next() < 0.5 ? -35 : 35) + (this.rng.next() - 0.5) * 20;
    
    this.cracks.push({
      x: parentCrack.x,
      y: parentCrack.y,
      angle: branchAngle,
      type: "branch",
      active: true,
      formation: parentCrack.formation,
      color: this.rng.choice(this.bot.palette),
      path: [{x: parentCrack.x, y: parentCrack.y}],
      age: 0,
      speed: parentCrack.speed * (0.6 + this.rng.next() * 0.4),
      sandPoints: []
    });
  }
  
  addSeed() {
    const angle = this.rng.next() * Math.PI * 2;
    const radius = this.rng.next() * 0.3 + 0.2;
    const x = 1000 * 0.5 + Math.cos(angle) * 1000 * radius;
    const y = 1000 * 0.6 + Math.sin(angle) * 1000 * radius * 0.7;
    
    if (this.insideMountain(x, y)) {
      this.cracks.push({
        x: x,
        y: y,
        angle: this.rng.next() * 360,
        type: "spreader",
        active: true,
        formation: this.bot.crackFormation,
        color: this.rng.choice(this.bot.palette),
        path: [{x, y}],
        age: 0,
        speed: 1.0 + this.rng.next() * 0.5,
        sandPoints: []
      });
    }
  }
  
  insideMountain(x, y) {
    const ix = Math.floor(x);
    if (ix < 0 || ix >= 1000) return false;
    return y > this.mountainProfile[ix] && y < 1000 * 0.95;
  }
  
  calculateMountainArea() {
    let area = 0;
    for (let x = 0; x < 1000; x++) {
      const height = 1000 * 0.95 - this.mountainProfile[x];
      if (height > 0) area += height;
    }
    return Math.max(area, 1000 * 50);
  }
  
  render() {
    // Clear previous cracks (keep background)
    this.renderBackground();
    this.renderMountain();
    this.renderEnvironment();
    
    // Render sand painting first
    this.renderSandPainting();
    
    // Render crack paths
    this.renderCracks();
  }
  
  renderSandPainting() {
    for (const crack of this.cracks) {
      for (const point of crack.sandPoints) {
        this.ctx.save();
        this.ctx.globalAlpha = point.intensity * 0.4;
        this.ctx.fillStyle = point.color;
        
        const size = (0.5 + Math.random() * 1.5) * this.scale;
        this.ctx.beginPath();
        this.ctx.arc(point.x * this.scale, point.y * this.scale, size, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
      }
    }
  }
  
  renderCracks() {
    for (const crack of this.cracks) {
      if (crack.path.length < 2) continue;
      
      // Formation-specific styling
      let strokeWidth = 0.5;
      let opacity = 0.8;
      let glow = false;
      
      switch (crack.formation) {
        case "neon":
        case "cyber":
          strokeWidth = 1;
          opacity = 0.9;
          glow = true;
          break;
        case "volcanic":
          strokeWidth = 0.8;
          opacity = 0.9;
          glow = true;
          break;
        case "circuit":
          strokeWidth = 0.3;
          opacity = 0.7;
          break;
        case "zen":
          strokeWidth = 0.4;
          opacity = 0.6;
          break;
        case "lightning":
          strokeWidth = 1.2;
          opacity = 0.9;
          glow = true;
          break;
      }
      
      this.ctx.save();
      this.ctx.globalAlpha = opacity;
      this.ctx.strokeStyle = crack.color;
      this.ctx.lineWidth = strokeWidth * this.scale;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      
      // Add glow effect for certain formations
      if (glow) {
        this.ctx.shadowBlur = 3 * this.scale;
        this.ctx.shadowColor = crack.color;
      }
      
      // Draw crack path
      this.ctx.beginPath();
      this.ctx.moveTo(crack.path[0].x * this.scale, crack.path[0].y * this.scale);
      
      for (let i = 1; i < crack.path.length; i++) {
        this.ctx.lineTo(crack.path[i].x * this.scale, crack.path[i].y * this.scale);
      }
      
      this.ctx.stroke();
      this.ctx.restore();
    }
  }
  
  // Status methods
  getActiveCrackCount() {
    return this.cracks.filter(crack => crack.active).length;
  }
  
  getTotalCrackCount() {
    return this.cracks.length;
  }
  
  getDensity() {
    return this.currentDensity;
  }
  
  generateSVG() {
    // Generate final SVG version
    const generator = new window.BarelyHumanArt.BarelyHumanArtGenerator(this.seed, this.botId, this.seriesId);
    return generator.generateSVG();
  }
}