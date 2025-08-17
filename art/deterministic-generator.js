/**
 * Barely Human - Deterministic Generative Art System
 * Based on the color.html substrate prototype with bot-specific personality styling
 * 
 * This system generates deterministic SVG art from VRF seeds, with each bot having
 * unique visual styles that reflect their gambling personalities.
 */

class SeededRandom {
  constructor(seed) {
    this.seed = seed;
    this.current = seed;
  }
  
  next() {
    const x = Math.sin(this.current++) * 10000;
    return x - Math.floor(x);
  }
  
  nextFloat(min = 0, max = 1) {
    return min + this.next() * (max - min);
  }
  
  nextInt(min, max) {
    return Math.floor(this.nextFloat(min, max));
  }
  
  choice(array) {
    return array[this.nextInt(0, array.length)];
  }
}

/**
 * Bot personality configurations with unique art styles
 */
const BOT_PERSONALITIES = {
  0: { // Alice "All-In"
    name: "Alice All-In",
    theme: "volcanic",
    crackFormation: "chaotic", 
    palette: ["#FF4500", "#FF6347", "#FF7F50", "#DC143C"],
    density: 0.95,
    aggression: 0.9,
    traits: {
      riskTaking: "extreme",
      energy: "explosive", 
      pattern: "aggressive",
      volatility: "maximum"
    }
  },
  1: { // Bob "Calculator" 
    name: "Bob Calculator",
    theme: "klein",
    crackFormation: "circuit",
    palette: ["#0047AB", "#4169E1", "#6495ED", "#87CEEB"],
    density: 0.88,
    aggression: 0.2,
    traits: {
      precision: "mathematical",
      structure: "geometric",
      pattern: "systematic", 
      logic: "pure"
    }
  },
  2: { // Charlie "Lucky"
    name: "Charlie Lucky",
    theme: "aurora",
    crackFormation: "spiral",
    palette: ["#20B2AA", "#00CED1", "#40E0D0", "#AFEEEE"],
    density: 0.75,
    aggression: 0.6,
    traits: {
      mysticism: "high",
      flow: "organic",
      pattern: "mystical",
      intuition: "supernatural"
    }
  },
  3: { // Diana "Ice Queen"
    name: "Diana Ice Queen", 
    theme: "mist",
    crackFormation: "crystalline",
    palette: ["#B0C4DE", "#E6E6FA", "#F0F8FF", "#F5F5F5"],
    density: 0.82,
    aggression: 0.3,
    traits: {
      coldness: "absolute",
      precision: "crystal",
      pattern: "geometric",
      emotion: "none"
    }
  },
  4: { // Eddie "Entertainer"
    name: "Eddie Entertainer",
    theme: "neon", 
    crackFormation: "kaleidoscope",
    palette: ["#FF1493", "#00FFFF", "#FF69B4", "#FFD700"],
    density: 0.92,
    aggression: 0.8,
    traits: {
      showmanship: "maximum",
      vibrancy: "electric",
      pattern: "theatrical",
      energy: "performer"
    }
  },
  5: { // Fiona "Fearless"
    name: "Fiona Fearless",
    theme: "storm", 
    crackFormation: "lightning",
    palette: ["#2F4F4F", "#708090", "#B0C4DE", "#FFFFFF"],
    density: 0.91,
    aggression: 0.85,
    traits: {
      courage: "unlimited",
      power: "lightning",
      pattern: "dynamic",
      fear: "none"
    }
  },
  6: { // Greg "Grinder"
    name: "Greg Grinder",
    theme: "zen",
    crackFormation: "zen", 
    palette: ["#DEB887", "#D2B48C", "#BC9A6A", "#8B7355"],
    density: 0.78,
    aggression: 0.4,
    traits: {
      patience: "infinite",
      persistence: "mechanical",
      pattern: "meditative",
      consistency: "unwavering"
    }
  },
  7: { // Helen "Hot Streak"
    name: "Helen Hot Streak",
    theme: "dawn",
    crackFormation: "curved",
    palette: ["#FF6B35", "#F7931E", "#FFD23F", "#FFF1D0"],
    density: 0.87,
    aggression: 0.7,
    traits: {
      momentum: "unstoppable",
      heat: "rising",
      pattern: "flowing",
      streaks: "legendary"
    }
  },
  8: { // Ivan "Intimidator"
    name: "Ivan Intimidator",
    theme: "void",
    crackFormation: "branching",
    palette: ["#1A1A1A", "#4A4A4A", "#696969", "#A9A9A9"],
    density: 0.89,
    aggression: 0.95,
    traits: {
      darkness: "consuming",
      intimidation: "psychological", 
      pattern: "menacing",
      presence: "overwhelming"
    }
  },
  9: { // Julia "Jinx"
    name: "Julia Jinx",
    theme: "cyber",
    crackFormation: "organic",
    palette: ["#FF00FF", "#00FF00", "#FFFF00", "#FF4500"],
    density: 0.93,
    aggression: 0.75,
    traits: {
      chaos: "controlled",
      unpredictability: "calculated",
      pattern: "chaotic",
      luck: "manipulated"
    }
  }
};

