#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHAIN_PROTO_DIR="/Users/valkvalue/IdeaProjects/testss/proto"
COSMOS_PROTO_DIR="/Users/valkvalue/IdeaProjects/testss/predchain-python-sdk-v2/proto"
OUT_DIR="${ROOT_DIR}/src/gen"

rm -rf "${OUT_DIR}"
mkdir -p "${OUT_DIR}"

PROTO_FILES=(
  "${CHAIN_PROTO_DIR}/predictionmarket/crypto/v1/keys.proto"
  "${CHAIN_PROTO_DIR}/predictionmarket/market/v1/tx.proto"
  "${CHAIN_PROTO_DIR}/predictionmarket/market/v1/query.proto"
  "${CHAIN_PROTO_DIR}/predictionmarket/settlement/v1/tx.proto"
  "${CHAIN_PROTO_DIR}/predictionmarket/testnetmint/v1/tx.proto"
  "${CHAIN_PROTO_DIR}/predictionmarket/poa/v1/tx.proto"
)

protoc \
  --plugin="${ROOT_DIR}/node_modules/.bin/protoc-gen-ts_proto" \
  --proto_path="${CHAIN_PROTO_DIR}" \
  --proto_path="${COSMOS_PROTO_DIR}" \
  --ts_proto_out="${OUT_DIR}" \
  --ts_proto_opt=esModuleInterop=true,forceLong=bigint,useOptionals=messages,outputServices=none,outputJsonMethods=false,oneof=unions,stringEnums=true \
  "${PROTO_FILES[@]}"
