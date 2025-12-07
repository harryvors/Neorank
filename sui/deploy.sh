#!/bin/bash

# Sui Move Contract Deploy Script
# Make sure Sui CLI is installed: cargo install --locked --git https://github.com/MystenLabs/sui.git --branch devnet sui

echo "Building Move package..."
sui move build

echo "Deploying to Sui testnet..."
sui client publish --gas-budget 100000000 --json

echo "Deployment complete! Copy the package ID from the output above."

