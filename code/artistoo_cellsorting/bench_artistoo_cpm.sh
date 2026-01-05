Sizes=(512 768 1024 1536 2048 2671 3072 3584 4096) 
Format="%e %U %S %P %M"

#for i in {1..9}; do
for j in "${Sizes[@]}"; do
    /usr/bin/time --format="$Format" --output="$j.txt" --append node ./run-cellSortingBenchmark.js $j 
done
#done