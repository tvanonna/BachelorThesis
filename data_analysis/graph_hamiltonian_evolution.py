import matplotlib.pyplot as plt
import csv, re, sys, random, os

X = []
Y = []

T = []
T_max = 0

num_files = 0
filelist = []

#Regardless of temperature, the global energy of a system
#should drop not drop lower than a specific constant. For this
#purpose, we keep track of the minimal value in a system.

# minval = 0

current_dir = os.path.dirname(os.path.abspath(sys.argv[0]))

with os.scandir(current_dir) as files:
    for file in files:
        if(file.is_file() and file.name.endswith('.txt')):
            num_files = num_files + 1
            filelist.append(file)

    Y = [[] for j in range(num_files)]

    for j in range(num_files):

        file = filelist[j]

        with open(file, 'r') as data:
            plotting = csv.reader(data)

            i = 0

            for val in plotting:

                if(i == 0):
                    temp = re.split(' ', val[0])
                    num = int(temp[1])
                    T.append(num)

                    if(num > T_max):
                        T_max = num

                else:
                    val = int(val[0])

                    if(j == 0):
                        X.append((200 * i))

                    Y[j].append(val)

                    # if(val < minval or minval == 0):
                    #     minval = val

                i = i + 1

figure = plt.figure()
figure.set_figwidth(10)
figure.set_figheight(10)
figure.set_dpi(100)

#plt.title('Hamiltonian per iteration')
plt.xlabel('Iterations (MCS)')
plt.ylabel('Hamiltonian (J)')

plt.xscale('log')
plt.yscale('log')

# plt.figtext(.75, .75, "H_min = " + str(minval))

#plt.ylim([0,100000])

print(len(Y[0]))

colors = [(0,0,0,1), (0.4,0.4,0.4,1), (0.8,0.8,0.8,1), (0.6,0,0,1), (0.8,0,0,1), (1,0,0,1), (0,0,0.5,1), (0,0,1,1)]

#todo: sort Y such that for any Y[i] and Y[j]: i < j implies T[i] < T[j]

zipped = zip(*sorted(zip(T, Y), key=lambda x: x[0]))
T, Y = (list(t) for t in zipped)

for j in range(num_files):

    #color_rand = (T[j]/T_max, 0, j/num_files, 1)#((1-T[j]/T_max), j/num_files, T[j]/T_max, 1)

    plt.plot(X,Y[j], color=colors[j], label="T = " + "{:,}".format(T[j]))

plt.legend(bbox_to_anchor=(0.15, 0.5), loc='upper left', borderaxespad=-6)
plt.show()