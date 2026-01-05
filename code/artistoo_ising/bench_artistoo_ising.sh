Sizes=(256 512 768 1024 1536 2048 2671 3072 3584 4096) 
Format="%e %U %S %P %M"

/usr/bin/time --format="$Format" --output="2671.txt" --append node ./run-IsingModelBenchmark.js 2671
/usr/bin/time --format="$Format" --output="3072.txt" --append node ./run-IsingModelBenchmark.js 3072
/usr/bin/time --format="$Format" --output="3584.txt" --append node ./run-IsingModelBenchmark.js 3584
/usr/bin/time --format="$Format" --output="4096.txt" --append node ./run-IsingModelBenchmark.js 4096

for j in "${Sizes[@]}"; do
    /usr/bin/time --format="$Format" --output="$j.txt" --append node ./run-IsingModelBenchmark.js $j 
done

# for i in {1..10}; do
#     for j in "${Sizes[@]}"; do
#         /usr/bin/time --format="$Format" --output="$j.txt" --append node ./run-IsingModelBenchmark.js $j 
#     done
# done