/**
 * Enhanced crack formations with personality-specific parameters
 */
const CRACK_FORMATIONS = {
  straight: {
    wobbleFreq: 0,
    wobbleAmp: 0,
    drift: 0,
    angleVariation: 2,
    description: "Clean mathematical lines"
  },
  curved: {
    wobbleFreq: 0.3,
    wobbleAmp: 5,
    drift: 0.2,
    angleVariation: 3,
    curveAmount: 0.5,
    description: "Flowing momentum curves"
  },
  chaotic: {
    wobbleFreq: 3.5,
    wobbleAmp: 8,
    drift: 1.5,
    angleVariation: 15,
    description: "Explosive unpredictable movement"
  },
  branching: {
    wobbleFreq: 0.5,
    wobbleAmp: 3,
    branchInterval: 25,
    branchAngle: 35,
    branchDecay: 0.75,
    description: "Intimidating fractal growth"
  },
  spiral: {
    spiralTightness: 0.035,
    spiralDirection: 1,
    spiralExpansion: 0.7,
    description: "Mystical expanding spirals"
  },
  crystalline: {
    angleOptions: [0, 30, 45, 60, 90, 120, 135, 150],
    segmentLength: 15,
    growthRate: 0.94,
    facetProbability: 0.18,
    description: "Cold crystalline precision"
  },
  kaleidoscope: {
    symmetryFold: 6,
    rotationSpeed: 0.008,
    segmentLength: 18,
    description: "Theatrical kaleidoscope patterns"
  },
  zen: {
    ringSpacing: 25,
    waveAmplitude: 18,
    waveFrequency: 0.025,
    description: "Meditative ripple patterns"
  },
  lightning: {
    segmentLength: 35,
    branchProbability: 0.2,
    zigzagAngle: 50,
    description: "Fearless lightning bolts"
  },
  organic: {
    wobbleFreq: 1.0,
    wobbleAmp: 10,
    growthRate: 0.97,
    branchProbability: 0.12,
    description: "Chaotic organic growth"
  },
  circuit: {
    gridSize: 12,
    turnProbability: 0.06,
    branchProbability: 0.45,
    description: "Systematic circuit patterns"
  }
};

/**
 * Theme configurations matching bot personalities
 */
const THEMES = {
  volcanic: {
    background: ['#1A0000', '#330000', '#660000'],
    mountain: ['#FF4500', '#FF6347', '#FF7F50'],
    atmosphere: 'rgba(255, 69, 0, 0.1)',
    special: 'lavaFlow'
  },
  klein: {
    background: ['#002FA7', '#0047AB', '#1E3A8A'],
    mountain: ['#4169E1', '#6495ED', '#87CEEB'],
    atmosphere: 'rgba(0, 47, 167, 0.1)',
    special: 'kleinGlow'
  },
  aurora: {
    background: ['#001122', '#002244', '#003366'],
    mountain: ['#134E4A', '#14B8A6', '#5EEAD4'],
    atmosphere: 'rgba(20, 184, 166, 0.05)',
    special: 'northernLights'
  },
  mist: {
    background: ['#E8E8E8', '#D3D3D3', '#A8A8A8'],
    mountain: ['#404040', '#505050', '#606060'],
    atmosphere: 'rgba(255, 255, 255, 0.3)',
    special: 'fogLayers'
  },
  neon: {
    background: ['#0A0A0A', '#1A0F1A', '#2A1F2A'],
    mountain: ['#FF1493', '#00FFFF', '#FF69B4'],
    atmosphere: 'rgba(255, 20, 147, 0.05)',
    special: 'neonPulse'
  },
  storm: {
    background: ['#0C0C0C', '#1C1C1C', '#3C3C3C'],
    mountain: ['#2C2C2C', '#4C4C4C', '#6C6C6C'],
    atmosphere: 'rgba(200, 200, 255, 0.05)',
    special: 'lightning'
  },
  zen: {
    background: ['#F5F5DC', '#D2B48C', '#DEB887'],
    mountain: ['#8B7355', '#A0826D', '#BC9A6A'],
    atmosphere: 'rgba(255, 248, 220, 0.1)',
    special: 'enso'
  },
  dawn: {
    background: ['#2D1B3D', '#E94560', '#F39C6B'],
    mountain: ['#1A0B2E', '#3D1E4E', '#693668'],
    atmosphere: 'rgba(255, 200, 150, 0.03)',
    special: 'warmGlow'
  },
  void: {
    background: ['#000000', '#0A0A0A', '#1A1A1A'],
    mountain: ['#FFFFFF', '#E0E0E0', '#C0C0C0'],
    atmosphere: 'rgba(255, 255, 255, 0.02)',
    special: 'voidParticles'
  },
  cyber: {
    background: ['#0A0014', '#14001F', '#1F0029'],
    mountain: ['#00FFFF', '#FF00FF', '#FFFF00'],
    atmosphere: 'rgba(0, 255, 255, 0.03)',
    special: 'dataStream'
  }
};

