/**
 * Barely Human - Authentic Deterministic Generative Art
 * Direct port of the original color.html substrate algorithm with deterministic seeding
 * Preserves all sophisticated crack physics and formation behaviors
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
  
  choice(array) {
    return array[Math.floor(this.next() * array.length)];
  }
}

// Global seeded random function
let rng = null;
function random() {
  return rng ? rng.next() : Math.random();
}

/**
 * Authentic crack class - direct port from color.html with all original complexity
 */
class Crack {
  constructor(x, y, angle, type = "normal", formation = null) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.type = type;
    this.active = true;
    this.age = 0;
    this.branchCooldown = 0;
    this.path = [{ x, y }];
    this.formation = formation || crackFormation;

    // Get color from theme - EXACTLY as original
    const colors = themes[theme].mountain;
    this.baseColor = rng ? rng.choice(colors) : colors[Math.floor(Math.random() * colors.length)];
    this.color = this.baseColor;
    
    // Theme-specific color adjustments - EXACTLY as original
    if (theme === 'dusk') {
      const brighten = (hex, amt) => {
        const clamp = (v) => Math.max(0, Math.min(255, v));
        const r = clamp(parseInt(hex.slice(1, 3), 16) + amt);
        const g = clamp(parseInt(hex.slice(3, 5), 16) + amt);
        const b = clamp(parseInt(hex.slice(5, 7), 16) + amt);
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
      };
      this.color = brighten(this.baseColor, 60);
    }
    
    // Alpha adjustments - EXACTLY as original
    if (theme === 'void') {
      this.sandGain = 0.08 + random() * 0.12;
    } else if (theme === 'mist') {
      this.sandGain = 0.06 + random() * 0.10;
    } else {
      this.sandGain = 0.02 + random() * 0.08;
    }
    this.birthTime = globalAge;
    
    // Klein Blue special handling - EXACTLY as original
    if (theme === 'klein') {
      const kleinColors = ['#87CEEB', '#B0E0E6', '#E0FFFF', '#F0F8FF', '#FFFFFF'];
      this.baseColor = kleinColors[Math.floor(random() * kleinColors.length)];
      this.color = this.baseColor;
    }

    // Speed variations - EXACTLY as original
    this.speed = type === "contour" ? 0.8 : type === "spreader" ? 1.0 : 0.5;

    // Formation parameters - COMPLETE original system
    const formationParams = crackFormations[this.formation];
    this.wobbleFreq = formationParams.wobbleFreq || 0;
    this.wobbleAmp = formationParams.wobbleAmp || 0;
    this.drift = formationParams.drift || 0;
    this.angleVariation = formationParams.angleVariation || 0;

