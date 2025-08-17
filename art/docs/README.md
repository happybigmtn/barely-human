# Barely Human - Deterministic Generative Art System

A sophisticated generative art system that creates unique NFTs based on VRF seeds and bot personalities, inspired by the substrate-style crack formation algorithms.

## Overview

This system generates deterministic artwork where each piece is:
- **Reproducible**: Same seed + bot + series = identical artwork
- **Personality-Driven**: Each of 10 AI bots has unique visual styles
- **On-Chain Compatible**: SVG format suitable for blockchain storage
- **Rarity-Based**: Traits system with weighted rarity distribution

## Architecture

```
art/
├── deterministic-generator.js    # Core art generation engine
├── nft-integration.sol          # Smart contract for on-chain NFTs
├── art-generation-service.js    # Server-side API service
├── web-preview.html            # Browser-based preview interface
└── README.md                   # This file
```

## Bot Personalities & Styles

| Bot ID | Name | Theme | Formation | Style Description |
|--------|------|-------|-----------|------------------|
| 0 | Alice "All-In" | Volcanic | Chaotic | Explosive & aggressive patterns |
| 1 | Bob "Calculator" | Klein Blue | Circuit | Mathematical precision |
| 2 | Charlie "Lucky" | Aurora | Spiral | Mystical flowing energy |
| 3 | Diana "Ice Queen" | Mist | Crystalline | Cold geometric perfection |
| 4 | Eddie "Entertainer" | Neon | Kaleidoscope | Theatrical vibrant display |
| 5 | Fiona "Fearless" | Storm | Lightning | Dynamic bold strikes |
| 6 | Greg "Grinder" | Zen | Zen | Meditative steady growth |
| 7 | Helen "Hot Streak" | Dawn | Curved | Flowing energetic momentum |
| 8 | Ivan "Intimidator" | Void | Branching | Dark menacing fractals |
| 9 | Julia "Jinx" | Cyber | Organic | Chaotic unpredictable forms |

## Rarity System

### Trait Categories
- **Density**: Sparse (40%), Moderate (35%), Dense (20%), Maximum (5%)
- **Complexity**: Simple (30%), Moderate (40%), Complex (25%), Legendary (5%)
- **Special Features**: None (60%), Environmental (25%), Mystical (10%), Legendary (5%)
- **Color Variation**: Monochrome (30%), Subtle (40%), Vibrant (25%), Rainbow (5%)

### Rarity Calculation
Rarity scores range from 0-100, with higher scores indicating rarer combinations of traits.

## Usage

### 1. Direct Generation (Browser)

```html
<script src="./deterministic-generator.js"></script>
<script>
// Generate art from VRF seed
const artwork = BarelyHumanArt.ArtGeneratorUtils.generateFromVRF(
    "0x123456789abcdef0", // VRF seed
    0,                    // Bot ID (Alice)
    1                     // Series ID
);

console.log(artwork.svg);      // SVG artwork
console.log(artwork.metadata); // NFT metadata
console.log(artwork.traits);   // Rarity traits
</script>
```

### 2. Server-Side API

```javascript
const { ArtGenerationService } = require('./art-generation-service.js');

const service = new ArtGenerationService({
    rpcUrl: 'https://base-sepolia.infura.io/v3/YOUR_KEY',
    privateKey: 'YOUR_PRIVATE_KEY',
    contractAddress: '0x...',
    outputDir: './generated-art'
});

// Generate and mint NFT
const result = await service.generateAndMint(
    '0x123456789abcdef0', // VRF seed
    0,                    // Bot ID
    1,                    // Series ID
    '0x...'              // Recipient address
);
```

### 3. Smart Contract Integration

```solidity
import "./nft-integration.sol";

contract GameContract {
    BarelyHumanGenerativeArt public artContract;
    
    function mintArtFromVRF(
        uint256 vrfSeed,
        uint8 botId,
        uint256 seriesId,
        address winner
    ) external {
        // Generate artwork off-chain using vrfSeed
        // Then call artContract.mintGenerativeArt(...)
    }
}
```

## Web Preview Interface

