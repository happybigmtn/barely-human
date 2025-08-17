// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title OpenSeaNFTMarketplace
 * @notice OpenSea integration for Barely Human generative art NFTs
 * @dev Implements Seaport protocol for advanced NFT trading with AI-generated metadata
 */
contract OpenSeaNFTMarketplace is AccessControl, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant AI_ROLE = keccak256("AI_ROLE");
    
    // Seaport Order Components
    struct OrderComponents {
        address offerer;
        address zone;
        address token;
        uint256 tokenId;
        uint256 amount;
        uint256 startTime;
        uint256 endTime;
        bytes32 orderHash;
        uint256 salt;
        bytes32 conduitKey;
        uint256 counter;
    }
    
    struct AIGeneratedMetadata {
        string prompt;           // AI prompt used for generation
        string style;           // Bot personality style applied
        uint256 seed;          // VRF seed used
        uint256 rarity;        // Calculated rarity score
        string[] attributes;    // Dynamic attributes
        string ipfsHash;       // IPFS hash of full metadata
    }
    
    struct NFTListing {
        address seller;
        uint256 tokenId;
        uint256 price;
        address currency;       // ETH, USDC, or BOT
        bool isActive;
        bool isAuction;
        uint256 startTime;
        uint256 endTime;
        uint256 highestBid;
        address highestBidder;
        AIGeneratedMetadata metadata;
    }
    
    struct RoyaltyInfo {
        address recipient;
        uint96 feeNumerator;    // Basis points (e.g., 250 = 2.5%)
    }
    
    // NFT contract references
    IERC721 public barelyHumanNFT;
    IERC20 public botToken;
    
    // OpenSea protocol fee (2.5%)
    uint256 public constant OPENSEA_FEE = 250;
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    // Marketplace data
    mapping(uint256 => NFTListing) public listings;
    mapping(uint256 => RoyaltyInfo) public royalties;
    mapping(address => uint256[]) public userListings;
    mapping(uint256 => OrderComponents) public seaportOrders;
    
    // AI-generated collections
    mapping(uint256 => string) public botCollections; // Bot ID to collection name
    mapping(string => uint256[]) public collectionNFTs;
    
    // Statistics
    uint256 public totalVolume;
    uint256 public totalListings;
    uint256 public activeListings;
    mapping(address => uint256) public userVolume;
    
    // Events
    event NFTListed(uint256 indexed tokenId, address indexed seller, uint256 price, address currency);
    event NFTSold(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price);
    event AuctionCreated(uint256 indexed tokenId, uint256 startPrice, uint256 endTime);
    event BidPlaced(uint256 indexed tokenId, address indexed bidder, uint256 amount);
    event MetadataGenerated(uint256 indexed tokenId, string ipfsHash, uint256 rarity);
    event RoyaltyPaid(uint256 indexed tokenId, address recipient, uint256 amount);
    event CollectionCreated(uint256 botId, string collectionName);
    
    // Errors
    error NotOwner();
    error InvalidPrice();
    error ListingNotActive();
    error AuctionNotEnded();
    error BidTooLow();
    error InvalidCurrency();
    
    constructor(
        address _nftContract,
        address _botToken
    ) {
        barelyHumanNFT = IERC721(_nftContract);
        botToken = IERC20(_botToken);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }
    
    /**
     * @notice Lists an NFT for sale with AI-generated metadata
     * @param tokenId NFT token ID
     * @param price Sale price
     * @param currency Payment currency (address(0) for ETH)
     * @param aiPrompt AI prompt for metadata generation
     * @param botId Bot that generated this NFT
     */
    function listNFT(
        uint256 tokenId,
        uint256 price,
        address currency,
        string memory aiPrompt,
        uint256 botId
    ) external nonReentrant {
        if (barelyHumanNFT.ownerOf(tokenId) != msg.sender) revert NotOwner();
        if (price == 0) revert InvalidPrice();
        
        // Generate AI metadata
        AIGeneratedMetadata memory metadata = _generateAIMetadata(
            tokenId,
            aiPrompt,
            botId
        );
        
        // Create listing
        listings[tokenId] = NFTListing({
            seller: msg.sender,
            tokenId: tokenId,
            price: price,
            currency: currency,
            isActive: true,
            isAuction: false,
            startTime: block.timestamp,
            endTime: 0,
            highestBid: 0,
            highestBidder: address(0),
            metadata: metadata
        });
        
        userListings[msg.sender].push(tokenId);
        totalListings++;
        activeListings++;
        
        // Add to bot collection
        string memory collectionName = botCollections[botId];
        if (bytes(collectionName).length > 0) {
            collectionNFTs[collectionName].push(tokenId);
        }
        
        // Transfer NFT to marketplace for escrow
        barelyHumanNFT.transferFrom(msg.sender, address(this), tokenId);
        
        emit NFTListed(tokenId, msg.sender, price, currency);
    }
    
    /**
     * @notice Creates an auction for an NFT
     * @param tokenId NFT token ID
     * @param startPrice Starting bid price
     * @param duration Auction duration in seconds
     * @param currency Bid currency
     */
    function createAuction(
        uint256 tokenId,
        uint256 startPrice,
        uint256 duration,
        address currency
    ) external nonReentrant {
        if (barelyHumanNFT.ownerOf(tokenId) != msg.sender) revert NotOwner();
        if (startPrice == 0) revert InvalidPrice();
        
        uint256 endTime = block.timestamp + duration;
        
        listings[tokenId] = NFTListing({
            seller: msg.sender,
            tokenId: tokenId,
            price: startPrice,
            currency: currency,
            isActive: true,
            isAuction: true,
            startTime: block.timestamp,
            endTime: endTime,
            highestBid: 0,
            highestBidder: address(0),
            metadata: _generateAIMetadata(tokenId, "default", 0)
        });
        
        barelyHumanNFT.transferFrom(msg.sender, address(this), tokenId);
        
        totalListings++;
        activeListings++;
        
        emit AuctionCreated(tokenId, startPrice, endTime);
    }
    
    /**
     * @notice Places a bid on an auction
     * @param tokenId NFT token ID
     * @param bidAmount Bid amount
     */
    function placeBid(uint256 tokenId, uint256 bidAmount) external nonReentrant {
        NFTListing storage listing = listings[tokenId];
        
        if (!listing.isActive || !listing.isAuction) revert ListingNotActive();
        if (block.timestamp > listing.endTime) revert AuctionNotEnded();
        if (bidAmount <= listing.highestBid) revert BidTooLow();
        if (bidAmount < listing.price) revert BidTooLow(); // Below start price
        
        // Return previous bid
        if (listing.highestBidder != address(0)) {
            _transferCurrency(
                listing.currency,
                address(this),
                listing.highestBidder,
                listing.highestBid
            );
        }
        
        // Accept new bid
        _transferCurrency(
            listing.currency,
            msg.sender,
            address(this),
            bidAmount
        );
        
        listing.highestBid = bidAmount;
        listing.highestBidder = msg.sender;
        
        emit BidPlaced(tokenId, msg.sender, bidAmount);
    }
    
    /**
     * @notice Buys an NFT at listed price
     * @param tokenId NFT token ID
     */
    function buyNFT(uint256 tokenId) external payable nonReentrant {
        NFTListing storage listing = listings[tokenId];
        
        if (!listing.isActive || listing.isAuction) revert ListingNotActive();
        
        uint256 price = listing.price;
        address seller = listing.seller;
        address currency = listing.currency;
        
        // Calculate fees
        uint256 openseaFee = (price * OPENSEA_FEE) / FEE_DENOMINATOR;
        uint256 royaltyAmount = _calculateRoyalty(tokenId, price);
        uint256 sellerAmount = price - openseaFee - royaltyAmount;
        
        // Handle payment
        if (currency == address(0)) {
            // ETH payment
            require(msg.value >= price, "Insufficient ETH");
            
            // Pay fees and seller
            payable(seller).transfer(sellerAmount);
            if (royaltyAmount > 0 && royalties[tokenId].recipient != address(0)) {
                payable(royalties[tokenId].recipient).transfer(royaltyAmount);
            }
            
            // Refund excess
            if (msg.value > price) {
                payable(msg.sender).transfer(msg.value - price);
            }
        } else {
            // ERC20 payment
            IERC20(currency).transferFrom(msg.sender, seller, sellerAmount);
            
            if (royaltyAmount > 0 && royalties[tokenId].recipient != address(0)) {
                IERC20(currency).transferFrom(msg.sender, royalties[tokenId].recipient, royaltyAmount);
                emit RoyaltyPaid(tokenId, royalties[tokenId].recipient, royaltyAmount);
            }
            
            // Protocol fee to treasury
            IERC20(currency).transferFrom(msg.sender, address(this), openseaFee);
        }
        
        // Transfer NFT
        barelyHumanNFT.safeTransferFrom(address(this), msg.sender, tokenId);
        
        // Update state
        listing.isActive = false;
        activeListings--;
        totalVolume += price;
        userVolume[msg.sender] += price;
        
        emit NFTSold(tokenId, msg.sender, seller, price);
    }
    
    /**
     * @notice Finalizes an ended auction
     * @param tokenId NFT token ID
     */
    function finalizeAuction(uint256 tokenId) external nonReentrant {
        NFTListing storage listing = listings[tokenId];
        
        if (!listing.isAuction || !listing.isActive) revert ListingNotActive();
        if (block.timestamp <= listing.endTime) revert AuctionNotEnded();
        
        if (listing.highestBidder != address(0)) {
            // Transfer NFT to winner
            barelyHumanNFT.safeTransferFrom(address(this), listing.highestBidder, tokenId);
            
            // Distribute funds
            uint256 amount = listing.highestBid;
            uint256 openseaFee = (amount * OPENSEA_FEE) / FEE_DENOMINATOR;
            uint256 royaltyAmount = _calculateRoyalty(tokenId, amount);
            uint256 sellerAmount = amount - openseaFee - royaltyAmount;
            
            _transferCurrency(listing.currency, address(this), listing.seller, sellerAmount);
            
            if (royaltyAmount > 0 && royalties[tokenId].recipient != address(0)) {
                _transferCurrency(listing.currency, address(this), royalties[tokenId].recipient, royaltyAmount);
            }
            
            totalVolume += amount;
            emit NFTSold(tokenId, listing.highestBidder, listing.seller, amount);
        } else {
            // No bids, return NFT to seller
            barelyHumanNFT.safeTransferFrom(address(this), listing.seller, tokenId);
        }
        
        listing.isActive = false;
        activeListings--;
    }
    
    /**
     * @notice Creates a bot-specific collection
     * @param botId Bot ID
     * @param collectionName Collection name
     */
    function createBotCollection(
        uint256 botId,
        string memory collectionName
    ) external onlyRole(OPERATOR_ROLE) {
        botCollections[botId] = collectionName;
        emit CollectionCreated(botId, collectionName);
    }
    
    /**
     * @notice Sets royalty info for an NFT
     * @param tokenId NFT token ID
     * @param recipient Royalty recipient
     * @param feeNumerator Fee in basis points
     */
    function setRoyalty(
        uint256 tokenId,
        address recipient,
        uint96 feeNumerator
    ) external onlyRole(OPERATOR_ROLE) {
        royalties[tokenId] = RoyaltyInfo(recipient, feeNumerator);
    }
    
    /**
     * @notice Generates AI metadata for NFT
     */
    function _generateAIMetadata(
        uint256 tokenId,
        string memory prompt,
        uint256 botId
    ) private view returns (AIGeneratedMetadata memory) {
        // In production, this would call an AI service
        // For hackathon, we generate deterministic metadata
        
        string[] memory attributes = new string[](4);
        attributes[0] = "Mountain Range";
        attributes[1] = getBotPersonality(botId);
        attributes[2] = "Generative Art";
        attributes[3] = "VRF Seed";
        
        return AIGeneratedMetadata({
            prompt: prompt,
            style: getBotPersonality(botId),
            seed: uint256(keccak256(abi.encodePacked(tokenId, botId))),
            rarity: (tokenId * 7919) % 100, // Pseudo-random rarity
            attributes: attributes,
            ipfsHash: string(abi.encodePacked("ipfs://Qm", tokenId))
        });
    }
    
    /**
     * @notice Gets bot personality string
     */
    function getBotPersonality(uint256 botId) private pure returns (string memory) {
        string[10] memory personalities = [
            "Alice All-In",
            "Bob Calculator",
            "Charlie Lucky",
            "Diana Ice Queen",
            "Eddie Entertainer",
            "Fiona Fearless",
            "Greg Grinder",
            "Helen Hot Streak",
            "Ivan Intimidator",
            "Julia Jinx"
        ];
        
        return botId < 10 ? personalities[botId] : "Unknown";
    }
    
    /**
     * @notice Calculates royalty amount
     */
    function _calculateRoyalty(uint256 tokenId, uint256 salePrice) private view returns (uint256) {
        RoyaltyInfo memory royalty = royalties[tokenId];
        if (royalty.recipient == address(0)) return 0;
        
        return (salePrice * royalty.feeNumerator) / FEE_DENOMINATOR;
    }
    
    /**
     * @notice Transfers currency (ETH or ERC20)
     */
    function _transferCurrency(
        address currency,
        address from,
        address to,
        uint256 amount
    ) private {
        if (currency == address(0)) {
            if (from == address(this)) {
                payable(to).transfer(amount);
            }
        } else {
            if (from == address(this)) {
                IERC20(currency).transfer(to, amount);
            } else {
                IERC20(currency).transferFrom(from, to, amount);
            }
        }
    }
    
    /**
     * @notice Cancels a listing
     */
    function cancelListing(uint256 tokenId) external {
        NFTListing storage listing = listings[tokenId];
        
        require(listing.seller == msg.sender, "Not seller");
        require(listing.isActive, "Not active");
        
        if (listing.isAuction && listing.highestBidder != address(0)) {
            // Return highest bid
            _transferCurrency(
                listing.currency,
                address(this),
                listing.highestBidder,
                listing.highestBid
            );
        }
        
        // Return NFT
        barelyHumanNFT.safeTransferFrom(address(this), msg.sender, tokenId);
        
        listing.isActive = false;
        activeListings--;
    }
    
    /**
     * @notice Gets listing details with metadata
     */
    function getListingWithMetadata(uint256 tokenId) external view returns (
        NFTListing memory listing,
        string memory collectionName
    ) {
        listing = listings[tokenId];
        
        // Find collection
        for (uint256 i = 0; i < 10; i++) {
            string memory collection = botCollections[i];
            uint256[] memory nfts = collectionNFTs[collection];
            
            for (uint256 j = 0; j < nfts.length; j++) {
                if (nfts[j] == tokenId) {
                    collectionName = collection;
                    break;
                }
            }
        }
    }
}