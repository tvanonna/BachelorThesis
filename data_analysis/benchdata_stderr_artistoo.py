import matplotlib.pyplot as plt
import csv, re, sys, random, os
from statistics import stdev
from math import sqrt

STE_CONST = 1


Y = [] #stores all sizes

artistoo_X = [] 
artistoo_ste = [] 

wgpu_X = []
wgpu_ste = []

with os.scandir('./benchdata_wgpu/benchdata/.') as files:
    for file in files:

        size = int(os.path.basename(file))
        size = size * size

        Y.append(size)

        if(os.path.isdir(file)):
            with open(os.getcwd() + '/benchdata_wgpu/benchdata/' + os.path.basename(file) + '/coalesced/output.log') as data:
                content = data.read()

                lines = content.split(sep="\n")
                lines.pop(0)
                lines.pop(len(lines) - 1)

                new_lines = []

                for line in lines:
                    nums = line.split(sep=" ")
                    nums.pop()

                    line = float(nums[0]) #for now we are only interested in the first entry of each row (i.e. the total exec time)
                    new_lines.append(line)

                avg = sum(new_lines) / len(new_lines)

                wgpu_X.append(avg)

                ste = stdev(new_lines) / sqrt(len(new_lines))
                ste = ste * STE_CONST

                wgpu_ste.append(ste)

for size in Y:
    val = int(sqrt(size))
    with open(os.getcwd() + '/benchdata_artistoo/benchdata/' + str(val) + '.txt') as data:
        content = data.read()

        lines = content.split(sep="\n")
        #lines.pop(0)
        lines.pop(len(lines) - 1)

        new_lines = []

        for line in lines:
            nums = line.split(sep=" ")
            nums.pop()

            line = float(nums[0]) #for now we are only interested in the first entry of each row (i.e. the total exec time)
            new_lines.append(line)

        avg = sum(new_lines) / len(new_lines)

        artistoo_X.append(avg)

        ste = stdev(new_lines) / sqrt(len(new_lines))
        ste = ste * STE_CONST

        artistoo_ste.append(ste)

zipped = zip(*sorted(zip(Y, wgpu_X, wgpu_ste, artistoo_X, artistoo_ste), key=lambda x: x[0]))

Y, wgpu_X, wgpu_ste, artistoo_X, artistoo_ste = (list(t) for t in zipped)

figure = plt.figure()

#plt.title('Scalability of Parallel CPM Implementation in WebGPU')
plt.xlabel('Number of Cells')
plt.ylabel('Average Execution Time (s)')

#plt.xscale('log')


plt.errorbar(Y, wgpu_X, yerr=wgpu_ste, color=(0,0,1,1), label="WebGPU", marker='o', elinewidth=2, capsize=2)
plt.errorbar(Y, artistoo_X, yerr=artistoo_ste, color=(1,0,0,1), label="Artistoo", marker='o', elinewidth=2, capsize=2)

plt.legend()
plt.show()