/**
 * NFT rarity traits and weights
 */
const RARITY_TRAITS = {
  density: {
    "Sparse": { weight: 0.4, range: [0.6, 0.75] },
    "Moderate": { weight: 0.35, range: [0.75, 0.85] },
    "Dense": { weight: 0.2, range: [0.85, 0.95] }, 
    "Maximum": { weight: 0.05, range: [0.95, 0.99] }
  },
  complexity: {
    "Simple": { weight: 0.3, crackCount: [50, 200] },
    "Moderate": { weight: 0.4, crackCount: [200, 500] },
    "Complex": { weight: 0.25, crackCount: [500, 1000] },
    "Legendary": { weight: 0.05, crackCount: [1000, 2000] }
  },
  specialFeatures: {
    "None": { weight: 0.6, features: [] },
    "Environmental": { weight: 0.25, features: ["sun", "moon", "birds"] },
    "Mystical": { weight: 0.1, features: ["aurora", "stars", "mystical"] },
    "Legendary": { weight: 0.05, features: ["rocket", "aurora", "multiple"] }
  },
  colorVariation: {
    "Monochrome": { weight: 0.3, variation: 0.1 },
    "Subtle": { weight: 0.4, variation: 0.3 },
    "Vibrant": { weight: 0.25, variation: 0.6 },
    "Rainbow": { weight: 0.05, variation: 1.0 }
  }
};

/**
 * Main deterministic art generator class
 */
class BarelyHumanArtGenerator {
  constructor(seed, botId, seriesId) {
    this.seed = seed;
    this.botId = botId;
    this.seriesId = seriesId;
    this.rng = new SeededRandom(seed);
    
    // Get bot personality
    this.bot = BOT_PERSONALITIES[botId] || BOT_PERSONALITIES[0];
    this.theme = THEMES[this.bot.theme];
    this.formation = CRACK_FORMATIONS[this.bot.crackFormation];
    
    // Canvas dimensions for consistent generation
    this.width = 1000;
    this.height = 1000;
    
    // Generated traits for rarity
    this.traits = this.generateTraits();
    
    // Mountain profile and cracks
    this.mountainProfile = this.generateMountainProfile();
    this.cracks = [];
    this.environment = this.generateEnvironment();
  }
  
  /**
   * Generate weighted traits for rarity system
   */
  generateTraits() {
    const traits = {};
    
    // Generate each trait category
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
    
    // Add bot-specific traits
    traits.botPersonality = this.bot.name;
    traits.theme = this.bot.theme;
    traits.formation = this.bot.crackFormation;
    
    // Add series information
    traits.series = this.seriesId;
    traits.generation = "Genesis";
    
    return traits;
  }
  
