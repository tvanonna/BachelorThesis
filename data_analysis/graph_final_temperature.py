import matplotlib.pyplot as plt
import csv, re, sys, random, os

X = []
Y = []

T = []
T_max = 0

num_files = 0
filelist = []

num_values = 0
final_energy = []

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
                        X.append((i))

                    Y[j].append(val)

                    # if(val < minval or minval == 0):
                    #     minval = X[len(X) - 1]

                i = i + 1

            num_values = i

for j in range(num_files):
    final_energy.append(Y[j][num_values - 2])

figure = plt.figure()
figure.set_figwidth(10)
figure.set_figheight(10)
figure.set_dpi(100)

#plt.title('Temperature and Final Energy')
plt.xlabel('Temperature (T)')
plt.ylabel('Final Energy (J)')

plt.xscale('log')
#plt.yscale('log')

val = []

for j in range(num_files):
    val.append((T[j], final_energy[j]))

val.sort(key= lambda tuple: tuple[0])

X_new = []
Y_new = []

for j in range(num_files):

    X_new.append(val[j][0])
    Y_new.append(val[j][1])


plt.plot(X_new,Y_new, color=(1,0,0,1))

minval = min(Y_new)
index = 0

for i in range(len(Y_new)):
    if(Y_new[i] == minval):
        index = i
        break

print(X_new[index])

# print(minval)

plt.show()