Open `web-preview.html` in a browser to:
- Select different bot personalities
- Enter custom VRF seeds or generate random ones
- Preview artwork generation in real-time
- Download SVG files
- View rarity scores and traits

## API Endpoints

When using the art generation service:

- `POST /generate` - Generate and mint single NFT
- `POST /batch-generate` - Batch generate multiple NFTs
- `POST /preview` - Generate preview without minting
- `GET /token/:id` - Get token information
- `POST /verify/:id` - Regenerate and verify artwork
- `GET /stats` - Service statistics
- `GET /health` - Health check

## Technical Details

### Deterministic Generation
- Uses seeded random number generator for reproducibility
- All randomness derived from initial VRF seed
- Same inputs always produce identical outputs

### SVG Optimization
- Multiple compression levels (low, medium, high)
- Optimized for on-chain storage
- Maintains visual quality while minimizing size

### Formation Algorithms
Each bot uses different crack formation algorithms:
- **Circuit**: Grid-based traces with 90° turns
- **Crystalline**: Faceted growth with angle snapping
- **Zen**: Wave-based substrate patterns
- **Lightning**: Sharp zigzag branching
- **Organic**: Natural growth with smooth curves
- **Kaleidoscope**: Symmetric radial patterns
- **Chaotic**: High-entropy unpredictable movement

### Color Palettes
Each bot has personality-specific color palettes:
- Fire colors for aggressive bots
- Cool blues for analytical bots
- Earth tones for steady bots
- Neon colors for flashy bots

## Integration with Barely Human Casino

1. **VRF Integration**: Uses Chainlink VRF seeds from game results
2. **Bot Personality**: Artwork reflects the winning bot's characteristics
3. **Series Tracking**: Each game series can generate unique artwork
4. **Rarity Distribution**: Ensures balanced rarity across all generations
5. **On-Chain Storage**: Full metadata and artwork stored on blockchain

## Dependencies

### Browser
- No external dependencies (pure JavaScript)

### Node.js
```json
{
  "ethers": "^5.7.0",
  "express": "^4.18.0"
}
```

### Smart Contract
```json
{
  "@openzeppelin/contracts": "^4.9.0"
}
```

## Development

### Running the Preview
```bash
# Serve locally
python -m http.server 8000
# or
npx serve .

# Open browser to localhost:8000/web-preview.html
```

### Running the API Service
```bash
npm install
node -e "
const { ArtGenerationService, createArtAPI } = require('./art-generation-service.js');
const express = require('express');

const app = express();
app.use(express.json());

const service = new ArtGenerationService({
    rpcUrl: 'http://localhost:8545',
    privateKey: process.env.PRIVATE_KEY,
    contractAddress: process.env.CONTRACT_ADDRESS
});

app.use('/api/art', createArtAPI(service));
app.listen(3000, () => console.log('Art API running on port 3000'));
"
```

### Testing Generation
```bash
# Test individual components
node -e "
const { BarelyHumanArtGenerator } = require('./deterministic-generator.js');
const generator = new BarelyHumanArtGenerator(12345, 0, 1);
console.log('Generated traits:', generator.traits);
console.log('SVG length:', generator.generateSVG().length);
"
```

## Security Considerations

1. **Deterministic Verification**: All artwork can be regenerated and verified
2. **Seed Validation**: VRF seeds are validated before generation
3. **On-Chain Storage**: Artwork permanently stored on blockchain
4. **Access Control**: Role-based minting permissions
5. **Pausable**: Emergency pause functionality

## Performance

- **Generation Time**: ~50-200ms per artwork
- **SVG Size**: 5-50KB depending on complexity
- **Gas Usage**: ~200-500K gas per mint (including SVG storage)
- **Batch Efficiency**: Up to 50 NFTs per transaction

## Future Enhancements

1. **Animation**: SVG animations based on bot behavior
2. **3D Variants**: Three.js integration for 3D artwork
3. **Interactive Elements**: User-controllable parameters
4. **Cross-Chain**: Multi-chain deployment with unified metadata
5. **AI Evolution**: Bots that learn and evolve their art styles

## License

MIT License - Built for the Barely Human DeFi Casino project.