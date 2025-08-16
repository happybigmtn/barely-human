#!/bin/bash

echo "Contract sizes after optimization:"
echo "=================================="

for file in artifacts/contracts/*/*.sol/*.json artifacts/contracts/*/*/*.sol/*.json; do
  if [[ -f "$file" && "$file" != *".dbg.json" ]]; then
    contract=$(basename "$file" .json)
    bytecode=$(jq -r '.deployedBytecode' "$file" 2>/dev/null)
    if [[ -n "$bytecode" && "$bytecode" != "null" && "$bytecode" != "0x" ]]; then
      size=$((${#bytecode} / 2 - 1))
      if [ $size -gt 0 ]; then
        printf "%-30s %6d bytes" "$contract" "$size"
        if [ $size -gt 24576 ]; then
          echo " ⚠️  EXCEEDS LIMIT"
        else
          echo " ✅"
        fi
      fi
    fi
  fi
done | sort -k2 -nr