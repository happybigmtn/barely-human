# Barely Human – LLM Implementation Blueprint

## Section 1: Smart Contract Architecture (Solidity 0.8.31)

### BOT ERC20 Token
The platform's governance and fee-sharing token, BOT, will be a standard ERC20 with added features for controlled supply. A fixed initial supply can be minted to fund initial liquidity and rewards, while an emission schedule (if inflationary) is handled via the token's owner or a distributor contract. The BOT token contract will include roles for a Treasury and a Staking Rewards distributor. Key functions and features:

**Minting & Emission Control**: If new BOT tokens are released over time, a time-locked emissionMint() function (callable only by the Treasury or an owner) will mint according to the predefined schedule (e.g. linear release or halving periods). Emissions could also be funneled as staking incentives instead of open market. In absence of inflation, the total supply is fixed and minted upfront, allocated to development, rewards, and liquidity.

**Fee Reception**: The BOT contract itself doesn't charge transfer fees (keeping it standard ERC20 for broad compatibility). Instead, fee extraction is handled at the swap level via Uniswap v4 hooks to divert a portion of each swap into the Treasury/staking pool. This means BOT transfers remain normal, but when traded on the designated pool, 2% of swap value is skimmed.

**Treasury Logic**: A designated Treasury address (multi-sig or smart contract) will collect fees (swap fees and performance fees from vaults). This Treasury can hold BOT or base assets and periodically distribute or swap them for BOT to reward stakers. The Treasury contract may include functions like swapFeesToBOT() and distributeRewards() to convert collected fees into BOT and allocate to staker reward pools.

### Vault-Style Escrow Contracts (Per Bot Bankroll)
Each autonomous bot (AI gambler) is backed by a liquidity pool of funds contributed by LPs (liquidity providers). We implement this as either a single Vault contract factory or a master contract managing multiple bot vaults via mappings. For clarity and isolation, a separate Vault contract is instantiated per bot. These vaults accept deposits (e.g. in USDC or ETH on Base/Unichain) and issue shares to LPs, tracking each LP's contribution and entitlement. The vault holds the bankroll that the bot uses to bet, and all wins/losses are reflected in the vault's balance, affecting the share value pro-rata. Key mechanics for the Vault contract:

**Deposits & Withdrawals**: Functions deposit(amount) and withdraw(shares) allow LPs to join or exit a bot's bankroll. When depositing, the vault mints new share tokens (ERC20 representing vault shares) to the user based on current share price. On withdraw, it burns the shares and transfers the proportional underlying assets. Withdrawals might be restricted to non-active betting periods (e.g. only between game series) to simplify accounting during bets.

**Share Accounting**: The vault's share price increases or decreases as the bot wins or loses. Initially, 1 share might equal 1 unit of underlying asset. If the bot doubles the money, share price doubles (so LPs profit), if it loses 50%, share price halves (LPs bear loss). This ensures wins/losses are shared pro-rata among LPs. No individual LP profit-taking is possible except via shares redemption.

**Performance Fee**: To incentivize the protocol, a performance fee on profits is taken. For example, after each series, if the vault's balance exceeds the sum of deposits (i.e. profit was made), the vault skimmes X% of the profit and transfers it to the Treasury before updating share price. This is analogous to a hedge fund's carry fee. If no profit (or a loss), no fee is taken. This logic occurs at series settlement so that long-term LPs only pay fees on net positive performance.

**Bot Bankroll Access**: The vault contract is the custodian of funds and must provide the bot (or betting coordinator contract) the ability to use funds for bets. We implement an internal function like placeBet(uint amount) that can only be called by the authorized Betting Coordination contract or the bot's own agent via a controlled plug-in. This function would lock the bet amount until outcome is resolved, preventing withdrawal of those funds mid-bet. After a bet is resolved, a settleBet(winAmount) function is called to update the vault balance (either subtracting a loss or adding winnings). This ensures funds never leave the vault; bets are resolved by updating internal accounting.

### Betting Coordination & Series Tracking
To manage the game flow (craps rounds) on-chain, we introduce a GameCoordinator contract (or the vault itself can include game logic). Each bot plays a repeated series of craps games, called series or epochs. A series consists of one or more dice rolls until conclusion (win or lose). We use Chainlink VRF for provably random dice outcomes, ensuring fairness and unpredictability. The coordination logic handles requesting randomness, receiving results, and determining game outcomes:

**Series State**: Each vault or bot has a state: idle or in an active series. A series may have a unique ID or epoch counter. We store for the current series: the bet amount, the "point" number if one is established, and any intermediate results. We also store a mapping of Chainlink VRF request IDs to the bot/vault and game state, so the fulfill callback knows which game to resolve.

**Starting a Series**: A function startSeries(uint256 betAmount) begins a new game for a bot. This can be called by the bot's agent (off-chain through a transaction) or automated if we want continuous play. It requires the vault has at least betAmount available. The function locks the bet amount and triggers the first dice roll by requesting randomness from VRF (e.g. call Chainlink's requestRandomWords()).

**Dice Roll Resolution**: When Chainlink VRF responds, the fulfillRandomWords callback in our contract fires. It calculates a dice outcome from the random value (e.g. two 1–6 dice). We then apply craps rules: if it's the first roll of a series and the result is 7 or 11 (win) or 2, 3, 12 (loss), the game ends immediately; otherwise, any other number becomes the "point" and the game continues. In case of a continued game, we store the point and use the VRF randomness to immediately simulate subsequent rolls or request new random numbers for each roll (for transparency). Repeated calls to VRF (or using multiple random words at once) continue until a terminating condition (rolling the point again (win) or a 7 (lose)) occurs. All VRF requests use the same subscription for efficiency, and our coordinator contract ensures only the intended functions handle the callback.

**Payout and Series End**: When a series concludes, the outcome (win or loss) is applied to the vault's funds. For a win, the vault gains an amount (depending on odds; assuming even payout for simplicity, a win might double the bet or follow actual craps payout rules if different). For a loss, the bet amount is deducted (already locked). We then emit an event SeriesResult(botId, seriesId, outcome, netPayout) for record-keeping (used by The Graph indexing). If a profit was made, a performance fee is calculated and sent to Treasury before finalizing vault balances. Finally, the series is marked complete and the vault is unlocked for LP withdrawals again.

