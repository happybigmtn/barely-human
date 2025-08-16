#!/bin/bash

cd /home/r/Coding/Hackathon

echo "Installing missing dependencies for Hardhat v3 with viem..."

npm install --save-dev \
  @nomicfoundation/hardhat-ignition-viem \
  @nomicfoundation/hardhat-keystore \
  @nomicfoundation/hardhat-network-helpers \
  @nomicfoundation/hardhat-node-test-runner \
  @nomicfoundation/hardhat-viem \
  @nomicfoundation/hardhat-viem-assertions \
  @nomicfoundation/hardhat-verify \
  @nomicfoundation/ignition-core \
  chai

echo "Dependencies installed!"