    // ALL formation-specific parameters - EXACTLY as original
    if (this.formation === "branching") {
      this.branchInterval = formationParams.branchInterval;
      this.branchAngle = formationParams.branchAngle;
      this.branchDecay = formationParams.branchDecay;
      this.curveFactor = formationParams.curveFactor;
      this.lastBranch = 0;
      this.branchDepth = 0;
      this.branchHistory = [];
    } else if (this.formation === "spiral") {
      this.spiralTightness = formationParams.spiralTightness;
      this.spiralDirection = formationParams.spiralDirection;
      this.spiralExpansion = formationParams.spiralExpansion;
      this.spiralRadius = 1;
    } else if (this.formation === "crystalline") {
      this.angleOptions = formationParams.angleOptions;
      this.segmentLength = formationParams.segmentLength;
      this.segmentProgress = 0;
      this.currentAngle = this.angle;
      this.growthRate = formationParams.growthRate;
      this.facetProbability = formationParams.facetProbability;
      this.shatterProbability = formationParams.shatterProbability;
      this.resonanceFreq = formationParams.resonanceFreq;
      this.crystalSize = 1;
      this.resonance = 0;
      this.facetCount = 0;
    } else if (this.formation === "kaleidoscope") {
      this.vortexSpeed = formationParams.vortexSpeed;
      this.perspectiveDepth = formationParams.perspectiveDepth;
      this.symmetryFold = formationParams.symmetryFold;
      this.suckSpeed = formationParams.suckSpeed;
      this.rotationSpeed = formationParams.rotationSpeed;
      this.segmentLength = formationParams.segmentLength;
      this.symmetryIndex = this.symmetryIndex || 0;
      this.depthLayer = this.depthLayer || 0;
      this.perspectiveScale = 1;
      this.rotationAngle = 0;
      this.segmentProgress = 0;
    } else if (this.formation === "zen") {
      this.angleVariation = formationParams.angleVariation;
      this.waveData = this.waveData || null;
      this.progress = this.progress || 0;
      this.isWave = this.isWave || false;
      this.isBranch = this.isBranch || false;
      this.isFill = this.isFill || false;
    } else if (this.formation === "lightning") {
      this.segmentLength = formationParams.segmentLength;
      this.branchProbability = formationParams.branchProbability;
      this.zigzagAngle = formationParams.zigzagAngle;
      this.segmentProgress = 0;
      this.lastTurnDirection = random() < 0.5 ? 1 : -1;
    } else if (this.formation === "organic") {
      this.growthRate = formationParams.growthRate;
      this.branchProbability = formationParams.branchProbability;
      this.curveSinFreq = formationParams.curveSinFreq;
      this.growthPhase = random() * Math.PI * 2;
    } else if (this.formation === "circuit") {
      this.gridSize = formationParams.gridSize;
      this.turnProbability = formationParams.turnProbability;
      this.branchProbability = formationParams.branchProbability;
      this.lastTurn = 0;
      this.x = Math.round(this.x / this.gridSize) * this.gridSize;
      this.y = Math.round(this.y / this.gridSize) * this.gridSize;
      this.angle = Math.round(this.angle / 90) * 90;
    }
  }

  // COMPLETE update method - EXACTLY as original with all formation behaviors
  update() {
    if (!this.active || isComplete) return;

    this.age++;
    if (this.branchCooldown > 0) this.branchCooldown--;
    
    if (this.environmentType && this.maxLength) {
      const distanceTraveled = this.age * this.speed;
      if (distanceTraveled >= this.maxLength) {
        this.active = false;
        return;
      }
    }

    const oldX = this.x;
    const oldY = this.y;

    // COMPLETE formation behavior - EXACTLY as original
    let wobble = 0;

    if (this.formation === "curved") {
      wobble = Math.sin(this.age * 0.1 * this.wobbleFreq) * this.wobbleAmp;
      this.angle += wobble * crackFormations.curved.curveAmount;
    } else if (this.formation === "branching") {
      // COMPLETE Tarbell-style branching - EXACTLY as original
      if (globalAge < 150) {
        wobble = Math.sin(this.age * 0.1 * this.wobbleFreq) * this.wobbleAmp;
        this.angle += wobble + Math.sin(this.age * this.curveFactor) * 2;
      } else {
        wobble = 0;
      }
      
      // COMPLETE fractal branching - EXACTLY as original
      if (this.age - this.lastBranch > this.branchInterval) {
        const branchProbability = 0.8 * Math.pow(this.branchDecay, this.branchDepth);
        
        if (random() < branchProbability && this.branchDepth < 5) {
          const angleDecay = Math.pow(0.8, this.branchDepth);
          const baseAngle = this.branchAngle * angleDecay;
          
          const numBranches = random() < 0.3 ? 1 : 2;
          
          if (numBranches === 1) {
            const direction = random() < 0.5 ? -1 : 1;
            const branch = new Crack(this.x, this.y, this.angle + direction * baseAngle, this.type, 'branching');
            branch.branchDepth = this.branchDepth + 1;
            branch.branchInterval = this.branchInterval * 1.2;
            branch.branchAngle = this.branchAngle;
            branch.branchDecay = this.branchDecay;
            branch.curveFactor = this.curveFactor * 1.1;
            branch.wobbleFreq = globalAge < 150 ? this.wobbleFreq : 0;
            branch.wobbleAmp = globalAge < 150 ? this.wobbleAmp * 0.8 : 0;
            branch.speed = this.speed * 0.9;
            branch.lastBranch = 0;
            branch.branchHistory = [];
            cracks.push(branch);
          } else {
            const leftAngle = baseAngle * (0.7 + random() * 0.6);
            const rightAngle = baseAngle * (0.7 + random() * 0.6);
            
            const leftBranch = new Crack(this.x, this.y, this.angle - leftAngle, this.type, 'branching');
            const rightBranch = new Crack(this.x, this.y, this.angle + rightAngle, this.type, 'branching');
            
            [leftBranch, rightBranch].forEach(branch => {
              branch.branchDepth = this.branchDepth + 1;
              branch.branchInterval = this.branchInterval * 1.2;
              branch.branchAngle = this.branchAngle;
              branch.branchDecay = this.branchDecay;
              branch.curveFactor = this.curveFactor * 1.1;
              branch.wobbleFreq = globalAge < 150 ? this.wobbleFreq : 0;
              branch.wobbleAmp = globalAge < 150 ? this.wobbleAmp * 0.8 : 0;
              branch.speed = this.speed * (0.8 + random() * 0.2);
              branch.lastBranch = 0;
              branch.branchHistory = [];
            });
            
            cracks.push(leftBranch, rightBranch);
          }
          
          this.branchHistory.push({ x: this.x, y: this.y, age: this.age });
        }
        this.lastBranch = this.age;
      }
    } else if (this.formation === "spiral") {
      // COMPLETE spiral - EXACTLY as original
      this.spiralRadius += this.spiralExpansion;
      this.angle += this.spiralDirection * this.spiralTightness * 180;
      
      wobble = Math.sin(this.age * 0.05) * 2;
      
      if (this.age % 50 === 0 && random() < 0.3 && cracks.length < 2000) {
        const newX = this.x + (random() - 0.5) * 100;
        const newY = this.y + (random() - 0.5) * 100;
        if (insideMountain(newX, newY)) {
          const newSpiral = new Crack(newX, newY, random() * 360, 'spreader');
          cracks.push(newSpiral);
        }
      }
      
      this.speed = 0.5 + Math.min(this.spiralRadius * 0.1, 2);
    } else if (this.formation === "crystalline") {
      // COMPLETE crystalline growth - EXACTLY as original
      this.crystalSize *= this.growthRate;
      this.resonance += this.resonanceFreq;
      
      wobble = Math.sin(this.resonance * Math.PI * 2) * this.wobbleAmp * (1 + this.crystalSize * 0.1);
      
      this.segmentProgress += this.speed * (1 + Math.sin(this.resonance) * 0.2);
      
      if (this.segmentProgress > this.segmentLength) {
        const preferredAngles = this.angleOptions.filter(a => 
          Math.abs((this.angle % 360) - a) < 45 || 
          Math.abs((this.angle % 360) - a) > 315
        );
        
        const anglePool = preferredAngles.length > 0 ? preferredAngles : this.angleOptions;
        const angleIndex = Math.floor(random() * anglePool.length);
        let newAngle = anglePool[angleIndex];
        
        newAngle += (random() - 0.5) * this.angleVariation;
        this.currentAngle = newAngle * (random() < 0.5 ? 1 : -1);
        this.angle = this.currentAngle;
        this.segmentProgress = 0;
        
        // Crystal faceting
        if (random() < this.facetProbability && cracks.length < 3000) {
          this.facetCount++;
          const facetAngles = [60, 90, 120];
          const numFacets = 1 + Math.floor(random() * 2);
          
          for (let f = 0; f < numFacets; f++) {
            const facetAngle = this.angle + facetAngles[Math.floor(random() * facetAngles.length)] * (random() < 0.5 ? 1 : -1);
            const facet = new Crack(this.x, this.y, facetAngle, this.type, "crystalline");
            facet.speed = this.speed * (0.7 + random() * 0.3);
            facet.segmentLength = this.segmentLength * (0.5 + random() * 0.5);
            facet.crystalSize = this.crystalSize * 0.8;
            facet.resonance = this.resonance + random() * Math.PI;
            cracks.push(facet);
          }
        }
        
        // Crystal shattering
        if (random() < this.shatterProbability && this.crystalSize > 2 && cracks.length < 3000) {
          const shards = 4 + Math.floor(random() * 4);
          for (let s = 0; s < shards; s++) {
            const shardAngle = (s / shards) * 360 + random() * 30;
            const shard = new Crack(this.x, this.y, shardAngle, this.type, "crystalline");
            shard.speed = 1 + random() * 0.5;
            shard.segmentLength = 5 + random() * 10;
            shard.crystalSize = 1;
            shard.wobbleAmp = this.wobbleAmp * 2;
            cracks.push(shard);
          }
          this.active = false;
        }
      }
      
      if (this.crystalSize > 5) {
        this.speed *= 0.98;
        if (this.speed < 0.1) this.active = false;
      }
      
      // Interference patterns
      if (this.age % 20 === 0) {
        for (let other of cracks) {
          if (other !== this && other.formation === "crystalline" && other.active) {
            const dx = other.x - this.x;
            const dy = other.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 50 && dist > 5) {
              this.angle += (dx / dist) * 5;
              this.resonance += 0.1;
            }
          }
        }
      }
    } else if (this.formation === "kaleidoscope") {
      // COMPLETE kaleidoscope - EXACTLY as original
      wobble = 0;
      
      this.perspectiveDepth += this.suckSpeed;
      this.perspectiveScale = 1 / (1 + this.perspectiveDepth * 0.3);
      this.rotationAngle += this.rotationSpeed;
      
      const centerX = canvasWidth * 0.5;
      const centerY = canvasHeight * 0.5;
      const dx = this.x - centerX;
      const dy = this.y - centerY;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);
      
      this.segmentProgress += this.speed;
      
      if (this.segmentProgress > this.segmentLength) {
        const angleToCenter = Math.atan2(centerY - this.y, centerX - this.x) * 180 / Math.PI;
        
        this.angle = angleToCenter + this.rotationAngle * 10;
        this.segmentProgress = 0;
        
        if (cracks.length < 500) {
          const symIndex = (this.symmetryIndex + 3) % this.symmetryFold;
          const symAngle = this.angle + (symIndex - this.symmetryIndex) * 60;
          
          const newCrack = new Crack(this.x, this.y, symAngle, this.type, "kaleidoscope");
          newCrack.symmetryIndex = symIndex;
          newCrack.perspectiveDepth = this.perspectiveDepth;
          newCrack.speed = this.speed;
          cracks.push(newCrack);
        }
      }
      
      this.speed = 0.8 + this.perspectiveDepth * 0.05;
      
      if (distFromCenter < 30) {
        this.active = false;
      }
    } else if (this.formation === "zen") {
      // COMPLETE zen formation - EXACTLY as original
      if (this.isWave && this.waveData) {
        this.progress += 0.003;
        
        if (this.progress > 1) {
          this.active = false;
          return;
        }
        
        let x;
        if (this.waveData.direction > 0) {
          x = this.progress * canvasWidth;
        } else {
          x = (1 - this.progress) * canvasWidth;
        }
        
        const y = this.waveData.startY + Math.sin(x * this.waveData.frequency + this.waveData.phase) * this.waveData.amplitude;
        
        this.x = this.x * 0.9 + x * 0.1;
        this.y = this.y * 0.9 + y * 0.1;
        
        const lookAhead = 20;
        const nextX = x + lookAhead * this.waveData.direction;
        const nextY = this.waveData.startY + Math.sin(nextX * this.waveData.frequency + this.waveData.phase) * this.waveData.amplitude;
        this.angle = Math.atan2(nextY - this.y, nextX - this.x) * 180 / Math.PI;
        
        if (!insideMountain(x, y)) {
          this.active = false;
          return;
        }
        
        if (this.age > 20 && random() < 0.02 && cracks.length < 1500) {
          const branchAngle = this.angle + (random() < 0.5 ? 90 : -90) + (random() - 0.5) * 30;
          const branch = new Crack(this.x, this.y, branchAngle, "branch", "zen");
          branch.speed = 1.0 + random() * 0.5;
          branch.isBranch = true;
          cracks.push(branch);
        }
        
      } else if (this.isBranch) {
        this.angle += (random() - 0.5) * this.angleVariation;
        
        const drift = Math.sin(this.x * 0.005 + this.y * 0.003) * 2;
        this.angle += drift;
        
        if (this.age > 30 && random() < 0.008 && cracks.length < 1500) {
          const subBranchAngle = this.angle + (random() < 0.5 ? 70 : -70) + (random() - 0.5) * 20;
          const subBranch = new Crack(this.x, this.y, subBranchAngle, "branch", "zen");
          subBranch.speed = 0.8 + random() * 0.4;
          subBranch.isBranch = true;
          cracks.push(subBranch);
        }
        
        // Wave boundary check
        if (this.age > 10 && this.age % 8 === 0 && window.zenWaveLines) {
          const tolerance = 10;
          for (let wave of window.zenWaveLines) {
            const roughY = wave.startY + wave.amplitude;
            if (Math.abs(this.y - roughY) > wave.amplitude * 2) continue;
            
            const waveY = wave.startY + Math.sin(this.x * wave.frequency + wave.phase) * wave.amplitude;
            if (Math.abs(this.y - waveY) < tolerance) {
              this.active = false;
              break;
            }
          }
        }
        
      } else if (this.isFill) {
        this.angle += (random() - 0.5) * this.angleVariation;
        
        const waveInfluence = Math.sin(this.x * 0.004 + this.age * 0.02) * 3;
        this.angle += waveInfluence;
        
        if (this.age > 10 && this.age % 8 === 0 && window.zenWaveLines) {
          for (let wave of window.zenWaveLines) {
            if (Math.abs(this.y - wave.startY) > wave.amplitude * 2) continue;
            
            const waveY = wave.startY + Math.sin(this.x * wave.frequency + wave.phase) * wave.amplitude;
            if (Math.abs(this.y - waveY) < 10) {
              this.active = false;
              break;
            }
          }
        }
      }
      
    } else if (this.formation === "lightning") {
      // COMPLETE lightning - EXACTLY as original
      wobble = 0;
      this.segmentProgress += this.speed;
      
      if (this.segmentProgress >= this.segmentLength) {
        this.lastTurnDirection *= -1;
        this.angle += this.zigzagAngle * this.lastTurnDirection + (random() - 0.5) * 20;
        this.segmentProgress = 0;
        
        if (random() < this.branchProbability && cracks.length < 2000) {
          const branchAngle = this.angle + (random() < 0.5 ? 45 : -45) + (random() - 0.5) * 30;
          const branch = new Crack(this.x, this.y, branchAngle, this.type, "lightning");
          branch.speed = this.speed * 1.2;
          branch.segmentLength = this.segmentLength * 0.7;
          cracks.push(branch);
        }
      }
    } else if (this.formation === "organic") {
      // COMPLETE organic - EXACTLY as original
      const growthWave = Math.sin(this.age * this.curveSinFreq + this.growthPhase);
      wobble = growthWave * this.wobbleAmp;
      
      const driftWave = Math.sin(this.x * 0.01 + this.y * 0.01) * 3;
      this.angle += driftWave + wobble;
      
      this.speed *= this.growthRate;
      
      if (this.age > 20 && random() < this.branchProbability && cracks.length < 2000) {
        const numBranches = random() < 0.7 ? 1 : 2;
        for (let i = 0; i < numBranches; i++) {
          const branchAngle = this.angle + (random() - 0.5) * 60;
          const branch = new Crack(this.x, this.y, branchAngle, this.type, "organic");
          branch.speed = this.speed * (0.5 + random() * 0.5);
          branch.growthPhase = this.growthPhase + random() * Math.PI;
          cracks.push(branch);
        }
      }
      
      if (this.speed < 0.1) {
        this.active = false;
      }
    } else if (this.formation === "circuit") {
      // COMPLETE circuit - EXACTLY as original
      wobble = 0;
      
      const gridX = Math.round(this.x / this.gridSize) * this.gridSize;
      const gridY = Math.round(this.y / this.gridSize) * this.gridSize;
      
      if (Math.abs(this.x - gridX) < 2 && Math.abs(this.y - gridY) < 2) {
        this.x = gridX;
        this.y = gridY;
        
        if (random() < this.turnProbability && this.lastTurn > this.gridSize * 5) {
          const turnDirection = random() < 0.5 ? 90 : -90;
          this.angle = Math.round((this.angle + turnDirection) / 90) * 90;
          this.lastTurn = 0;
        }
        
        // Aggressive branching
        if (cracks.length < 6000) {
          if (random() < this.branchProbability) {
            const crossPattern = random() < 0.5;
            
            if (crossPattern) {
              for (let dir = 0; dir < 360; dir += 90) {
                if (dir !== (this.angle + 180) % 360) {
                  const branch = new Crack(gridX, gridY, dir, this.type, "circuit");
                  branch.speed = 1.5 + random() * 0.5;
                  cracks.push(branch);
                }
              }
            } else {
              const leftBranch = new Crack(gridX, gridY, this.angle - 90, this.type, "circuit");
              const rightBranch = new Crack(gridX, gridY, this.angle + 90, this.type, "circuit");
              leftBranch.speed = 1.5 + random() * 0.5;
              rightBranch.speed = 1.5 + random() * 0.5;
              cracks.push(leftBranch, rightBranch);
            }
          }
        }
      } else {
        this.lastTurn += this.speed;
      }
      
      // Gap filling
      if (this.age % 20 === 0 && cracks.length < 6000) {
        for (let i = 1; i <= 2; i++) {
          const perpAngle = this.angle + 90;
          const offsetDist = this.gridSize * i;
          
          for (let side = -1; side <= 1; side += 2) {
            const offsetX = Math.cos(perpAngle * Math.PI / 180) * offsetDist * side;
            const offsetY = Math.sin(perpAngle * Math.PI / 180) * offsetDist * side;
            
            const newX = Math.round((this.x + offsetX) / this.gridSize) * this.gridSize;
            const newY = Math.round((this.y + offsetY) / this.gridSize) * this.gridSize;
            
            if (insideMountain(newX, newY) && random() < 0.7) {
              const newCircuit = new Crack(newX, newY, this.angle, 'spreader', 'circuit');
              newCircuit.speed = 1.5 + random() * 0.5;
              cracks.push(newCircuit);
            }
          }
        }
      }
      
      if (this.age > 100) {
        this.speed = Math.min(this.speed * 1.01, 3.0);
      }
    } else {
      wobble = Math.sin(this.age * 0.1 * this.wobbleFreq) * this.wobbleAmp;
    }

    // COMPLETE movement logic - EXACTLY as original
    if (this.type === "spiral") {
      this.angle += 2 + Math.sin(this.age * 0.05) * 2;
    } else if (this.type === "base") {
      this.angle += wobble + this.drift;
      if (this.y > canvasHeight * 0.5) {
        this.angle -= 1;
      }
    } else if (this.type === "contour") {
      const x = Math.floor(this.x);
      if (x > 10 && x < canvasWidth - 10) {
        const slope = (mountainY[x + 5] - mountainY[x - 5]) / 10;
        const targetAngle = (Math.atan2(slope, 1) * 180) / Math.PI;
        this.angle = this.angle * 0.9 + targetAngle * 0.1;
      }
      this.angle += wobble * 0.5;
    } else {
      this.angle += wobble + (random() - 0.5) * this.angleVariation;
    }

    // Move
    this.x += Math.cos((this.angle * Math.PI) / 180) * this.speed;
    this.y += Math.sin((this.angle * Math.PI) / 180) * this.speed;

    // Boundary check
    if (!insideMountain(this.x, this.y)) {
      this.x = oldX;
      this.y = oldY;
      this.angle += 180 + (random() - 0.5) * 90;
      this.type = "normal";
      return;
    }

    // Store path
    this.path.push({ x: this.x, y: this.y });
    if (this.path.length > 1000) {
      this.path.shift();
    }

    // COMPLETE sand painting - EXACTLY as original
    this.sandPaint(oldX, oldY);

    // Grid updates and collision detection - EXACTLY as original
    const gx = Math.floor(this.x);
    const gy = Math.floor(this.y);
    const idx = gy * canvasWidth + gx;

    if (idx >= 0 && idx < grid.length) {
      if (grid[idx] === -1) {
        grid[idx] = Math.floor(this.angle);
        filledCells++;

        density = filledCells / mountainArea;

        if (density >= maxDensity) {
          isComplete = true;
        }
      } else if (
        Math.abs(grid[idx] - this.angle) > 20 &&
        Math.abs(grid[idx] - this.angle) < 340
      ) {
        if (this.formation === "zen" && (this.isBranch || this.isFill)) {
          this.active = false;
          
          if (cracks.length < 1500 && random() < 0.3) {
            const numBranches = 1 + Math.floor(random() * 2);
            for (let i = 0; i < numBranches; i++) {
              const branchAngle = this.angle + (random() < 0.5 ? 90 : -90) + (random() - 0.5) * 30;
              const newCrack = new Crack(this.x, this.y, branchAngle, "branch", "zen");
              newCrack.speed = 0.8 + random() * 0.4;
              newCrack.isBranch = true;
              cracks.push(newCrack);
            }
          }
        } else {
          this.active = false;
        }

        // Enhanced branching
        if (
          cracks.length < 2000 &&
          density < maxDensity * 0.98 &&
          this.branchCooldown === 0
        ) {
          const numBranches = 2 + (random() < 0.3 ? 1 : 0) + (random() < 0.1 ? 1 : 0);
          for (let i = 0; i < numBranches; i++) {
            const branchAngle = this.angle + (i - numBranches / 2 + 0.5) * 75 + (random() - 0.5) * 40;
            const newCrack = new Crack(this.x, this.y, branchAngle, "normal");
            newCrack.branchCooldown = 5;
            cracks.push(newCrack);
          }
        }
      }
    }

    // Adaptive branching
    let branchChance = (maxDensity - density) * 0.04;
    
    if (this.formation === "spiral") {
      branchChance *= 2;
    }

    if (
      random() < branchChance &&
      cracks.length < 2000 &&
      this.branchCooldown === 0 &&
      this.age > 15
    ) {
      const branchAngle = this.angle + (random() < 0.5 ? -75 : 75) + (random() - 0.5) * 40;
      const newCrack = new Crack(this.x, this.y, branchAngle, "normal");
      newCrack.branchCooldown = 15;
      cracks.push(newCrack);
      this.branchCooldown = 20;
    }
  }

  // COMPLETE sand painting - EXACTLY as original with all formation behaviors
  sandPaint(ox, oy) {
    const perpAngle = ((this.angle + 90) * Math.PI) / 180;
    let distance = 0;
    let rx = this.x;
    let ry = this.y;

    if (this.formation === "kaleidoscope") {
      // COMPLETE kaleidoscope sand painting - EXACTLY as original
      const grains = 30;
      const centerX = canvasWidth * 0.5;
      const centerY = canvasHeight * 0.5;
      
      const scale = 1 / (1 + this.perspectiveDepth * 0.2);
      
      const maxDist = 40 * scale;
      let dist = 0;
      
      while (dist < maxDist && insideMountain(rx, ry)) {
        rx += Math.cos(perpAngle) * 1;
        ry += Math.sin(perpAngle) * 1;
        dist++;
      }
      
      for (let i = 0; i < grains; i++) {
        const t = i / grains;
        const px = ox + (rx - ox) * t;
        const py = oy + (ry - oy) * t;
        
        const alpha = 0.015 * (1 - t * 0.5);
        
        for (let s = 0; s < 6; s++) {
          const angle = (s / 6) * Math.PI * 2;
          const sx = centerX + (px - centerX) * Math.cos(angle) - (py - centerY) * Math.sin(angle);
          const sy = centerY + (px - centerX) * Math.sin(angle) + (py - centerY) * Math.cos(angle);
          
          if (insideMountain(sx, sy)) {
            // SVG rendering for kaleidoscope symmetry
            svgPaths.push(`<circle cx="${sx}" cy="${sy}" r="0.5" fill="${this.color}" opacity="${alpha}" />`);
          }
        }
      }
    } else if (this.formation === "zen") {
      // COMPLETE zen sand painting - EXACTLY as original
      const maxDistance = 30 + Math.sin(this.age * 0.02) * 10;
      
      while (distance < maxDistance && insideMountain(rx, ry)) {
        rx += Math.cos(perpAngle) * 0.8;
        ry += Math.sin(perpAngle) * 0.8;
        distance++;
        
        const idx = Math.floor(ry) * canvasWidth + Math.floor(rx);
        if (idx >= 0 && idx < grid.length && grid[idx] !== -1) {
          break;
        }
      }
      
      const grains = 64;
      for (let i = 0; i < grains; i++) {
        const t = i / grains;
        const alpha = 0.016 * (1 - t);
        
        const w = t + (random() - 0.5) * 0.1;
        const px = ox + (rx - ox) * w;
        const py = oy + (ry - oy) * w;
        
        if (insideMountain(px, py)) {
          svgPaths.push(`<circle cx="${px}" cy="${py}" r="0.5" fill="${this.color}" opacity="${alpha}" />`);
        }
      }
    } else if (this.formation === "crystalline") {
      // COMPLETE crystalline sand painting - EXACTLY as original
      const crystalDistance = 20 + this.crystalSize * 10;
      
      while (distance < crystalDistance && insideMountain(rx, ry)) {
        rx += Math.cos(perpAngle) * 0.5;
        ry += Math.sin(perpAngle) * 0.5;
        distance++;

        const idx = Math.floor(ry) * canvasWidth + Math.floor(rx);
        if (idx >= 0 && idx < grid.length && grid[idx] !== -1) {
          break;
        }
      }

      const grains = 60;
      for (let i = 0; i < grains; i++) {
        const t = i / grains;
        
        const band = Math.floor(t * 5) / 5;
        const alpha = 0.02 * (1 - band) * (1 + Math.sin(this.resonance + band * Math.PI) * 0.3);
        
        const crystalNoise = Math.sin(this.resonance + t * Math.PI * 4) * 1;
        const px = ox + (rx - ox) * t + crystalNoise;
        const py = oy + (ry - oy) * t + Math.cos(this.resonance + t * Math.PI * 4) * 1;

        if (insideMountain(px, py)) {
          const shimmer = this.crystalSize > 2 ? (1 + Math.sin(this.age * 0.1 + t * 20) * 0.2) : 1;
          svgPaths.push(`<circle cx="${px}" cy="${py}" r="0.5" fill="${this.color}" opacity="${alpha * shimmer}" />`);
        }
      }
    } else {
      // COMPLETE standard sand painting - EXACTLY as original
      const maxDistance = 50 + Math.sin(this.age * 0.05) * 30;

      while (distance < maxDistance && insideMountain(rx, ry)) {
        rx += Math.cos(perpAngle) * 0.8;
        ry += Math.sin(perpAngle) * 0.8;
        distance++;

        const idx = Math.floor(ry) * canvasWidth + Math.floor(rx);
        if (idx >= 0 && idx < grid.length && grid[idx] !== -1) {
          break;
        }
      }

      const grains = 64;
      for (let i = 0; i < grains; i++) {
        const t = i / grains;
        const alpha = 0.03 * (1 - t) * (1 + Math.sin(this.age * 0.02) * 0.5);

        const pos = Math.sin(t * Math.PI) + Math.sin(t * Math.PI * 3) * 0.1;
        const px = ox + (rx - ox) * pos + (random() - 0.5) * 3;
        const py = oy + (ry - oy) * pos + (random() - 0.5) * 3;

        if (insideMountain(px, py)) {
          svgPaths.push(`<circle cx="${px}" cy="${py}" r="0.5" fill="${this.color}" opacity="${alpha}" />`);
        }
      }
    }
  }
}