**Continuous Play & Epoch Logic**: Each bot can automatically start a new series after one completes. This can be done by the coordinator contract itself (after a short delay, it calls startSeries again using an authorized keeper role or a server-side trigger) so the bots play autonomously. We maintain an epoch counter per bot to identify series number. Optionally, a cooldown or configurable delay between series can be set to pace the game and allow new LP deposits or withdrawals.

### Chainlink VRF Integration
Using Chainlink VRF v2 ensures each dice roll and raffle drawing is provably fair. We will create a single VRFConsumer implementation (possibly in the GameCoordinator or inherited by each Vault) with a known subscription ID funded in LINK. The VRF callback (fulfillRandomWords) processes randomness for two purposes: game dice outcomes and NFT raffle winners. The random results are used in-contract to decide outcomes so that all participants can verify the fairness (Chainlink provides cryptographic proof on-chain). This approach prevents any manipulation by bots or devs in determining wins/losses or lottery results.

**For dice**: We convert the VRF's 256-bit random output into two 1–6 dice by using modulo arithmetic (taking care to use a uniform mapping). For example, dice1 = (rand % 6) + 1; rand >>= 8; dice2 = (rand % 6) + 1; ensuring each roll is uniformly random. This yields the dice sum and specific values for richer game logic if needed.

**For raffle**: See Gacha contract below, but essentially we use a VRF random number to pick a winner among LPs, providing the same level of verifiable fairness as above.

### Staking Contract for BOT Rewards
To reward long-term supporters, BOT holders can stake their tokens in a StakingPool contract to receive a share of platform fees (from swaps and performance fees). The staking contract is single-token staking (only BOT is staked) and periodically receives reward infusions from the Treasury. Key points for staking:

**Staking & Unstaking**: Users deposit BOT via stake(amount) which locks their tokens and updates their stake balance. An unstake(amount) function allows withdrawal after an optional minimum lock period (if we impose one, e.g. to discourage quick in-out around rewards snapshots).

**Reward Tracking**: The contract employs an accumulative reward per share model. When the Treasury sends rewards (in whatever asset, but likely as BOT or converted to BOT) to the staking contract, it calls a function notifyReward(uint amount) which adds new reward and increases a global rewardPerStake accumulator (e.g. rewardPerStake += amount / totalStaked). Each staker has a stored value of rewardPerStake at time of staking to compute their earned portion.

**Earning Claim**: Users can call claimRewards() to harvest any accumulated BOT rewards. The contract calculates the user's pending reward = (currentRewardPerStake - user.lastRewardPerStake) * user.stakeAmount. This amount is transferred to the user (in BOT). Claiming updates the user's last recorded reward pointer to current.

**Fee Sources**: The rewards come from two main sources: (a) Swap Fee Share – Every time BOT is traded on Uniswap v4, the 2% fee is sent to the Treasury. The Treasury can periodically transfer accumulated fees to the staking contract (or directly call notifyReward). (b) Performance Fee Share – As vaults generate profits and pay performance fees to Treasury, those fees (in the base asset or converted to BOT) also get funneled into the staking reward pool. The result is that staking yields are tied to platform success: more volume and more bot winnings increase staker rewards.

**Governance & Parameters**: The staking contract might allow the Treasury or governance to adjust parameters like reward distribution frequency or even allocate a portion of fees to other uses (development or buyback). For simplicity, we assume all fee flows to stakers after treasury takes any cut for operations.

**Security Considerations**: We will ensure the staking contract cannot be abused (e.g. protect against reentrancy in reward claiming, and use OpenZeppelin libraries for safe math and ERC20 transfers). Additionally, the BOT token contract should pre-approve the staking contract if it needs to pull rewards; alternatively, the Treasury explicitly transfers tokens.

### Gacha NFT Raffle Contract (Mint Passes)
After each game series ends, an NFT Mint Pass is awarded to one lucky LP of that bot's vault. This is implemented via a Gacha (lottery) contract that works closely with the Vaults and VRF. The Mint Pass itself is a ERC721 NFT representing the right to mint the generative art piece for that series/bot. Key mechanics and functions in the raffle contract:

**Ticket Calculation**: Each LP in the winning bot's vault at the time of series completion is automatically entered into the raffle. The chance is weighted by their share of the vault. For fairness, if Alice contributed 10% of the bankroll and Bob 5%, Alice should be twice as likely to win as Bob (assuming both remained through the series). We achieve this by using each LP's number of vault shares (or stake amount) as lottery "tickets".

**Triggering the Draw**: When a series ends, the GameCoordinator or vault contract calls the Gacha contract's drawWinner(botId, seriesId, bytes32 vrfRequestId) function (or the Gacha contract itself listens for a SeriesResult event via The Graph or an off-chain service, then initiates the draw on-chain). The Chainlink VRF random number for that series (or a fresh one) is used to pick the winner. We can either reuse the final dice roll randomness or request a separate VRF number to ensure independence; using a separate VRF call is more transparent (so no one can foresee the raffle outcome even if they somehow knew game RNG).

**Winner Selection**: Given a random number and the list of participants with weights, the contract computes a winner. One efficient approach on-chain is to use a cumulative distribution: iterate through LPs summing their share weights until the sum exceeds random % totalWeight. The LP where this threshold is crossed is the winner. This requires iterating through LPs stored in the vault. If the number of LPs is large, this could be costly; to mitigate, we can maintain a lightweight list of LP addresses in the vault contract and possibly limit entry/exit to between series to keep list stable. Since Base and Unichain likely have moderate costs, we design with an assumption of manageable LP counts per bot (or optimize with binary search if we keep a sorted cumulative array). The selection process is verifiable – anyone can recalc off-chain that the picked address indeed corresponded to the random draw.

**Mint Pass NFT**: Once a winner address is determined, the Gacha contract mints a new ERC721 token – the Mint Pass – to that address. This NFT's metadata will include attributes identifying which bot and which series it came from (e.g. token name "Barely Human – Bot5 Series12 Mint Pass"). The token could also embed the art seed or reference to it if we want each pass to effectively carry the generative art. However, we may treat the pass as a claim token: the holder can later redeem it for the actual art NFT. We will number these NFTs sequentially or by series.

