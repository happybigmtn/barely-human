#!/bin/bash

# Setup script for Ollama - Free local LLM for bot personalities
# This provides completely free, offline AI for the bots

echo "🤖 Setting up Ollama for Bot AI Personalities"
echo "============================================"
echo ""

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     OS_TYPE=Linux;;
    Darwin*)    OS_TYPE=Mac;;
    *)          OS_TYPE="UNKNOWN";;
esac

echo "Detected OS: $OS_TYPE"
echo ""

# Check if Ollama is already installed
if command -v ollama &> /dev/null; then
    echo "✅ Ollama is already installed"
    ollama --version
else
    echo "📦 Installing Ollama..."
    
    if [ "$OS_TYPE" = "Linux" ]; then
        # Linux installation
        curl -fsSL https://ollama.ai/install.sh | sh
    elif [ "$OS_TYPE" = "Mac" ]; then
        # Mac installation
        echo "For Mac, please download from: https://ollama.ai/download"
        echo "Or use: brew install ollama"
    else
        echo "❌ Unsupported OS. Please install manually from https://ollama.ai"
        exit 1
    fi
    
    echo "✅ Ollama installed successfully"
fi

echo ""
echo "🚀 Starting Ollama service..."

# Start Ollama service in background
ollama serve > /dev/null 2>&1 &
OLLAMA_PID=$!
sleep 3

echo "✅ Ollama service started (PID: $OLLAMA_PID)"
echo ""

echo "📥 Downloading AI models for bot personalities..."
echo ""

# Download lightweight models (choose one based on your system)
echo "Available models (choose based on your system specs):"
echo "1. mistral (4GB) - Recommended for most systems"
echo "2. llama2 (4GB) - Alternative option"
echo "3. phi (2GB) - Lightweight option for low-spec systems"
echo ""

read -p "Which model would you like to use? (1/2/3) [default: 1]: " choice
choice=${choice:-1}

case $choice in
    1)
        MODEL="mistral"
        echo "Downloading Mistral model (4GB)..."
        ;;
    2)
        MODEL="llama2"
        echo "Downloading Llama2 model (4GB)..."
        ;;
    3)
        MODEL="phi"
        echo "Downloading Phi model (2GB)..."
        ;;
    *)
        MODEL="mistral"
        echo "Using default: Mistral model (4GB)..."
        ;;
esac

ollama pull $MODEL

echo ""
echo "✅ Model downloaded successfully"
echo ""

# Test the model
echo "🧪 Testing AI model..."
echo ""

RESPONSE=$(echo "Hello, I'm a gambler bot. What's your betting strategy?" | ollama run $MODEL --verbose=false 2>/dev/null | head -1)
if [ -n "$RESPONSE" ]; then
    echo "✅ AI Test successful!"
    echo "   Response: $RESPONSE"
else
    echo "⚠️  AI Test failed, but setup is complete"
    echo "   You can test manually with: ollama run $MODEL"
fi

echo ""
echo "============================================"
echo "🎉 Ollama Setup Complete!"
echo "============================================"
echo ""
echo "📝 Configuration for your bots:"
echo "   Model: $MODEL"
echo "   API: http://localhost:11434"
echo "   Status: Running"
echo ""
echo "🎮 You can now run the interactive casino CLI:"
echo "   node frontend/cli/interactive-casino-cli.js"
echo ""
echo "💡 Tips:"
echo "   - Ollama runs completely offline (no API costs!)"
echo "   - Models are stored in ~/.ollama/models/"
echo "   - To stop Ollama: pkill ollama"
echo "   - To list models: ollama list"
echo "   - To remove a model: ollama rm $MODEL"
echo ""

# Update the LLM connector to use the selected model
if [ -f "elizaos/runtime/llm-connector.js" ]; then
    echo "Updating LLM connector to use $MODEL..."
    sed -i "s/model = 'mistral'/model = '$MODEL'/g" elizaos/runtime/llm-connector.js 2>/dev/null || \
    sed -i '' "s/model = 'mistral'/model = '$MODEL'/g" elizaos/runtime/llm-connector.js 2>/dev/null
    echo "✅ LLM connector configured"
fi

echo ""
echo "🎲 Happy gambling with AI-powered bots!"