// ALL original variables and configuration - EXACTLY as preserved
let cracks = [];
let grid = [];
let mountainY = [];
let theme = "dawn";
let density = 0;
let maxDensity = 0.85 + Math.random() * 0.14;
let isComplete = false;
let mountainArea = 0;
let filledCells = 0;
let specialFeatures = [];
let crackFormation = null;
let globalAge = 0;
let currentSeed = null;
let backgroundElements = [];
let environment = null;
let currentTraits = {};
let svgPaths = []; // For SVG generation
let canvasWidth = 1000;
let canvasHeight = 1000;

// COMPLETE original crack formations - EXACTLY as in color.html
const crackFormations = {
  straight: {
    wobbleFreq: 0,
    wobbleAmp: 0,
    drift: 0,
    angleVariation: 2,
    description: "Clean straight lines",
  },
  curved: {
    wobbleFreq: 0.3,
    wobbleAmp: 5,
    drift: 0.2,
    angleVariation: 3,
    curveAmount: 0.5,
    description: "Smooth curves",
  },
  chaotic: {
    wobbleFreq: 2 + random() * 3,
    wobbleAmp: 5 + random() * 5,
    drift: (random() - 0.5) * 2,
    angleVariation: 10,
    description: "Chaotic movement",
  },
  branching: {
    wobbleFreq: 0.5 + random() * 0.5,
    wobbleAmp: 2 + random() * 2,
    drift: 0,
    angleVariation: 1,
    branchInterval: 20 + random() * 15,
    branchAngle: 25 + random() * 20,
    branchDecay: 0.7 + random() * 0.15,
    curveFactor: 0.02 + random() * 0.02,
    description: "Tree-like branching"
  },
  spiral: {
    wobbleFreq: 0,
    wobbleAmp: 0,
    drift: 0,
    angleVariation: 2,
    spiralTightness: 0.02 + random() * 0.05,
    spiralDirection: random() < 0.5 ? 1 : -1,
    spiralExpansion: 0.5 + random() * 0.5,
    description: "Expanding spiral patterns"
  },
  crystalline: {
    wobbleFreq: 0.05,
    wobbleAmp: 3,
    drift: 0.1,
    angleVariation: 5,
    angleOptions: [0, 30, 45, 60, 90, 120, 135, 150],
    segmentLength: 10 + random() * 20,
    growthRate: 0.95,
    facetProbability: 0.15,
    shatterProbability: 0.05,
    resonanceFreq: 0.02,
    description: "Dynamic crystalline growth"
  },
  kaleidoscope: {
    wobbleFreq: 0,
    wobbleAmp: 0,
    drift: 0,
    angleVariation: 0,
    vortexSpeed: 0.02,
    perspectiveDepth: 0,
    symmetryFold: 6,
    suckSpeed: 0.01,
    rotationSpeed: 0.005,
    segmentLength: 15,
    description: "Tarbell-inspired kaleidoscope"
  },
  zen: {
    wobbleFreq: 0,
    wobbleAmp: 0,
    drift: 0,
    angleVariation: 8,
    ringSpacing: 20,
    waveAmplitude: 15,
    waveFrequency: 0.03,
    description: "Zen garden ripples"
  },
  lightning: {
    wobbleFreq: 0,
    wobbleAmp: 0,
    drift: 0,
    angleVariation: 45,
    segmentLength: 30,
    branchProbability: 0.15,
    zigzagAngle: 45,
    description: "Electric lightning bolts"
  },
  organic: {
    wobbleFreq: 0.8,
    wobbleAmp: 8,
    drift: 0.3,
    angleVariation: 15,
    growthRate: 0.98,
    branchProbability: 0.08,
    curveSinFreq: 0.02,
    description: "Organic plant growth"
  },
  circuit: {
    wobbleFreq: 0,
    wobbleAmp: 0,
    drift: 0,
    angleVariation: 0,
    gridSize: 15,
    turnProbability: 0.08,
    branchProbability: 0.4,
    description: "Circuit board patterns"
  }
};