  /**
   * Generate mountain profile with bot personality influence
   */
  generateMountainProfile() {
    const profile = [];
    const shapes = ["jagged", "twin", "sharp", "plateau", "cascade"];
    const shapeType = this.rng.choice(shapes);
    
    // Personality affects mountain generation
    const aggression = this.bot.aggression;
    const centerX = this.width * (0.3 + this.rng.next() * 0.4);
    const mountainWidth = this.width * (0.5 + this.rng.next() * 0.4);
    const peakHeight = this.height * (0.6 + this.rng.next() * 0.3) * (0.8 + aggression * 0.4);
    
    for (let x = 0; x < this.width; x++) {
      const t = (x - centerX + mountainWidth / 2) / mountainWidth;
      let height = 0;
      
      if (t >= 0 && t <= 1) {
        // Generate height based on shape and personality
        switch (shapeType) {
          case "jagged":
            height = Math.sin(t * Math.PI) * peakHeight;
            height += Math.sin(t * 20) * peakHeight * 0.15 * aggression;
            height += Math.sin(t * 50) * peakHeight * 0.08 * aggression;
            height += Math.sin(t * 137) * peakHeight * 0.05 * aggression;
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
        
        // Add personality-specific jaggedness
        if (aggression > 0.5) {
          height += Math.sin(t * 100) * peakHeight * 0.06 * aggression;
          height += Math.sin(t * 200) * peakHeight * 0.04 * aggression;
        }
      }
      
      profile[x] = this.height * 0.95 - height;
    }
    
    return profile;
  }
  
  /**
   * Generate environmental features based on personality and rarity
   */
  generateEnvironment() {
    const features = [];
    const specialTrait = this.traits.specialFeatures;
    
    // Environmental features based on rarity
    if (specialTrait !== "None") {
      const featureCount = specialTrait === "Legendary" ? 3 + this.rng.nextInt(0, 3) : 
                          specialTrait === "Mystical" ? 2 + this.rng.nextInt(0, 2) : 1;
      
      for (let i = 0; i < featureCount; i++) {
        const feature = this.generateEnvironmentalFeature();
        if (feature) features.push(feature);
      }
    }
    
    return features;
  }
  
  /**
   * Generate individual environmental feature
   */
  generateEnvironmentalFeature() {
    const theme = this.bot.theme;
    const x = this.rng.next() * this.width;
    const y = this.rng.next() * this.height * 0.6;
    
    // Feature selection based on theme and personality
    const possibleFeatures = [];
    
    if (["dawn", "desert"].includes(theme)) possibleFeatures.push("sun");
    if (["dusk", "void", "mist"].includes(theme)) possibleFeatures.push("moon");
    if (["dawn", "dusk", "mist", "zen"].includes(theme)) possibleFeatures.push("birds");
    if (["dusk", "void", "storm", "aurora"].includes(theme)) possibleFeatures.push("stars");
    if (theme === "aurora") possibleFeatures.push("aurora");
    if (theme === "sakura") possibleFeatures.push("petals");
    if (["cyber", "neon"].includes(theme)) possibleFeatures.push("particles");
    if (["void", "volcanic"].includes(theme) && this.rng.next() < 0.1) possibleFeatures.push("rocket");
    
    if (possibleFeatures.length === 0) return null;
    
    const featureType = this.rng.choice(possibleFeatures);
    
    return {
      type: featureType,
      x: x,
      y: y,
      size: 20 + this.rng.next() * 30,
      intensity: 0.5 + this.rng.next() * 0.5,
      color: this.rng.choice(this.bot.palette)
    };
  }
  
  /**
   * Generate crack system based on personality formation
   */
  generateCracks() {
    this.cracks = [];
    const formation = this.bot.crackFormation;
    const targetDensity = RARITY_TRAITS.density[this.traits.density].range;
    const density = targetDensity[0] + this.rng.next() * (targetDensity[1] - targetDensity[0]);
    
    // Initial seed cracks based on formation
    this.generateSeedCracks(formation);
    
    // Simulate crack growth
    this.simulateCrackGrowth(density);
    
    return this.cracks;
  }
  
  /**
   * Generate initial seed cracks for formation type
   */
  generateSeedCracks(formation) {
    const seedCount = 8 + this.rng.nextInt(0, 6);
    
    switch (formation) {
      case "circuit":
        this.generateCircuitSeeds();
        break;
      case "kaleidoscope":
        this.generateKaleidoscopeSeeds();
        break;
      case "zen":
        this.generateZenSeeds();
        break;
      default:
        this.generateStandardSeeds(seedCount);
        break;
    }
  }
  
  generateStandardSeeds(count) {
    // Base seeds along bottom
    for (let i = 0; i < count; i++) {
      const x = this.width * 0.05 + this.width * 0.9 * (i / (count - 1));
      const y = this.height * 0.9;
      
      if (this.insideMountain(x, y)) {
        this.cracks.push({
          x: x,
          y: y,
          angle: -90 + (this.rng.next() - 0.5) * 60,
          type: "base",
          active: true,
          formation: this.bot.crackFormation,
          color: this.rng.choice(this.bot.palette),
          path: [{x, y}]
        });
      }
    }
    
    // Contour seeds
    for (let level = 0; level < 3; level++) {
      const contourSeeds = 6 + this.rng.nextInt(0, 4);
      for (let i = 0; i < contourSeeds; i++) {
        const x = this.width * 0.15 + this.width * 0.7 * (i / (contourSeeds - 1));
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
            path: [{x, y}]
          });
        }
      }
    }
  }
  
  generateCircuitSeeds() {
    const gridSize = this.formation.gridSize;
    const spacing = gridSize * 2;
    
    for (let x = 0; x < this.width; x += spacing) {
      for (let y = 0; y < this.height; y += spacing) {
        const gridX = Math.round(x / gridSize) * gridSize;
        const gridY = Math.round(y / gridSize) * gridSize;
        
        if (this.insideMountain(gridX, gridY) && this.rng.next() < 0.6) {
          // Horizontal and vertical traces
          [0, 90].forEach(angle => {
            this.cracks.push({
              x: gridX,
              y: gridY,
              angle: angle,
              type: "spreader",
              active: true,
              formation: "circuit",
              color: this.rng.choice(this.bot.palette),
              path: [{x: gridX, y: gridY}]
            });
          });
        }
      }
    }
  }
  
  generateKaleidoscopeSeeds() {
    const symmetry = 6;
    const centerX = this.width * 0.5;
    const centerY = this.height * 0.5;
    
    for (let s = 0; s < symmetry; s++) {
      const angle = (s / symmetry) * 360;
      const radius = 100;
      const x = centerX + Math.cos(angle * Math.PI / 180) * radius;
      const y = centerY + Math.sin(angle * Math.PI / 180) * radius;
      
      if (this.insideMountain(x, y)) {
        this.cracks.push({
          x: x,
          y: y,
          angle: angle + 180,
          type: "normal",
          active: true,
          formation: "kaleidoscope",
          color: this.rng.choice(this.bot.palette),
          path: [{x, y}],
          symmetryIndex: s
        });
      }
    }
  }
  
  generateZenSeeds() {
    // Wave seeds
    for (let i = 0; i < 8; i++) {
      const y = this.height * (0.1 + i * 0.11);
      const numPoints = 50;
      
      for (let p = 0; p < numPoints; p++) {
        const progress = p / numPoints;
        const x = progress * this.width;
        const waveY = y + Math.sin(x * 0.003 + i * 0.3) * 20;
        
        if (this.insideMountain(x, waveY)) {
          this.cracks.push({
            x: x,
            y: waveY,
            angle: Math.atan2(20 * 0.003 * Math.cos(x * 0.003 + i * 0.3), 1) * 180 / Math.PI,
            type: "wave",
            active: true,
            formation: "zen",
            color: this.rng.choice(this.bot.palette),
            path: [{x, y: waveY}],
            isWave: true
          });
        }
      }
    }
  }
  
  /**
   * Simulate crack growth with formation-specific behavior
   */
  simulateCrackGrowth(targetDensity) {
    let iterations = 0;
    const maxIterations = 1000;
    let currentDensity = 0;
    
    while (currentDensity < targetDensity && iterations < maxIterations) {
      iterations++;
      
      // Update active cracks
      const activeCracks = this.cracks.filter(crack => crack.active);
      if (activeCracks.length === 0) break;
      
      for (const crack of activeCracks) {
        if (this.rng.next() < 0.8) { // 80% chance to grow each iteration
          this.growCrack(crack);
        }
      }
      
      // Calculate current density
      const totalCrackLength = this.cracks.reduce((sum, crack) => sum + crack.path.length, 0);
      const mountainArea = this.calculateMountainArea();
      currentDensity = totalCrackLength / mountainArea;
      
      // Add new seeds if needed
      if (activeCracks.length < 10 && this.rng.next() < 0.1) {
        this.addSeed();
      }
    }
  }
  
  /**
   * Grow a single crack according to its formation
   */
  growCrack(crack) {
    const formation = CRACK_FORMATIONS[crack.formation];
    const oldX = crack.x;
    const oldY = crack.y;
    
    // Formation-specific angle modification
    switch (crack.formation) {
      case "chaotic":
        crack.angle += (this.rng.next() - 0.5) * formation.angleVariation;
        crack.angle += Math.sin(crack.path.length * 0.1 * formation.wobbleFreq) * formation.wobbleAmp;
        break;
      case "curved":
        crack.angle += Math.sin(crack.path.length * 0.1 * formation.wobbleFreq) * formation.wobbleAmp;
        break;
      case "circuit":
        // Snap to grid and occasional 90-degree turns
        if (crack.path.length % 20 === 0 && this.rng.next() < formation.turnProbability) {
          crack.angle = Math.round((crack.angle + (this.rng.next() < 0.5 ? 90 : -90)) / 90) * 90;
        }
        break;
      case "crystalline":
        if (crack.path.length % formation.segmentLength === 0) {
          crack.angle = this.rng.choice(formation.angleOptions);
        }
        break;
      case "spiral":
        crack.angle += formation.spiralDirection * formation.spiralTightness * 180;
        break;
    }
    
    // Move crack
    const speed = 1 + this.bot.aggression * 0.5;
    crack.x += Math.cos(crack.angle * Math.PI / 180) * speed;
    crack.y += Math.sin(crack.angle * Math.PI / 180) * speed;
    
    // Check boundaries
    if (!this.insideMountain(crack.x, crack.y)) {
      crack.active = false;
      return;
    }
    
    // Add to path
    crack.path.push({x: crack.x, y: crack.y});
    
    // Branching for certain formations
    if (crack.formation === "branching" && crack.path.length % 25 === 0 && this.rng.next() < 0.3) {
      this.createBranches(crack);
    }
  }
  
  /**
   * Create branch cracks
   */
  createBranches(parentCrack) {
    const numBranches = 1 + this.rng.nextInt(0, 2);
    const formation = CRACK_FORMATIONS[parentCrack.formation];
    
    for (let i = 0; i < numBranches; i++) {
      const branchAngle = parentCrack.angle + (i === 0 ? -1 : 1) * formation.branchAngle;
      
      this.cracks.push({
        x: parentCrack.x,
        y: parentCrack.y,
        angle: branchAngle,
        type: "branch",
        active: true,
        formation: parentCrack.formation,
        color: this.rng.choice(this.bot.palette),
        path: [{x: parentCrack.x, y: parentCrack.y}]
      });
    }
  }
  
  /**
   * Add new seed crack when needed
   */
  addSeed() {
    const angle = this.rng.next() * Math.PI * 2;
    const radius = this.rng.next() * 0.3 + 0.2;
    const x = this.width * 0.5 + Math.cos(angle) * this.width * radius;
    const y = this.height * 0.6 + Math.sin(angle) * this.height * radius * 0.7;
    
    if (this.insideMountain(x, y)) {
      this.cracks.push({
        x: x,
        y: y,
        angle: this.rng.next() * 360,
        type: "spreader",
        active: true,
        formation: this.bot.crackFormation,
        color: this.rng.choice(this.bot.palette),
        path: [{x, y}]
      });
    }
  }
  
  /**
   * Check if point is inside mountain
   */
  insideMountain(x, y) {
    const ix = Math.floor(x);
    if (ix < 0 || ix >= this.width) return false;
    return y > this.mountainProfile[ix] && y < this.height * 0.95;
  }
  
  /**
   * Calculate mountain area for density calculation
   */
  calculateMountainArea() {
    let area = 0;
    for (let x = 0; x < this.width; x++) {
      const height = this.height * 0.95 - this.mountainProfile[x];
      if (height > 0) area += height;
    }
    return Math.max(area, this.width * 50); // Minimum area
  }
  
  /**
   * Generate the complete SVG artwork
   */
  generateSVG() {
    // Generate all components
    this.generateCracks();
    
    // Start SVG
    let svg = `<svg width="1000" height="1000" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">`;
    
    // Add definitions for gradients and effects
    svg += this.generateSVGDefs();
    
    // Add background
    svg += this.generateSVGBackground();
    
    // Add mountain shape
    svg += this.generateSVGMountain();
    
    // Add environmental features
    svg += this.generateSVGEnvironment();
    
    // Add crack paths
    svg += this.generateSVGCracks();
    
    // Add special effects
    svg += this.generateSVGEffects();
    
    svg += `</svg>`;
    
    return svg;
  }
  
  /**
   * Generate SVG definitions (gradients, filters, etc.)
   */
  generateSVGDefs() {
    const bgColors = this.theme.background;
    
    return `
    <defs>
      <linearGradient id="background" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:${bgColors[0]};stop-opacity:1" />
        <stop offset="50%" style="stop-color:${bgColors[1]};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${bgColors[2]};stop-opacity:1" />
      </linearGradient>
      
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge> 
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      
      <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" style="stop-color:#FFD700;stop-opacity:0.3" />
        <stop offset="100%" style="stop-color:#FFD700;stop-opacity:0" />
      </radialGradient>
      
      <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" style="stop-color:#E6E6FA;stop-opacity:0.4" />
        <stop offset="100%" style="stop-color:#E6E6FA;stop-opacity:0" />
      </radialGradient>
    </defs>`;
  }
  
  /**
   * Generate SVG background
   */
  generateSVGBackground() {
    return `<rect width="1000" height="1000" fill="url(#background)" />`;
  }
  
  /**
   * Generate SVG mountain shape
   */
  generateSVGMountain() {
    let path = `M 0,${this.mountainProfile[0]}`;
    
    for (let x = 1; x < this.width; x++) {
      path += ` L ${x},${this.mountainProfile[x]}`;
    }
    
    path += ` L ${this.width},1000 L 0,1000 Z`;
    
    const mountainColors = this.theme.mountain;
    const mountainColor = mountainColors[Math.floor(mountainColors.length / 2)];
    
    return `<path d="${path}" fill="${mountainColor}" opacity="0.1" />`;
  }
  
  /**
   * Generate SVG environmental features
   */
  generateSVGEnvironment() {
    let svg = "";
    
    for (const feature of this.environment) {
      switch (feature.type) {
        case "sun":
          svg += `<circle cx="${feature.x}" cy="${feature.y}" r="${feature.size}" 
                    fill="url(#sunGlow)" opacity="${feature.intensity}" />
                  <circle cx="${feature.x}" cy="${feature.y}" r="${feature.size * 0.3}" 
                    fill="#FFD700" opacity="0.6" />`;
          break;
        case "moon":
          svg += `<circle cx="${feature.x}" cy="${feature.y}" r="${feature.size}" 
                    fill="url(#moonGlow)" opacity="${feature.intensity}" />
                  <circle cx="${feature.x}" cy="${feature.y}" r="${feature.size * 0.4}" 
                    fill="#E6E6FA" opacity="0.7" stroke="#FFFFFF" stroke-width="1" />`;
          break;
        case "stars":
          for (let i = 0; i < 5; i++) {
            const starX = feature.x + (this.rng.next() - 0.5) * 100;
            const starY = feature.y + (this.rng.next() - 0.5) * 100;
            const starSize = 1 + this.rng.next() * 2;
            svg += `<circle cx="${starX}" cy="${starY}" r="${starSize}" 
                      fill="#FFFFFF" opacity="${0.6 + this.rng.next() * 0.4}" />`;
          }
          break;
        case "birds":
          for (let i = 0; i < 3; i++) {
            const birdX = feature.x + i * 15;
            const birdY = feature.y + Math.abs(i - 1) * 3;
            svg += `<path d="M ${birdX - 3},${birdY} Q ${birdX},${birdY - 2} ${birdX + 3},${birdY}" 
                      stroke="${feature.color}" stroke-width="1" fill="none" opacity="0.6" />`;
          }
          break;
        case "rocket":
          svg += `<polygon points="${feature.x},${feature.y - feature.size/2} 
                    ${feature.x - feature.size/3},${feature.y + feature.size/2} 
                    ${feature.x + feature.size/3},${feature.y + feature.size/2}" 
                    fill="${feature.color}" opacity="0.7" />
                  <line x1="${feature.x}" y1="${feature.y + feature.size/2}" 
                        x2="${feature.x}" y2="${feature.y + feature.size}" 
                        stroke="#FF6B35" stroke-width="3" opacity="0.8" />`;
          break;
      }
    }
    
    return svg;
  }
  
  /**
   * Generate SVG crack paths with formation-specific styling
   */
  generateSVGCracks() {
    let svg = "";
    
    for (const crack of this.cracks) {
      if (crack.path.length < 2) continue;
      
      // Build path
      let pathData = `M ${crack.path[0].x},${crack.path[0].y}`;
      for (let i = 1; i < crack.path.length; i++) {
        pathData += ` L ${crack.path[i].x},${crack.path[i].y}`;
      }
      
      // Formation-specific styling
      let strokeWidth = 0.5;
      let opacity = 0.8;
      let filter = "";
      
      switch (crack.formation) {
        case "neon":
        case "cyber":
          strokeWidth = 1;
          opacity = 0.9;
          filter = 'filter="url(#glow)"';
          break;
        case "volcanic":
          strokeWidth = 0.8;
          opacity = 0.9;
          filter = 'filter="url(#glow)"';
          break;
        case "circuit":
          strokeWidth = 0.3;
          opacity = 0.7;
          break;
        case "zen":
          strokeWidth = 0.4;
          opacity = 0.6;
          break;
        case "crystalline":
          strokeWidth = 0.6;
          opacity = 0.8;
          break;
      }
      
      svg += `<path d="${pathData}" stroke="${crack.color}" stroke-width="${strokeWidth}" 
                fill="none" opacity="${opacity}" stroke-linecap="round" ${filter} />`;
    }
    
    return svg;
  }
  
  /**
   * Generate special effects based on theme
   */
  generateSVGEffects() {
    let svg = "";
    
    // Theme-specific atmospheric effects
    if (this.theme.special === "warmGlow") {
      svg += `<rect width="1000" height="1000" fill="url(#sunGlow)" opacity="0.1" />`;
    } else if (this.theme.special === "voidParticles") {
      // Add floating particles for void theme
      for (let i = 0; i < 30; i++) {
        const x = this.rng.next() * this.width;
        const y = this.rng.next() * this.height;
        const size = 1 + this.rng.next() * 2;
        svg += `<circle cx="${x}" cy="${y}" r="${size}" fill="#FFFFFF" 
                  opacity="${0.3 + this.rng.next() * 0.4}" />`;
      }
    }
    
    return svg;
  }
  
  /**
   * Generate complete metadata for NFT
   */
  generateMetadata() {
    return {
      name: `${this.bot.name} - Series ${this.seriesId}`,
      description: `A unique generative artwork created by ${this.bot.name}, an AI gambling bot with ${this.bot.traits.riskTaking || 'balanced'} risk tolerance. This piece was generated deterministically from blockchain randomness, capturing the bot's personality in algorithmic art.`,
      image: "data:image/svg+xml;base64," + btoa(this.generateSVG()),
      attributes: [
        { trait_type: "Bot", value: this.bot.name },
        { trait_type: "Series", value: this.seriesId },
        { trait_type: "Theme", value: this.bot.theme },
        { trait_type: "Formation", value: this.bot.crackFormation },
        { trait_type: "Density", value: this.traits.density },
        { trait_type: "Complexity", value: this.traits.complexity },
        { trait_type: "Special Features", value: this.traits.specialFeatures },
        { trait_type: "Color Variation", value: this.traits.colorVariation },
        { trait_type: "Generation", value: "Genesis" },
        { trait_type: "Seed", value: this.seed.toString() }
      ],
      properties: {
        bot_id: this.botId,
        series_id: this.seriesId,
        seed: this.seed,
        algorithm: "Substrate-Inspired Crack Formation",
        deterministic: true,
        traits: this.bot.traits
      }
    };
  }
  
  /**
   * Generate compact on-chain compatible SVG
   */
  generateCompactSVG() {
    const svg = this.generateSVG();
    
    // Minify SVG for on-chain storage
    return svg
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .trim();
  }
}

