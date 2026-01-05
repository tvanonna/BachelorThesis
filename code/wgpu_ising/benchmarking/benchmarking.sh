#!/bin/bash

Format="%e %U %S %P %M"

Sizes=(256 512 768 1024 1536 2048 2671 3072 3584 4096) 
Iterations=(9 9 9 9 9 9 9 9 9 9) 
S_length=${#Sizes[@]}

#first 4 elements get more samples, since they have a higher standard error
#the others get less, since difference between them with different measurements is more pronounced
#and they take forever to execute (up to 3 minutes per sample!)

if [ -d "benchdata" ]; then
    echo "ERROR: directory benchdata already exists. Terminating..."
    exit 1
fi

# Detect OS and use appropriate GNU time binary
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - use gtime (install with: brew install gnu-time)
    if ! command -v gtime &> /dev/null; then
        echo "ERROR: gtime not found. Please install it with: brew install gnu-time"
        exit 1
    fi
    TIME=gtime
else
    # Linux - use /usr/bin/time
    TIME=/usr/bin/time
fi

mkdir benchdata

#we call the program once with stdout enabled to print GameOptions information
    deno run --allow-all --unstable-raw-imports ../src/main.js 256 256 10 true false 1> "benchdata/settings.log"

for ((i=0; i < $S_length; i++)); do

    size=${Sizes[$i]}
    iter=${Iterations[$i]}

    base_dir1="benchdata/$size/coalesced"
    base_dir2="benchdata/$size/not_coalesced"
    base_dir3="benchdata/$size/morton_not_coalesced"
    base_dir4="benchdata/$size/morton_coalesced"

    mkdir "benchdata/$size"
    mkdir "benchdata/$size/coalesced"
    mkdir "benchdata/$size/not_coalesced"
    mkdir "benchdata/$size/morton_coalesced"
    mkdir "benchdata/$size/morton_not_coalesced"

    echo "$Format" 1> "$base_dir1"/output.log 
    echo "$Format" 1> "$base_dir2"/output.log 
    echo "$Format" 1> "$base_dir3"/output.log
    echo "$Format" 1> "$base_dir4"/output.log

    for ((count=0; count<=$iter; count++)); do
        #memory coalescing turned on, morton turned off
        $TIME --format="$Format" --output="$base_dir1/output.log" --append deno run --allow-all --unstable-raw-imports --quiet ../src/main.js "$size" "$size" 10 true false >/dev/null
        #coalescing turned off, morton turned on
        $TIME --format="$Format" --output="$base_dir2/output.log" --append deno run --allow-all --unstable-raw-imports --quiet ../src/main.js "$size" "$size" 10 false false >/dev/null
        #coalescing turned on, morton turned on
        $TIME --format="$Format" --output="$base_dir3/output.log" --append deno run --allow-all --unstable-raw-imports --quiet ../src/main.js "$size" "$size" 10 true true >/dev/null
        #coalescing turned off, morton turned on
        $TIME --format="$Format" --output="$base_dir4/output.log" --append deno run --allow-all --unstable-raw-imports --quiet ../src/main.js "$size" "$size" 10 false true >/dev/null
    done
done