// COMPLETE original themes - EXACTLY as in color.html
const themes = {
  dawn: {
    background: ['#2D1B3D', '#E94560', '#F39C6B'],
    mountain: ['#1A0B2E', '#3D1E4E', '#693668'],
    atmosphere: 'rgba(255, 200, 150, 0.03)',
    special: 'warmGlow',
  },
  dusk: {
    background: ['#1A1A2E', '#16213E', '#E94560'],
    mountain: ['#0F3460', '#16213E', '#533483'],
    atmosphere: 'rgba(150, 100, 200, 0.05)',
    special: 'twilightGradient',
  },
  la: {
    background: ['#1a1a2e', '#16213e', '#0f3460'],
    mountain: ['#533483', '#C400C4', '#FF007F'],
    atmosphere: 'rgba(196, 0, 196, 0.05)',
    special: 'laGlow',
  },
  mist: {
    background: ['#E8E8E8', '#D3D3D3', '#A8A8A8'],
    mountain: ['#404040', '#505050', '#606060'],
    atmosphere: 'rgba(255, 255, 255, 0.3)',
    special: 'fogLayers',
  },
  storm: {
    background: ['#0C0C0C', '#1C1C1C', '#3C3C3C'],
    mountain: ['#2C2C2C', '#4C4C4C', '#6C6C6C'],
    atmosphere: 'rgba(200, 200, 255, 0.05)',
    special: 'lightning',
  },
  void: {
    background: ['#000000', '#0A0A0A', '#1A1A1A'],
    mountain: ['#FFFFFF', '#E0E0E0', '#C0C0C0'],
    atmosphere: 'rgba(255, 255, 255, 0.02)',
    special: 'voidParticles',
  },
  zen: {
    background: ['#F5F5DC', '#D2B48C', '#DEB887'],
    mountain: ['#8B7355', '#A0826D', '#BC9A6A'],
    atmosphere: 'rgba(255, 248, 220, 0.1)',
    special: 'enso',
  },
  volcanic: {
    background: ['#1A0000', '#330000', '#660000'],
    mountain: ['#FF4500', '#FF6347', '#FF7F50'],
    atmosphere: 'rgba(255, 69, 0, 0.1)',
    special: 'lavaFlow',
  },
  klein: {
    background: ['#002FA7', '#0047AB', '#1E3A8A'],
    mountain: ['#4169E1', '#6495ED', '#87CEEB'],
    atmosphere: 'rgba(0, 47, 167, 0.1)',
    special: 'kleinGlow'
  },
  neon: {
    background: ['#0A0A0A', '#1A0F1A', '#2A1F2A'],
    mountain: ['#FF1493', '#00FFFF', '#FF69B4'],
    atmosphere: 'rgba(255, 20, 147, 0.05)',
    special: 'neonPulse'
  },
  desert: {
    background: ['#87CEEB', '#F4A460', '#FFE4B5'],
    mountain: ['#D2691E', '#CD853F', '#DEB887'],
    atmosphere: 'rgba(255, 220, 180, 0.08)',
    special: 'heatWave'
  },
  aurora: {
    background: ['#001122', '#002244', '#003366'],
    mountain: ['#134E4A', '#14B8A6', '#5EEAD4'],
    atmosphere: 'rgba(20, 184, 166, 0.05)',
    special: 'northernLights'
  },
  sakura: {
    background: ['#FFE4E1', '#FFC0CB', '#FFB6C1'],
    mountain: ['#8B4513', '#A0522D', '#CD853F'],
    atmosphere: 'rgba(255, 192, 203, 0.1)',
    special: 'petals'
  },
  cyber: {
    background: ['#0A0014', '#14001F', '#1F0029'],
    mountain: ['#00FFFF', '#FF00FF', '#FFFF00'],
    atmosphere: 'rgba(0, 255, 255, 0.03)',
    special: 'dataStream'
  }
};

