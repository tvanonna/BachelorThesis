import matplotlib.pyplot as plt
import csv, re, sys, random, os

#structure:
#dictionary where key is the size and the value is [timing data][coalescing] since T and seed are always the same

if(os.path.exists("benchdata")):
    os.chdir("benchdata")
else:
    print("ERROR: benchdata not found.")
    exit()

Y = [] #stores all sizes
coal_X = [] #stores the avg exec time when coalescing is enabled
ncoal_X = [] #stores the avg exec time when coalescing is not enabled

with os.scandir('.') as files:
    for file in files:

        Y.append(int(os.path.basename(file)))

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

zipped = zip(*sorted(zip(Y, coal_X, ncoal_X), key=lambda x: x[0]))

Y, coal_X, ncoal_X = (list(t) for t in zipped)


figure = plt.figure()

plt.title('Scalability of Parallel Potts Model Implementation in WebGPU')
plt.xlabel('Grid Width/Height')
plt.ylabel('Total Execution Time (s)')

#plt.xscale('log')

plt.plot(Y, coal_X, color=(0,0,1,1), label="Memory Coalescing Enabled", marker='o')
plt.plot(Y, ncoal_X, color=(1,0,0,1), label="Memory Coalescing Disabled", marker='o')

plt.legend()
plt.show()