/**
 * Utility functions for external integration
 */
class ArtGeneratorUtils {
  /**
   * Generate art from VRF seed for specific bot and series
   */
  static generateFromVRF(vrfSeed, botId, seriesId) {
    // Convert VRF bytes32 to number seed
    const seed = parseInt(vrfSeed.slice(2, 18), 16); // Use first 16 hex chars
    
    const generator = new BarelyHumanArtGenerator(seed, botId, seriesId);
    return {
      svg: generator.generateCompactSVG(),
      metadata: generator.generateMetadata(),
      traits: generator.traits
    };
  }
  
  /**
   * Get rarity score for generated traits
   */
  static calculateRarityScore(traits) {
    let score = 0;
    
    for (const [category, trait] of Object.entries(traits)) {
      if (RARITY_TRAITS[category] && RARITY_TRAITS[category][trait]) {
        const weight = RARITY_TRAITS[category][trait].weight;
        score += (1 - weight) * 100; // Higher score for rarer traits
      }
    }
    
    return Math.round(score);
  }
  
  /**
   * Preview art without full generation (for UI)
   */
  static generatePreview(seed, botId, seriesId, size = 400) {
    const generator = new BarelyHumanArtGenerator(seed, botId, seriesId);
    
    // Generate simplified version for preview
    const simplifiedSVG = generator.generateSVG()
      .replace('width="1000"', `width="${size}"`)
      .replace('height="1000"', `width="${size}"`)
      .replace('viewBox="0 0 1000 1000"', `viewBox="0 0 1000 1000"`);
    
    return simplifiedSVG;
  }
  
  /**
   * Get all possible traits for a bot
   */
  static getBotTraitDistribution(botId) {
    const bot = BOT_PERSONALITIES[botId];
    if (!bot) return null;
    
    return {
      theme: bot.theme,
      formation: bot.crackFormation,
      personality: bot.name,
      traits: bot.traits,
      possibleRarities: Object.keys(RARITY_TRAITS)
    };
  }
}

// Export for Node.js/browser compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BarelyHumanArtGenerator,
    ArtGeneratorUtils,
    BOT_PERSONALITIES,
    RARITY_TRAITS,
    THEMES,
    CRACK_FORMATIONS
  };
} else if (typeof window !== 'undefined') {
  window.BarelyHumanArt = {
    BarelyHumanArtGenerator,
    ArtGeneratorUtils,
    BOT_PERSONALITIES,
    RARITY_TRAITS,
    THEMES,
    CRACK_FORMATIONS
  };
}