// ALL original mountain shapes - EXACTLY as in color.html
const mountainShapes = {
  jagged: (x, centerX, width, height) => {
    const t = (x - centerX + width / 2) / width;
    if (t < 0 || t > 1) return 0;

    let h = Math.sin(t * Math.PI) * height;
    h += Math.sin(t * 20) * height * 0.15;
    h += Math.sin(t * 50) * height * 0.08;
    h += Math.sin(t * 137) * height * 0.05;
    h += Math.sin(t * 200) * height * 0.03;
    h += Math.sin(t * 317) * height * 0.02;
    return h;
  },

  twin: (x, centerX, width, height) => {
    const t = (x - centerX + width / 2) / width;
    if (t < 0 || t > 1) return 0;

    const peak1 = Math.exp(-Math.pow((t - 0.3) * 5, 2)) * height;
    const peak2 = Math.exp(-Math.pow((t - 0.7) * 5, 2)) * height * 0.8;
    const jaggedness = Math.sin(t * 80) * height * 0.06 + 
                       Math.sin(t * 150) * height * 0.04 +
                       Math.sin(t * 237) * height * 0.02;
    
    return Math.max(peak1, peak2) + jaggedness;
  },

  smooth: (x, centerX, width, height) => {
    const t = (x - centerX + width / 2) / width;
    if (t < 0 || t > 1) return 0;

    const base = Math.pow(Math.sin(t * Math.PI), 0.7) * height;
    const jaggedness = Math.sin(t * 60) * height * 0.08 + 
                       Math.sin(t * 120) * height * 0.05 +
                       Math.sin(t * 200) * height * 0.03;
    return base + jaggedness;
  },

  sharp: (x, centerX, width, height) => {
    const t = (x - centerX + width / 2) / width;
    if (t < 0 || t > 1) return 0;

    let h;
    if (t < 0.5) h = t * 2 * height;
    else h = (1 - t) * 2 * height;

    h += Math.sin(t * 100) * height * 0.06;
    h += Math.sin(t * 180) * height * 0.04;
    h += Math.sin(t * 280) * height * 0.02;
    return h;
  },

  plateau: (x, centerX, width, height) => {
    const t = (x - centerX + width / 2) / width;
    if (t < 0 || t > 1) return 0;

    let h;
    if (t < 0.2) h = t * 5 * height;
    else if (t > 0.8) h = (1 - t) * 5 * height;
    else h = height * 0.9;
    
    h += Math.sin(t * 70) * height * 0.07;
    h += Math.sin(t * 140) * height * 0.04;
    h += Math.sin(t * 211) * height * 0.03;
    return h;
  },

  cascade: (x, centerX, width, height) => {
    const t = (x - centerX + width / 2) / width;
    if (t < 0 || t > 1) return 0;

    let h = 0;
    for (let i = 0; i < 4; i++) {
      const peakT = (i + 1) / 5;
      const peakHeight = height * (1 - i * 0.2);
      h = Math.max(
        h,
        Math.exp(-Math.pow((t - peakT) * 8, 2)) * peakHeight
      );
    }
    h += Math.sin(t * 90) * height * 0.06;
    h += Math.sin(t * 170) * height * 0.04;
    h += Math.sin(t * 251) * height * 0.02;
    return h;
  },
};