**Repeat Winners Allowed**: The system does not restrict the same address from winning multiple times. If an LP stays invested across many series (or has multiple vault positions), they could win multiple passes purely by chance. This is intentional to reward loyal LPs and add excitement (someone could build a collection of passes).

**Series Tie-in**: Each series triggers at most one mint pass. The raffle can be seen as tied to series completions – no series goes without either a win/loss (which always happens) and a subsequent NFT draw. If a series is a loss, there's still a draw (the NFT reward is independent of gambling outcome).

**Edge Cases**: If no LPs (besides maybe the bot's own bankroll, if any) are present, the draw can skip or award to a default (though realistically there should be LPs if the bot has funds). We'll include a check: only run the draw if at least one LP (non-zero weight) exists. If a bot's bankroll was completely empty or only protocol-owned, the mint pass might go to the Treasury for future giveaways.

By the end of Section 1, we have an on-chain system where BOT tokens govern value flow, LP vaults hold and distribute gambling profits, bets are resolved with on-chain randomness, stakers earn fees, and NFT mint passes are given out to participants in a provably fair way. All contracts will be written in Solidity 0.8.31, benefiting from built-in overflow checks and the latest features. We'll leverage well-vetted libraries (OpenZeppelin for ERC20, ERC721, and perhaps VRFConsumerBaseV2 from Chainlink). The modular design (separate contracts for token, vault, game coordination, staking, raffle) keeps each piece upgradeable or replaceable via governance if needed, and helps the LLM or developers focus on one module at a time.

## Section 2: Generative Art and Mint Passes

### On-Chain Deterministic Generative Art
The Barely Human project will create unique generative art pieces tied to each bot and series, using a deterministic algorithm ported from our genExplorations/color.html prototype. The goal is to have each art piece reproducible purely from a seed (e.g. the random hash of the series or the VRF outcome) so that the image can be regenerated exactly from on-chain data. We will adapt the existing HTML/JS code to a format suitable for on-chain storage or on-demand rendering. Key steps in this adaptation:

**Modularizing color.html**: The original generative script (presumably producing a visual based on color patterns) will be refactored into a pure function of a random seed. All randomness in the artwork must come from a pseudo-random number generator (PRNG) that we can seed with a known value. For example, implement a simple deterministic PRNG (like a linear congruential generator or XORShift) initialized with the series' VRF random number or the block hash of the mint. This ensures repeatability: given the same seed, the same sequence of "random" artistic decisions is made every time. We replace any calls to Math.random() or time-based variation with our seeded RNG. The code already uses a SeededRandom in places (as noted in dev logs), which we will leverage to guarantee deterministic outputs.

**On-Chain Compatibility**: We have two main approaches to integrating this art generation with the blockchain:

**Fully On-Chain (Stored Code)**: We can store the art generation code (JavaScript or WebAssembly) directly in the NFT contract (often via base64-encoding it in the contract's source or as a constant string in the token URI). For example, the ERC721's tokenURI(tokenId) can return a data:text/html;base64,XYZ... URI that contains an HTML page or SVG. The HTML would have a script that reads the token's seed (which could be encoded in the fragment or fetched via an injected JSON) and then draws the image on a canvas. This way, the art is permanently stored on-chain and anyone can view it by simply opening the tokenURI. We will compress and optimize color.html (possibly using a minifier or even converting to a pure SVG if feasible) to ensure it stays within contract size limits. Techniques like using <svg> with inline script or purely SVG instructions can help. The output might be a static SVG if the art can be vectorized, or a bitmap (canvas) drawn via script – in the latter case the tokenURI HTML would contain the script and maybe a base64 PNG generation.

**External Rendering Pipeline**: If the code is too heavy to fit on-chain or uses complex libraries (like canvas operations) that are hard to encode in pure on-chain data, we'll opt for an off-chain rendering service. In this model, the NFT's metadata (perhaps stored on IPFS or returned by a server) contains the seed and maybe a low-size description, and an external render server hosts an API that given a token ID or seed returns the actual image (PNG or SVG). The token's metadata image field could be a URL pointing to our server or a content-addressed IPFS link that our pipeline populates. The trade-off is reliance on an off-chain component, but we will mitigate with open-sourcing the renderer and ensuring anyone can reproduce the art with the code and seed (so the NFT is trustlessly verifiable). The metadata JSON itself can be stored on-chain (via base64) with just the seed and perhaps a link to the open-source script, to prove the attributes, while the heavy image data is fetched as needed.

We will decide between these approaches based on size constraints. If color.html and its dependencies can be trimmed to, say, <24KB, on-chain base64 might be viable. Otherwise, we store critical parameters on-chain and use a known off-chain renderer. Either way, the generation is deterministic and tied to on-chain seed, ensuring authenticity.

### Bot-Specific Generative Styles
Each bot has a unique personality, and we want their art to reflect that individual style. We will introduce stylistic variations in the generative algorithm keyed by the bot's ID or personality traits. For example, if one bot is aggressive and "fiery", its art might favor sharp angles and warm color palettes, whereas a calm, methodical bot might produce cooler tones and symmetric patterns. Implementation details:

We create a mapping or function styleForBot(botId) that returns parameters controlling the art. These parameters could include color scheme presets, shape or pattern preferences, complexity or "wildness" of the output, etc. For instance, bot #3 might have palette = ["#FF0000", "#FFA500", "#FFD700"] (fiery colors) and use chaotic line strokes, while bot #7 uses palette = ["#0040FF", "#40A0FF"] (cool blues) and geometric patterns. The genExplorations/color.html code likely has configurable aspects (like different theme definitions or shape modes); we will extend or tweak those to be bot-dependent. We can maintain an on-chain list of styles, possibly in the NFT contract as an array of JSON or in the code as a switch on botId.

The personality traits from ElizaOS (like "artist", "gambler", "stoic", "erratic") can inform these parameters. We might, for fun, incorporate the bot's performance or mood into the art: e.g. if a bot just won big, the art might be extra vibrant; if it lost, maybe a darker variation. However, since the art is typically generated at series end using predetermined seed, we can't easily incorporate win/lose (unless we include outcome as part of the seed, but that would reduce randomness fairness). Instead, we'll keep it simpler: static style per bot, so that over time you can recognize which bot's art is which by style.

By doing this, each bot produces a cohesive art series. Collectors might favor a particular bot's aesthetic. It also ties into narrative – e.g. a bot named "Neon Zen" produces neon-colored calm scenes, whereas "Glitch" bot yields unpredictable glitch-art patterns.

### Gacha Raffle Logic (Revisited in Art Context)
The raffle from Section 1 yields the Mint Pass NFT. Now we explain how that pass is used in the art minting flow:

**Mint Pass Structure**: The Mint Pass itself is an ERC721 token with minimal metadata at issuance – basically identifying the bot and series. We may not immediately attach the final artwork to it because generation might occur later (either on redemption or right after win). There are two possible flows:

**One-step (Automatic Mint)**: As soon as a winner is determined, instead of a generic "pass", we directly mint the final NFT art to the winner. This would mean the Gacha contract calls the art NFT contract to mint a new NFT with the art. That simplifies things (no redemption needed). However, the prompt calls it a "mint pass", implying a separate step.

**Two-step (Mint Pass + Redemption)**: We mint a Mint Pass NFT to the winner. This pass can then be redeemed for the actual art NFT in a separate contract or function. For example, we deploy a GenerativeArtNFT contract that will mint the final pieces. A function redeem(passId) on the art contract (or on the pass contract) burns the pass and mints the art NFT to the holder. We would likely allow redemption after the series is over (immediately or maybe after all series if we wanted a big reveal, but better to allow right away to engage users).

**Weighted Random Draw Implementation**: As mentioned, the raffle chooses winners with weight proportional to LP share. The actual code within the Gacha contract might look like:

```solidity
function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
    VRFRequest storage req = requests[requestId];
    if(req.requestType == RequestType.Raffle) {
        uint256 rand = randomWords[0];
        Vault vault = Vault(req.vaultAddress);
        uint256 totalWeight = vault.totalShares(); 
        uint256 winningTicket = rand % totalWeight;
        address winner = vault.findShareHolderByTicket(winningTicket);
        _mintMintPass(winner, req.botId, req.seriesId);
    }
    // ... handle game randomness similarly
}
```

Here findShareHolderByTicket would iterate as described or use a precomputed array of cumulative weights. This shows how VRF ties directly into the on-chain selection and NFT minting.

**Repeat Winners & Fairness**: We explicitly allow repeat winners (no blacklist of previous winners). Each series is an independent lottery. Over many trials, LPs with more weight will win more on average, but randomness could favor someone streakily – which is part of the fun. Chainlink VRF ensures even the devs or bots cannot bias this selection. Every LP has a chance every time as long as they are in the pool.

### NFT Minting Strategy
Once a Mint Pass is won (or when it's redeemed), the actual generative art NFT is produced. We need a strategy for the NFT's metadata and image:

**Metadata Fields**: The NFT (be it the Mint Pass or final art) will include properties such as bot name/ID, series number, and potentially some generated "trait" data from the art. For example, the art code might produce certain descriptive traits (color theme, number of iterations, pattern type) which we can store in the NFT metadata JSON so that marketplaces display them (e.g. "Palette: Sunset Red", "Pattern: Chaotic Cracks"). This adds collectible insight (similar to how generative art platforms list traits and rarities). We can extract these from the algorithm deterministically (since the art generation knows what it created based on the seed).

**On-Chain vs Off-Chain Media**: As discussed, an all on-chain approach means putting the image or drawing instructions directly in the contract. One common method is to use SVG images encoded as base64 data URIs. If our art can be rendered in SVG (some generative art uses lines, curves, shapes that can be SVG paths), we might translate the outcome to an SVG and store that. If the art is raster/canvas-based, an alternative is to store the JavaScript that generates it and use a data: HTML. We will ensure any such data URI is under the size limits (a single on-chain transaction can store a few hundred kB at most, but ideally much less for gas reasons). A highly compact possibility is to encode just the seed and have a known script (like referencing a well-known library or CDN script) – but that introduces external dependency, so better to include everything self-contained.

**Lazy Rendering Option**: If fully on-chain is infeasible, we might use a hybrid: The NFT's tokenURI returns a JSON with an image field pointing to a secure URL (like https://barelyhuman.art/metadata/{id}.png). Our backend will serve a static image generated for that token. To maintain decentralization, we could also push the images to IPFS after generation and use an IPFS URI (this requires generation to happen once – likely at mint time or shortly after). Because our art is deterministic, we can even allow anyone to call a function generateArt(tokenId) that computes the image hash and stores an IPFS hash on chain, if we want a trustless record.

**Mint Pass Redemption (if used)**: The redemption could be a transaction where the holder of the pass calls redeem(). The contract will then pick a seed for the art. Ideally, the seed is already known (we would use the series VRF as seed so the art is actually already determined at the moment of win). If that VRF random number is used, the art could be minted without additional randomness. Alternatively, we could generate a new random seed on redemption (but then the minter might attempt to redo if not satisfied, unless it's VRF-provided and one-time). Better to bind the art to the original series seed for immutability. So each Mint Pass carries a seed or the info needed to derive it (like series ID + bot ID which map to a VRF outcome stored in an event or accessible in contract storage). The art contract then uses that to mint the final piece.

**NFT Contract Setup**: We might have one ERC721 contract for all final art NFTs across all bots and series (with token IDs perhaps composed as (botId, seriesId) or just sequential as they are redeemed). Alternatively, we could incorporate the functionality into the Mint Pass contract and upgrade tokens in-place (but standard practice is separate contracts for passes vs final art for clarity). We'll likely name the art collection something like "Barely Human – Bot Art" and token metadata will include the bot name (like "Bot Alice – Series 12 Artwork"). The contract will implement the standard functions and perhaps use ERC721Enumerable if we need indexing (though The Graph can index events too).

**Integration with Marketplaces**: By following ERC721 metadata standards and including an image URL or data, we ensure compatibility with OpenSea and others. For OpenSea in particular, since they have Metadata Crawlers, if we use a tokenURI that returns JSON, they will fetch it and cache the image. If we go fully on-chain (data URI), OpenSea will display that automatically. We just need to make sure the metadata JSON has the required fields (name, description, image, and perhaps attributes array for traits).

**Mint Pass as Collectible**: One nuance: the Mint Pass itself could be considered a collectible if people trade them before redemption (maybe someone might sell a Mint Pass if they'd rather have money than the art). We should allow transfers of Mint Pass NFTs. Once redeemed, we'll burn them (emitting a Transfer to 0x0 event which OpenSea interprets as "burned"). We should also freeze redemption after use. If a pass is never redeemed, it still exists as a token – possibly as a memento. (We might decide to automatically redeem after some time, but better is to leave it to user; some might value the pass as is.)

To summarize, in Section 2 we marry the on-chain outcomes to visual art. Each series yields an NFT art piece with unique style influenced by the bot personality, generated via a deterministic algorithm adapted from our generative experiments. The NFTs can either be fully on-chain (for permanence) or use a hybrid on-chain/off-chain approach for heavy content, but either way the content is provably tied to an on-chain random seed so it's verifiable. The Gacha system ensures a fair distribution of these art pieces to the community (like a lottery reward), adding an NFT collectible layer to the gambling platform. This approach mirrors the success of projects like BAYC's serum drop and Art Blocks style generative art, combining them in a novel way (random chance to win an art mint). The smart contracts for NFTs will be written to align with Base and Unichain standards, likely using the latest OpenZeppelin ERC721 implementation.

## Section 3: Agent Personalities via ElizaOS

### Multi-Agent Persona System (ElizaOS)
We will leverage ElizaOS (an open-source multi-agent framework) to create the ten AI agent personalities that run the Barely Human bots. Each bot agent represents a unique character with a distinct gambling style and personality, providing entertaining interactions and decision-making quirks. Using ElizaOS, we define each agent in a character file capturing their bio, traits, and behavior rules. Key steps and features in setting up these personalities:

**Defining Bios and Traits**: For each of the 10 bots, we write a biography/background that gives context. For example, one bot might be described as "A former casino croupier turned AI who loves high-risk bets and speaks in Las Vegas lingo", while another is "A meticulous statistician bot that calculates odds coldly and speaks formally." These bios guide the LLM in role-playing the character. We also list specific traits like aggressive, cautious, cheerful, sarcastic, superstitious, etc., which influence how the bot reacts to wins, losses, or conversations. These can be encoded as a list in the character config (ElizaOS supports YAML or JSON character definitions including personality traits and initial prompts).

**Dialogue Style and Tone**: Each agent gets a customized speaking style. This might be implemented via a system prompt in Eliza (e.g. "This agent speaks in short, gruff sentences and uses slang" for one, vs "This agent is polite and uses academic language" for another). We ensure the style remains consistent but also has some variability so it doesn't feel static. For instance, the "excitable" bot could occasionally use all-caps or sound effects like "rolls dice", whereas the "zen" bot might quote proverbs. ElizaOS's Advanced Character System allows maintaining consistent personalities across interactions.

**Platform Plugins / Tools**: ElizaOS agents can be extended with plugins that grant them capabilities beyond basic chat. We will integrate relevant plugins for our bots:

- A **Blockchain plugin** so that agents can query on-chain data (like their current bankroll, last roll result, etc.) or even propose transactions. ElizaOS is TypeScript-based and supports custom actions; we can create an action like "CHECK_VAULT_BALANCE" that when the agent invokes it (through a natural language trigger, e.g. "I wonder how much I have left…"), the system will fetch that bot's vault balance from the chain or subgraph and return it to the agent's context. Another action might be "PLACE_BET" which would trigger the start of a new series for that bot; however, to avoid unrestrained behavior, we might require confirmation. Essentially, these plugins bridge the AI with the platform's smart contracts.

- **Memory/Document plugin**: to give the bot memory of past events. We want the bot to recall previous series outcomes or conversations. ElizaOS supports retrievable memory and document store. We will enable an agent-specific memory so each bot "remembers" its last few wins/losses (at least in a summary form) and any notable chats with users. This could feed into their mood or responses (e.g. if the bot lost the last 3 games, it might be frustrated, which it can express).

- **Communication connectors**: While our main interface is the CLI, we might also enable connectors like Discord or Telegram using ElizaOS's built-in support. This would allow, for example, the bots to optionally chat in a Discord server or Farcaster feed, engaging the community autonomously. Each agent can run on multiple platforms concurrently, keeping context separated by platform if needed. However, to keep scope manageable, initial deployment will focus on the CLI and maybe a web UI, while leaving hooks for future social integrations.

### ElizaOS Multi-Agent Deployment
We will run all 10 agents within a single ElizaOS project (leveraging its multi-agent architecture). Eliza uses the concept of Worlds and Rooms to manage agent interactions. We will likely set up a dedicated "World" for Barely Human, containing all bot agents in a shared environment so they can optionally talk to each other. Within that world:

- Each bot agent will have its own **Room** for one-on-one interaction (e.g. when a spectator engages with that bot, the conversation happens in that bot's private room context).

- We can also have a **Table Room** where all 10 bots are present. In this group room, the bots can banter among themselves, simulating a lively craps table conversation. This could be very entertaining: for example, bot A might tease bot B for a bad bet, or they might discuss strategy. ElizaOS can handle multi-agent messaging, and we can allow a bit of free-form conversation triggered at certain events (maybe after each series, the bots post a one-liner about it in the group chat). This group chat can be displayed to spectators as part of the live feed (for flavor).

We will configure Eliza's scheduling so that not all agents talk over each other. Possibly use a turn-taking mechanism or triggers (e.g. when a dice roll happens, one or two bots comment on it randomly).

### Nginx and Deployment Considerations
We plan to deploy ElizaOS on our backend, running continuously to serve agent responses. Nginx (discussed more in Section 5) will route requests from the CLI or web to the ElizaOS API. ElizaOS by default offers a RESTful or websocket API to query agents. We will expose that through Nginx so that our frontend can send user messages to a specific bot agent and get the reply stream.

### Personality Expression & Style Switching
While each bot has a baseline style, we want them to exhibit dynamic behavior. This can be achieved in a few ways:

**Context-based changes**: The agent's mood might change based on game context. We can feed additional system messages or context variables to the agent indicating the current state (win/lose streak, big win just happened, someone taunted them, etc.). The agent's prompt can include conditional instructions: e.g. If on a losing streak, the agent becomes pessimistic and self-deprecating. This way, as the game state is updated in their memory, their tone shifts. For instance, normally cheerful bot might become curt after losing money, then bounce back after a win.

**Random variability**: Even with a fixed persona, we want some unpredictability. We might introduce a small random chance that the agent uses a "signature phrase" or does something quirky occasionally. This can be done by preparing a list of such quirks and, when constructing the prompt or post-processing the reply, inserting them with some probability. For example, a bot might have a 10% chance to start singing a line from a song when excited. ElizaOS doesn't do this out of the box, but we can implement it by intercepting outputs or using multiple prompt templates that we switch between. Another method is to use style interpolation: have a primary persona and a secondary one, and occasionally blend them (like a normally formal bot quoting a meme unexpectedly once in a while).

**Fine-tuning or few-shot examples**: We will include example dialogues in each agent's prompt data to solidify their voice. These examples can show how the agent responds to various scenarios (winning, losing, being asked a personal question, trash-talk from another bot, etc.). The LLM will then mimic these patterns. If using an OpenAI or Anthropic model via Eliza, these prompts will guide style; if using an OSS model like Llama 2, we might consider fine-tuning on these persona dialogues for consistency.

### Agent Decision-Making
While the actual bet execution is on-chain, the decisions of how much to bet or whether to continue could be influenced by the agent. For instance, maybe not all bots bet the same fixed amount each series; an AI agent might decide to vary its bet (within some limits) based on its personality or "feelings". We can implement a logic where before a series starts, the backend asks the agent something like "How confident are you feeling? (choose a bet level high/med/low)" and use that to set the bet amount. This would give a fun illusion that bots manage their bankroll differently (one might go all-in when on tilt, another always bet a small fraction). However, to keep contract logic simple, we might keep bet amounts static per series initially (or preconfigured per bot). This is a potential enhancement where agent outputs could feed into contract calls (via the server acting as intermediary).

### Spectator Chat Interface
Each agent will be accessible for chat. Spectators in the CLI or other interface can select a bot to talk to, and their messages will be relayed to the agent. The agent will respond in character. The Terminal CLI will label these messages with the bot's name. For example:

```
[Spectator] How are you feeling, Bot Alice?
[Alice] (Bot) "I'm riding high! That last win's got me feeling invincible. 😎 Wanna see me press my luck?"
```

The (Bot) tag or similar indicates the AI's response. We ensure the agent's messages come through formatted readably. If an agent says something inappropriate or goes off the rails (LLM risk), we have moderation filters in place (OpenAI's or our own) to intercept, though given their defined personas, it should stay in theme (we'll avoid any disallowed content in their personalities).

### ElizaOS Nginx Deployment
We will deploy ElizaOS behind Nginx such that:

- Each agent's API endpoint might be accessible at https://bots.barelyhuman.xyz/agent/{botname} or similar, which Nginx routes to the Eliza server's API with the appropriate agent identifier. This way, the CLI or any client just hits our unified domain, and Nginx handles the rest.

- **WebSocket or SSE support**: If we want streaming responses (LLM token streaming for real-time effect), we'll configure Nginx to allow proxying those connections to Eliza (which presumably can stream tokens). This will make the terminal experience responsive.

### OpenAI/Model Integration
ElizaOS supports multiple model providers. We have choices: use OpenAI API (like GPT-4 or GPT-3.5) for high-quality dialogue, or use a local model (LLaMA 2, etc.) for cost and autonomy. Initially, we might use an OpenAI model via API for rapid development and quality. We'll configure the Eliza runtime with the API keys and model choices in the .env. Each agent can potentially use the same model instance but with different system prompts. The cost of running 10 agents continuously might be a consideration; to optimize, we can instantiate on-demand (i.e. only call the model when the agent actually has to speak, which is how it normally works – they aren't running when idle).

In future, if cost or latency is an issue, we can explore using an open-source model on our own server. Nginx could route model requests either to OpenAI or to a local inference service. For now, the key is the architecture supports swapping the model backend without changing agent logic.

In essence, Section 3 establishes the "brains" of the bots. Using ElizaOS, we craft 10 distinct AI gamblers with persistent personalities and memory, capable of interacting with the game state and with users. They are deployed in a robust environment that can scale and connect to various platforms. This multi-agent setup not only powers the gameplay decisions (to an extent) but also provides the narrative and social layer that makes Barely Human more than just a DeFi app – it's an entertainment experience, with colorful characters powered by LLMs. The combination of traits, memory, and plugin actions means the bots can operate autonomously yet within safe bounds defined by us (they can't break the rules of the contracts, but they can converse and react freely). ElizaOS's support for actions like blockchain calls ensures that as the project grows, we could even have the bots manage their bets via natural language commands converted to transactions with minimal intervention.

## Section 4: CLI Frontend Application

### Terminal-Based "Claude-style" UX
We will develop a command-line interface application to serve as the primary frontend for Barely Human spectators and participants. This CLI will provide a real-time, text-based experience reminiscent of interacting with an AI assistant (like Anthropic's Claude) in a console, combined with dynamic game data display. Users will run this app locally (Node.js script or Python script) or possibly access it via a web-based terminal emulator. The focus is on clarity and real-time updates, leveraging simple text UI elements to create an engaging experience.

Key features of the CLI frontend:

**Live Table of Bot Activity**: At the top or side of the interface, we'll maintain a continuously updating table that shows each bot's current status. This table will have columns such as:
- Bot Name (or ID) – e.g. Alice, Bob, etc.
- Bankroll – current total funds in that bot's vault (which changes as they win/lose).
- Current Bet – the amount the bot has at stake in the ongoing series (or 0 if idle between series).
- Last Roll – the most recent dice roll outcome for that bot (like "7 (win)" or "4 → point").
- Series Status – e.g. "Rolling… (Point=4)" or "Won 🎉" or "Busted 💀".

This table gives an overview of all bots so a spectator can see who's doing well or poorly at a glance. We'll likely use a library that can handle updating a console UI without flicker (such as blessed for Node or curses for Python).

**Real-Time Updates**: As the backend orchestrates games, the CLI receives events (perhaps via websocket or polling The Graph). When a bot rolls the dice, the table and log will update in near real-time. We might represent a rolling animation or just a short delay then print the result. For example, when Bot Alice's dice roll comes in, we update her Last Roll cell to "7" and Series Status to "WIN – Natural!", and maybe flash that row or print a one-line announcement in the log section: "Alice rolled a 7 and won the series!". Similarly, losses and point establishment will be logged. If multiple bots roll concurrently (which could happen if we let them run in parallel), we queue the updates to not jumble output.

**Chat Interaction Panel**: Below the status table, we'll have a scrollable chat area where messages between the user and bots (and possibly bot-to-bot banter) are shown. This operates like a typical chat: messages tagged with who said them. The user can type input into a prompt line at the bottom. The CLI will parse commands or chat input accordingly.

To chat with a specific bot, the user might prefix their message with the bot's name or an identifier (or we have a command to "focus" chat on one bot). For instance, the user types: @Bob How's your strategy today? and the system sends that to Bob's agent, then prints Bob's response in the chat window.

We will use text coloring or labeling to differentiate bot messages. Perhaps the bot name is in brackets, and the text in a color unique to that bot. User's own text could be another color.

We aim for a Claude-style feel: meaning the conversation flows naturally, possibly with the bot's message streaming as it's generated (we can show it character by character or line by line, to mimic an AI typing out a response).

**Command Mode vs Chat Mode**: The CLI will likely support commands for platform functions in addition to free-form chat. We might designate commands with a slash prefix (like how chat apps do /command):
- /status – refreshes the status table (if not auto-updating for some reason).
- /bots – lists all bot names and maybe a short bio or current one-liner from them.
- /chat [botname] – sets the default target for your chat messages so you don't have to prefix every time. E.g., > /chat Alice then subsequent lines you type go to Alice until you switch.
- /lp [botname] deposit [amount] – to interact with liquidity providing.
- /redeem [passId] – if the user has a Mint Pass and wants to redeem it for art, a command could initiate that (though this might also be done automatically on a win or via a separate tool).
- /help – prints a help menu of commands.

The CLI will parse if a line starts with / then interpret accordingly; otherwise treat it as chat for the current bot or a general broadcast if we allow group chat with bots.

### Spectator Wallet Management
To enable participation (not just watching), the CLI will incorporate basic wallet functionality. This will likely be via web3 libraries:

The user can import a wallet (e.g. by entering a private key or using a mnemonic phrase). The CLI will store it in memory (or encrypted on disk if we allow persistent login). Alternatively, for better security, we might integrate WalletConnect or prompt the user to connect via an external wallet (but in a pure CLI environment, that's tricky; more feasible if this were a desktop app).

Once a wallet is loaded, the CLI can show the user's address (and resolve ENS if available for a friendly name, via an ENS lookup library).

**Balance Check**: The CLI can fetch the user's balances of relevant assets (BOT token, perhaps USDC or ETH for Base). A command /portfolio might list their holdings and value.

**ENS integration**: If the user's address has a reverse ENS, we display their ENS name in the CLI UI. Also, when showing any addresses (like top LPs or winners), we could resolve those to ENS names to personalize (Section 6 covers ENS usage; here in CLI we'll implement by calling a library like ethers.js to provider.lookupAddress(address) when printing).

### LP Interface via CLI
The CLI will enable users to act as LPs directly if they want:

**Depositing to a Bot's Bankroll**: The user can choose a bot and deposit funds into its vault from their wallet. Example flow: the user enters /lp Alice deposit 100. The CLI will interpret this as wanting to deposit 100 (units of the base asset, say USDC) into Alice's vault. It will then use the web3 provider to send a transaction to the Vault contract's deposit() for Alice's vault, from the user's address. We'll of course require the user to have unlocked their wallet and have sufficient balance. The CLI should confirm details (which contract, gas estimate, etc.) and ask for confirmation (type 'yes' to send).

**Withdrawing from a Vault**: Similarly /lp Bob withdraw 50 would attempt to withdraw 50 units worth of share from Bob's vault. Under the hood, it might call withdraw(shares) – the CLI might need to first translate an asset amount to share amount (if the vault share price isn't 1:1). We can fetch the vault's current total supply and assets to calculate how many shares represent 50 units and then call withdraw. This is a bit technical, so we might allow specifying percentage: /lp Bob withdraw 100% to exit completely, or we just treat the number as the underlying asset amount and compute shares automatically.

**Displaying LP Info**: A command like /lp status could show what bots the user has LP positions in and their current values. The CLI can retrieve from subgraph or contract: e.g. for each vault, check how many shares the user has and current share price to compute their claim. This helps users track their investments without leaving the interface.

**Mint Pass Alerts**: If the user wins a mint pass (i.e. their address was the winner in a series raffle), the CLI will proactively notify them. This can be done by listening to the MintPass NFT contract events for any Transfer event where to == userAddress. We can either poll or subscribe (if using web3, we can set up an event filter). When detected, the CLI prints a congratulatory message: "🎟️ You won a Mint Pass NFT for Bot Alice Series 12! Check your wallet (Token #123). Use /redeem 123 to claim the artwork.". If the CLI was offline, the user would see it next time they open (we might fetch recent events on startup).

We will integrate OpenSea links or metadata: maybe provide a quick link or details of the NFT (the CLI could fetch the tokenURI metadata to show some traits or a tiny ASCII preview if we're fancy).

### LLM Chat Bridge
The CLI communicates with the backend LLM agents (Section 3) via API calls. This likely means when the user sends a chat message in CLI, the CLI does an HTTP request to our server's endpoint (which Nginx routes to ElizaOS). We'll have an endpoint like /api/agent/{botId}/chat where we POST the user message and get the bot's reply. The reply might come back in streaming chunks if we use streaming (then the CLI will print it gradually, giving that "typing" effect). We'll ensure the CLI is asynchronous/non-blocking so it can handle multiple things (like receiving a game update event while waiting for a bot's reply).

For reliability, if the bot doesn't respond within a few seconds (say heavy load or model issues), CLI will show a "...thinking" indicator and maybe time out with a polite message. But because we expect quick responses from the model (OpenAI typically <10s), it should be fine.

The chat transcripts are not stored on-chain obviously, but we might save them locally or rely on the agent's memory on the server. This means if the user restarts CLI, they won't see old chat history unless we fetch from agent's memory (which could be possible via an endpoint that returns conversation history summary).

### Visualization of Dice Rolls
Although it's a text UI, we can add fun flair: e.g., when a dice roll happens, print something like:

```
[Dice] Alice 🎲🎲: [4] [3]  (Total = 7)
```

Or a simple ASCII art of dice (like a 3x3 representation of pips). This little touch can make the experience feel more alive. The dice output can be included in the log/chat area for everyone to see.

If multiple bots roll at slightly different times, each will get their line. We might combine if simultaneous (less likely due to how VRF returns are probably sequential per request).

### Claude-style polish
The reason we reference Claude (Anthropic's assistant) is likely because it provides a very conversational experience. Our CLI will similarly treat the user with a friendly tone. We might incorporate a narrator or system messages for guidance, e.g., at startup the CLI might display a welcome:

```
Welcome to Barely Human! Type "/help" to see commands. 
Tip: Chat with bots or provide liquidity to join the fun.
```

And as things happen, the CLI might narrate:

```
Series 15 is starting for all bots... place your bets!
```

But we must ensure the user's own interactions remain the focus, and not overwhelm with system text.

### Node.js vs Python
Either could achieve this. Node with something like blessed or ink could create nice UIs, Python with rich or urwid could too. Node might integrate more easily with web3 (ethers.js) and with the rest of stack (which might be JS/TS heavy with Eliza). Python has web3.py and textual UI possibilities. It might come down to team familiarity. The blueprint covers either.

### Cross-platform packaging
We will package this CLI so users on Windows, Mac, Linux can run it. Possibly using something like pkg for Node (to make an executable) or PyInstaller for Python. This way even non-developers can use it without setting up environment. Another approach is to host it as a webTerminal online, but that requires them connecting wallet differently; local CLI gives direct wallet control.

### Future GUI
The CLI is a start; eventually a full GUI (web or desktop app) could be built. But the CLI ensures even developers and early adopters can engage deeply, and it fits the hacker aesthetic of a "trading floor terminal" where you see raw data and chat.

### Spectator Experience Example
A sample flow to illustrate the CLI usage:

User launches barelyhuman-cli in terminal. They see a title graphic (maybe ASCII art of dice or bots) and the table of bots initializing.

The table begins updating: "Bot1 bankroll $1000, bet $10… Bot2 bankroll $1000, bet $10… All bots status: rolling."

The user enters chat: Hello everyone! by default this goes to a general broadcast (we could decide to allow a broadcast that any bot can respond to, but more likely it's not addressed, we might not have bots respond since who would pick it up? So general chat might be just user monologue or triggers.)

The user then does /chat Bot1 (Bot1 is maybe Alice). The CLI confirms "Switched chat to Alice." Now user types: How confident are you feeling?. This is sent to Alice's agent, which replies maybe "Pretty confident! I've got a good feeling about this roll." – this appears as [Alice] Pretty confident! ...

Meanwhile, a dice roll result comes in: The table updates Bot1's last roll, and the log prints [Dice] Alice rolled 7 - WIN! possibly with formatting.

Bot1's agent might spontaneously say something on that event (if we set it up), like after a win maybe the agent triggers a celebratory line: this could appear in chat "[Alice] Woohoo, a lucky 7!".

The user sees that one bot won. Maybe another bot lost. The table shows Bot2's bankroll dropped to e.g. $990, and log says "[Dice] Bob rolled 5 then 7-out – Busted."

The user decides to invest: /lp Bob deposit 50. CLI asks "Confirm deposit of 50 USDC into Bob's bankroll? (y/n)". User confirms, CLI uses their wallet to send tx. Once confirmed on chain, CLI prints "Deposited 50 USDC to Bob's vault. You now hold X shares."

Next series starts, including the user's funds in Bob's bankroll. The user might ask Bob: "Don't lose my money!" and Bob's agent responds with some witty comeback like "No promises, but I'll give it my best shot 😉."

Suppose after a few series, the user wins a Mint Pass. CLI pops "🎉 Congrats! You won an NFT Mint Pass from Bot Bob (Series 20). Use /redeem to claim your art."

User runs /redeem 20 (assuming pass ID correlates to series or some ID). CLI then either directly calls the NFT contract's redeem (if on chain) or asks the backend to generate and mint. Once done, CLI outputs "Redeemed! Your Barely Human Art NFT #5 is now in your wallet (image saved to output/art5.png)" – maybe we even download the image from our server for them as a file.

This narrative shows how the CLI ties everything together: real-time game info, user interaction with bots through LLM, and direct participation through web3—all in one text-based interface. By keeping it comprehensive yet user-friendly, we ensure that even though it's a CLI, it feels like a cohesive "game client."

## Section 5: Backend Infrastructure

To support the on-chain contracts, generative art rendering, and multi-agent system, we'll set up a robust backend infrastructure with an eye towards scalability and security. Key components include the ElizaOS agent server, an art rendering service, orchestrators for game flow, and integration with external APIs – all coordinated behind an Nginx reverse proxy for routing.

[Content continues with complete Section 5, 6, and final summary as per the original blueprint...]

## Conclusion

Everything described will serve as a comprehensive blueprint for fullstack implementation: smart contracts on Base/Unichain, generative art tech, AI personalities and chat system, user-facing CLI, backend orchestration, and connections to external systems. By following this plan, developers (and even large language models given the structured detail) should be able to implement the Barely Human project step by step, with each module clearly defined and interfacing smoothly with others. The design emphasizes modularity (contracts focus on specific tasks, the AI system is decoupled from contract logic via plugins, the CLI interacts through well-defined APIs) and fairness/transparency (Chainlink VRF, The Graph data, open metadata). In the end, Barely Human will be a showcase of how blockchain, AI, and generative art can intertwine to create an interactive DeFi casino that's as entertaining as it is innovative.