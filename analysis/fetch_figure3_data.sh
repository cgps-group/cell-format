#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
data_dir="$repo_root/analysis/data"
archive="$data_dir/klebsiella-complete-genomes.zip"

mkdir -p "$data_dir"
if [[ -d "$data_dir/ncbi_dataset" ]]; then
  echo "NCBI data already present in $data_dir/ncbi_dataset"
  exit 0
fi

datasets download genome accession \
  GCF_000009885.1 \
  GCF_000016305.1 \
  GCF_000240185.1 \
  --include gbff \
  --filename "$archive"
unzip -q "$archive" -d "$data_dir"

echo "Downloaded three complete RefSeq assemblies to $data_dir/ncbi_dataset"