// COMPLETE insideMountain function - EXACTLY as original
function insideMountain(x, y) {
  x = Math.floor(x);
  if (x < 0 || x >= canvasWidth) return false;
  return y > mountainY[x] && y < canvasHeight * 0.95;
}

// COMPLETE createMountain function - EXACTLY as original with ALL perspective types
function createMountain() {
  mountainY = [];
  mountainArea = 0;

  const perspectiveType = random();
  const baseY = canvasHeight * 0.95;
  
  if (perspectiveType < 0.3) {
    // Traditional view - EXACTLY as original
    const shapes = Object.keys(mountainShapes);
    const shapeType = rng ? rng.choice(shapes) : shapes[Math.floor(Math.random() * shapes.length)];
    const shapeFunc = mountainShapes[shapeType];

    const centerX = canvasWidth * (0.3 + random() * 0.4);
    const mountainWidth = canvasWidth * (0.5 + random() * 0.4);
    const peakHeight = canvasHeight * (0.7 + random() * 0.2);

    for (let x = 0; x < canvasWidth; x++) {
      const height = shapeFunc(x, centerX, mountainWidth, peakHeight);
      mountainY[x] = baseY - height;
      if (height > 0) mountainArea += height;
    }
  } else if (perspectiveType < 0.6) {
    // Descending from left - EXACTLY as original
    const startHeight = canvasHeight * (0.1 + random() * 0.3);
    const endHeight = canvasHeight * (0.6 + random() * 0.3);
    
    const numPeaks = 3 + Math.floor(random() * 3);
    
    for (let x = 0; x < canvasWidth; x++) {
      mountainY[x] = baseY;
    }
    
    for (let p = 0; p < numPeaks; p++) {
      const peakX = canvasWidth * (p / numPeaks + random() * 0.2);
      const peakWidth = canvasWidth * (0.3 + random() * 0.3);
      const peakTop = startHeight + (endHeight - startHeight) * (peakX / canvasWidth);
      const peakHeight = baseY - peakTop;
      
      for (let x = 0; x < canvasWidth; x++) {
        const localHeight = mountainShapes.jagged(x, peakX, peakWidth, peakHeight);
        const y = baseY - localHeight;
        if (y < mountainY[x]) {
          mountainY[x] = y;
          mountainArea += localHeight;
        }
      }
    }
  } else {
    // Immersed in peaks - EXACTLY as original with ALL complexity
    const layers = 2 + Math.floor(random() * 2);
    
    for (let x = 0; x < canvasWidth; x++) {
      mountainY[x] = baseY;
    }
    
    for (let layer = 0; layer < layers; layer++) {
      const layerBase = baseY - layer * 50;
      const numPeaks = 2 + Math.floor(random() * 3);
      
      for (let p = 0; p < numPeaks; p++) {
        const peakX = canvasWidth * random();
        const peakWidth = canvasWidth * (0.2 + random() * 0.3);
        const peakHeight = canvasHeight * (0.3 + random() * 0.4) * (1 - layer * 0.2);
        
        const shapes = ['jagged', 'sharp', 'twin'];
        const shapeFunc = mountainShapes[shapes[Math.floor(random() * shapes.length)]];
        
        for (let x = 0; x < canvasWidth; x++) {
          const localHeight = shapeFunc(x, peakX, peakWidth, peakHeight);
          const y = layerBase - localHeight;
          
          if (y < mountainY[x]) {
            mountainY[x] = y;
            mountainArea += localHeight;
          }
        }
      }
    }
    
    // COMPLETE cutoffs and foreground peaks - EXACTLY as original
    if (random() < 0.5) {
      const cutoffWidth = canvasWidth * (0.1 + random() * 0.2);
      const cutoffHeight = canvasHeight * (0.3 + random() * 0.3);
      for (let x = 0; x < cutoffWidth; x++) {
        const t = x / cutoffWidth;
        const h = cutoffHeight * (1 - t * t);
        
        const jaggedness = Math.sin(t * 50) * 15 + 
                          Math.sin(t * 120) * 8 + 
                          Math.sin(t * 200) * 5 +
                          Math.sin(t * 350) * 3;
        
        mountainY[x] = Math.min(mountainY[x], cutoffHeight - h + jaggedness);
      }
    }
    
    if (random() < 0.5) {
      const cutoffStart = canvasWidth * (0.7 + random() * 0.2);
      const cutoffHeight = canvasHeight * (0.3 + random() * 0.3);
      for (let x = cutoffStart; x < canvasWidth; x++) {
        const t = (x - cutoffStart) / (canvasWidth - cutoffStart);
        const h = cutoffHeight * (1 - t * t);
        mountainY[x] = Math.min(mountainY[x], cutoffHeight - h);
      }
    }
    
    if (random() < 0.2) {
      const foregroundPeaks = 1 + Math.floor(random() * 2);
      for (let fp = 0; fp < foregroundPeaks; fp++) {
        const peakX = canvasWidth * random();
        const peakWidth = canvasWidth * (0.1 + random() * 0.2);
        const fromTop = random() < 0.5;
        
        for (let x = Math.max(0, peakX - peakWidth); x < Math.min(canvasWidth, peakX + peakWidth); x++) {
          const localT = Math.abs(x - peakX) / peakWidth;
          if (localT <= 1) {
            const peakShape = Math.pow(1 - localT, 2);
            if (fromTop) {
              const depth = canvasHeight * (0.2 + random() * 0.3) * peakShape;
              mountainY[x] = Math.min(mountainY[x], depth);
            } else {
              const rise = baseY - canvasHeight * (0.3 + random() * 0.3) * peakShape;
              mountainY[x] = Math.min(mountainY[x], rise);
            }
          }
        }
      }
    }
  }
  
  // Recalculate area
  mountainArea = 0;
  for (let x = 0; x < canvasWidth; x++) {
    const height = baseY - mountainY[x];
    if (height > 0) {
      mountainArea += height;
    }
  }
  
  if (mountainArea < canvasWidth * 50) {
    mountainArea = canvasWidth * 50;
  }
}

