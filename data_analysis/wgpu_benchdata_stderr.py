import matplotlib.pyplot as plt
import csv, re, sys, random, os
from statistics import stdev
from math import sqrt

STE_CONST = 1

#structure:
#dictionary where key is the size and the value is [timing data][coalescing] since T and seed are always the same

if(os.path.exists("benchdata")):
    os.chdir("benchdata")
else:
    print("ERROR: benchdata not found.")
    exit()

Y = [] #stores all sizes

coal_X = [] #stores the avg exec time when coalescing is enabled
coal_ste = [] #stores the standard error for each avg stored in coal_X

ncoal_X = [] #stores the avg exec time when coalescing is not enabled
ncoal_ste = [] #stores the standard error for each avg stored in ncoal_X

coal_morton_X = []
coal_morton_ste = []

ncoal_morton_X = []
ncoal_morton_ste = []

with os.scandir('.') as files:
    for file in files:

        size = int(os.path.basename(file))
        size = size * size

        Y.append(size)

        if(os.path.isdir(file)):
            with open(os.getcwd() + '/' + os.path.basename(file) + '/not_coalesced/output.log') as data:
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

                ncoal_X.append(avg)

                ste = stdev(new_lines) / sqrt(len(new_lines))
                ste = ste * STE_CONST

                ncoal_ste.append(ste)

        if(os.path.isdir(file)):
            with open(os.getcwd() + '/' + os.path.basename(file) + '/coalesced/output.log') as data:
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

                coal_X.append(avg)

                ste = stdev(new_lines) / sqrt(len(new_lines))
                ste = ste * STE_CONST

                coal_ste.append(ste)

        if(os.path.isdir(file)):
            with open(os.getcwd() + '/' + os.path.basename(file) + '/morton_coalesced/output.log') as data:
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

                coal_X.append(avg)

                ste = stdev(new_lines) / sqrt(len(new_lines))
                ste = ste * STE_CONST

                coal_ste.append(ste)

        if(os.path.isdir(file)):
            with open(os.getcwd() + '/' + os.path.basename(file) + '/morton_not_coalesced/output.log') as data:
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

                coal_X.append(avg)

                ste = stdev(new_lines) / sqrt(len(new_lines))
                ste = ste * STE_CONST

                coal_ste.append(ste)


zipped = zip(*sorted(zip(Y, coal_X, ncoal_X, coal_morton_X, ncoal_morton_X), key=lambda x: x[0]))

Y, coal_X, ncoal_X, coal_morton_X, ncoal_morton_X = (list(t) for t in zipped)


figure = plt.figure()

#plt.title('Scalability of Parallel CPM Implementation in WebGPU')
plt.xlabel('Number of cells')
plt.ylabel('Average Execution Time (s)')

#plt.xscale('log')

print(coal_ste)
print(ncoal_ste)

plt.errorbar(Y, coal_X, yerr=coal_ste, color=(0,0,1,1), label="Memory Coalescing Enabled", marker='o', elinewidth=2, capsize=2)
plt.errorbar(Y, ncoal_X, yerr=ncoal_ste, color=(1,0,0,1), label="Memory Coalescing Disabled", marker='o', elinewidth=2, capsize=2)
plt.errorbar(Y, coal_morton_X, yerr=ncoal_ste, color=(1,0,0,1), label="Memory Coalescing Disabled", marker='o', elinewidth=2, capsize=2)
plt.errorbar(Y, ncoal_morton_X, yerr=ncoal_ste, color=(1,0,0,1), label="Memory Coalescing Disabled", marker='o', elinewidth=2, capsize=2)

plt.legend()
plt.show()