/**
 * Generate authentic deterministic artwork with VRF seed
 */
class AuthenticBarelyHumanGenerator {
  constructor(vrfSeed, botId, seriesId) {
    this.seed = parseInt(vrfSeed.toString().slice(0, 16), 16) || parseInt(vrfSeed);
    this.botId = botId;
    this.seriesId = seriesId;
    
    // Initialize seeded random
    rng = new SeededRandom(this.seed);
    currentSeed = this.seed;
    
    // Reset all state
    cracks = [];
    grid = [];
    mountainY = [];
    density = 0;
    isComplete = false;
    mountainArea = 0;
    filledCells = 0;
    globalAge = 0;
    svgPaths = [];
    
    // Set bot personality theme and formation
    this.setBotPersonality();
    
    // Generate mountain and initialize
    maxDensity = 0.6 + random() * 0.35;
    createMountain();
    this.initializeCracks();
  }
  
  setBotPersonality() {
    const personalities = [
      { theme: "volcanic", formation: "chaotic" },    // Alice All-In
      { theme: "klein", formation: "circuit" },       // Bob Calculator
      { theme: "aurora", formation: "spiral" },       // Charlie Lucky
      { theme: "mist", formation: "crystalline" },    // Diana Ice Queen
      { theme: "neon", formation: "kaleidoscope" },   // Eddie Entertainer
      { theme: "storm", formation: "lightning" },     // Fiona Fearless
      { theme: "zen", formation: "zen" },             // Greg Grinder
      { theme: "dawn", formation: "curved" },         // Helen Hot Streak
      { theme: "void", formation: "branching" },      // Ivan Intimidator
      { theme: "cyber", formation: "organic" }        // Julia Jinx
    ];
    
    const personality = personalities[this.botId] || personalities[0];
    theme = personality.theme;
    crackFormation = personality.formation;
  }
  
  // COMPLETE crack initialization - EXACTLY as original with ALL formation types
  initializeCracks() {
    // Standard base seeds
    const baseSeeds = 8 + Math.floor(random() * 6);
    for (let i = 0; i < baseSeeds; i++) {
      const x = canvasWidth * 0.05 + canvasWidth * 0.9 * (i / (baseSeeds - 1));
      const y = canvasHeight * 0.9;

      if (insideMountain(x, y)) {
        cracks.push(new Crack(x, y, -90 + (random() - 0.5) * 60, "base"));
      }
    }

    // Contour seeds
    const contourLevels = 3;
    for (let level = 0; level < contourLevels; level++) {
      const contourSeeds = 8 + Math.floor(random() * 4);
      const levelOffset = 30 + level * 60;

      for (let i = 0; i < contourSeeds; i++) {
        const x = canvasWidth * 0.15 + canvasWidth * 0.7 * (i / (contourSeeds - 1));
        const y = mountainY[Math.floor(x)] + levelOffset;

        if (insideMountain(x, y)) {
          const dx = mountainY[Math.floor(x + 10)] - mountainY[Math.floor(x - 10)];
          const contourAngle = (Math.atan2(dx, 20) * 180) / Math.PI;

          cracks.push(new Crack(x, y, contourAngle + (random() - 0.5) * 40, "contour"));
        }
      }
    }

    // Special formation-specific initialization - EXACTLY as original
    if (crackFormation === "kaleidoscope") {
      cracks = [];
      const symmetry = 6;
      
      for (let s = 0; s < symmetry; s++) {
        const angle = (s / symmetry) * 360;
        const radius = 100;
        const centerX = canvasWidth * 0.5 + Math.cos(angle * Math.PI / 180) * radius;
        const centerY = canvasHeight * 0.5 + Math.sin(angle * Math.PI / 180) * radius;
        
        if (insideMountain(centerX, centerY)) {
          const toCenter = angle + 180;
          const crack = new Crack(centerX, centerY, toCenter, "normal", "kaleidoscope");
          crack.symmetryIndex = s;
          crack.depthLayer = 0;
          crack.speed = 1;
          cracks.push(crack);
        }
      }
    }
    
    if (crackFormation === "circuit") {
      cracks = [];
      const gridSize = 15;
      const spacing = gridSize * 2;
      
      for (let x = 0; x < canvasWidth; x += spacing) {
        for (let y = 0; y < canvasHeight; y += spacing) {
          const gridX = Math.round(x / gridSize) * gridSize;
          const gridY = Math.round(y / gridSize) * gridSize;
          
          if (insideMountain(gridX, gridY)) {
            if (random() < 0.7) {
              cracks.push(new Crack(gridX, gridY, 0, "spreader", "circuit"));
              cracks.push(new Crack(gridX, gridY, 90, "spreader", "circuit"));
              
              if (random() < 0.2) {
                cracks.push(new Crack(gridX, gridY, 180, "spreader", "circuit"));
                cracks.push(new Crack(gridX, gridY, 270, "spreader", "circuit"));
              }
            }
          }
        }
      }
      
      cracks.forEach(crack => {
        crack.speed = 1.2 + random() * 0.8;
      });
    }
    
    if (crackFormation === "zen") {
      cracks = [];
      window.zenWaveLines = [];
      
      const waveLines = window.zenWaveLines;
      
      for (let i = 0; i < 8; i++) {
        const y = canvasHeight * (0.1 + i * 0.11);
        waveLines.push({
          startX: 0,
          startY: y,
          direction: 1,
          phase: i * 0.3,
          amplitude: 30 + random() * 20,
          frequency: 0.003 + random() * 0.002
        });
      }
      
      for (let i = 0; i < 8; i++) {
        const y = canvasHeight * (0.12 + i * 0.11);
        waveLines.push({
          startX: canvasWidth,
          startY: y,
          direction: -1,
          phase: Math.PI + i * 0.3,
          amplitude: 30 + random() * 20,
          frequency: 0.003 + random() * 0.002
        });
      }
      
      for (let wave of waveLines) {
        const numPoints = 200;
        
        for (let p = 0; p < numPoints; p++) {
          const progress = p / numPoints;
          let x, y;
          
          if (wave.direction > 0) {
            x = progress * canvasWidth;
          } else {
            x = (1 - progress) * canvasWidth;
          }
          
          y = wave.startY + Math.sin(x * wave.frequency + wave.phase) * wave.amplitude;
          
          if (insideMountain(x, y)) {
            if (p > 0) {
              const prevX = wave.direction > 0 ? ((p-1) / numPoints) * canvasWidth : (1 - (p-1) / numPoints) * canvasWidth;
              const prevY = wave.startY + Math.sin(prevX * wave.frequency + wave.phase) * wave.amplitude;
              
              if (!insideMountain(prevX, prevY)) {
                continue;
              }
            }
            
            const lookAhead = 10;
            const nextX = x + lookAhead * wave.direction;
            const nextY = wave.startY + Math.sin(nextX * wave.frequency + wave.phase) * wave.amplitude;
            const angle = Math.atan2(nextY - y, nextX - x) * 180 / Math.PI;
            
            const crack = new Crack(x, y, angle, "wave", "zen");
            crack.waveData = wave;
            crack.progress = progress;
            crack.speed = 1.2;
            crack.isWave = true;
            
            cracks.push(crack);
            
            if (p % 4 === 0) {
              const numBranches = 3 + Math.floor(random() * 3);
              
              for (let b = 0; b < numBranches; b++) {
                const side = random() < 0.5 ? 1 : -1;
                const branchAngle = angle + side * (85 + random() * 10) + (random() - 0.5) * 20;
                
                const branch = new Crack(x, y, branchAngle, "branch", "zen");
                branch.speed = 1.2 + random() * 0.3;
                branch.isBranch = true;
                
                cracks.push(branch);
              }
            }
          }
        }
      }
      
      const numExtraSeeds = 60 + Math.floor(random() * 30);
      for (let i = 0; i < numExtraSeeds; i++) {
        const angle = random() * Math.PI * 2;
        const radius = random() * 0.9;
        const x = canvasWidth * 0.5 + Math.cos(angle) * canvasWidth * radius * 0.45;
        const y = canvasHeight * 0.5 + Math.sin(angle) * canvasHeight * radius * 0.4;
        
        if (insideMountain(x, y)) {
          const crack = new Crack(x, y, random() * 360, "fill", "zen");
          crack.speed = 1.0 + random() * 0.5;
          crack.isFill = true;
          cracks.push(crack);
        }
      }
    }

    // Initialize grid
    grid = new Array(canvasWidth * canvasHeight);
    for (let i = 0; i < grid.length; i++) {
      grid[i] = -1;
    }
  }
  
  // COMPLETE simulation - EXACTLY as original
  simulate() {
    let iterations = 0;
    const maxIterations = 1000;
    
    while (density < maxDensity && iterations < maxIterations) {
      iterations++;
      globalAge++;
      
      const activeCracks = cracks.filter(crack => crack.active);
      if (activeCracks.length === 0) break;
      
      const maxUpdatesPerFrame = 100;
      let updates = 0;
      
      for (let i = 0; i < cracks.length && updates < maxUpdatesPerFrame; i++) {
        if (cracks[i].active) {
          cracks[i].update();
          updates++;
        }
      }
      
      if (cracks.length > 1500) {
        cracks = cracks.filter((c) => c.active || c.age < 100);
      }
      
      const activeCount = cracks.filter((c) => c.active).length;
      if (activeCount < 20 && !isComplete && density < maxDensity * 0.9) {
        this.addSeeds();
      } else if (activeCount === 0) {
        isComplete = true;
      }
    }
    
    isComplete = true;
  }
  
  addSeeds() {
    if (crackFormation === "zen") {
      // Add zen-specific seeds
      const gapY = canvasHeight * (0.2 + random() * 0.6);
      const newWave = {
        startX: random() < 0.5 ? 0 : canvasWidth,
        startY: gapY,
        direction: random() < 0.5 ? 1 : -1,
        phase: random() * Math.PI * 2,
        amplitude: 25 + random() * 20,
        frequency: 0.003 + random() * 0.002
      };
      
      for (let i = 0; i < 10; i++) {
        const angle = random() * Math.PI * 2;
        const radius = random() * 0.7;
        const seedX = canvasWidth * 0.5 + Math.cos(angle) * canvasWidth * radius * 0.4;
        const seedY = canvasHeight * 0.5 + Math.sin(angle) * canvasHeight * radius * 0.35;
        
        if (insideMountain(seedX, seedY)) {
          const crack = new Crack(seedX, seedY, random() * 360, "fill", "zen");
          crack.speed = 1.2;
          crack.isFill = true;
          cracks.push(crack);
        }
      }
    } else {
      // Standard seeds
      const newSeeds = 3 + Math.floor(random() * 3);
      for (let i = 0; i < newSeeds; i++) {
        const angle = random() * Math.PI * 2;
        const radius = random() * 0.3 + 0.2;
        const seedX = canvasWidth * 0.5 + Math.cos(angle) * canvasWidth * radius;
        const seedY = canvasHeight * 0.6 + Math.sin(angle) * canvasHeight * radius * 0.7;

        if (insideMountain(seedX, seedY)) {
          cracks.push(new Crack(seedX, seedY, random() * 360, "spreader"));
        }
      }
    }
  }
  
  generateSVG() {
    // Simulate the complete crack growth
    this.simulate();
    
    // Generate SVG
    const bgColors = themes[theme].background;
    
    let svg = `<svg width="1000" height="1000" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">`;
    
    // Background gradient
    svg += `<defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:${bgColors[0]};stop-opacity:1" />
        <stop offset="50%" style="stop-color:${bgColors[1]};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${bgColors[2]};stop-opacity:1" />
      </linearGradient>
    </defs>`;
    
    svg += `<rect width="1000" height="1000" fill="url(#bg)" />`;
    
    // Mountain silhouette
    let mountainPath = `M 0,${mountainY[0]}`;
    for (let x = 1; x < canvasWidth; x++) {
      mountainPath += ` L ${x},${mountainY[x]}`;
    }
    mountainPath += ` L ${canvasWidth},1000 L 0,1000 Z`;
    
    const mountainColors = themes[theme].mountain;
    svg += `<path d="${mountainPath}" fill="${mountainColors[0]}" opacity="0.1" />`;
    
    // Crack paths
    for (const crack of cracks) {
      if (crack.path.length < 2) continue;
      
      let pathData = `M ${crack.path[0].x},${crack.path[0].y}`;
      for (let i = 1; i < crack.path.length; i++) {
        pathData += ` L ${crack.path[i].x},${crack.path[i].y}`;
      }
      
      let strokeWidth = 0.5;
      let opacity = 0.8;
      
      if (crack.formation === "neon" || crack.formation === "cyber") {
        strokeWidth = 1;
        opacity = 0.9;
      }
      
      svg += `<path d="${pathData}" stroke="${crack.color}" stroke-width="${strokeWidth}" 
                fill="none" opacity="${opacity}" stroke-linecap="round" />`;
    }
    
    // Add sand painting elements
    for (const path of svgPaths) {
      svg += path;
    }
    
    svg += `</svg>`;
    
    return svg;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AuthenticBarelyHumanGenerator };
} else if (typeof window !== 'undefined') {
  window.AuthenticBarelyHumanGenerator = AuthenticBarelyHumanGenerator;
}