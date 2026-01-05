import matplotlib.pyplot as plt
import csv, re, sys, random, os
from statistics import stdev
from math import sqrt
import numpy as np
import scipy.stats as stats

def hypothesis_test_artistoo(data1, data2, alpha):
    #for the hypothesis test:
    #it is probably best to do a t-test (which of the two is appropriate at the moment)
    #when the data passes the normality test for most sizes (though I don't expect this to happen often due to the vast amount of outliers in our data)
    #otherwise, use the Mann-Whitney U test.

    count = 0
    method = -1 #0 = t-test, 1= Mann-Whitney U test


    for i in range(len(wgpu_X)):
        # #test for normality
        normal_stat1, normal_pval1 = stats.normaltest(data2[i], nan_policy='raise')
        normal_stat2, normal_pval2 = stats.normaltest(data1[i], nan_policy='raise')

        is_normal = (normal_pval1 > alpha) and (normal_pval2 > alpha) #not '<' since we aim to accept H_0 (that the distribution is normal)

        if(is_normal):
            # #levene test to see whether 
            # #if it is true: perform Student's t-test. Otherwise, perform Welch's t-test.
            levene_stat, levene_pval = stats.levene(data1[i], data2[i], center='mean') 
            equal_variance = levene_pval < alpha

            statistic, pval = stats.ttest_ind(data1[i], data2[i],alternative='less', equal_var=equal_variance) #one-sided hypothesis test
            print(f"size: {sqrt(Y[i])}, test: T-test, t-statistic: {statistic}, p-value: {pval}, equal variance: {equal_variance}, reject null hypothesis: {(pval < alpha)}")
        else:
            statistic, pval = stats.mannwhitneyu(data1[i], data2[i], alternative='less', method='exact')
            print(f"size: {sqrt(Y[i])}, test: Mann-Whitney U-test, U-statistic: {statistic}, p-value: {pval}, reject null hypothesis: {(pval < alpha)}")

STE_CONST = 1

Y = [] #stores all sizes

artistoo_X = [] 
artistoo_ste = [] 

wgpu_X = []
wgpu_ste = []

with os.scandir('./webgpu/benchdata/.') as files:
    for file in files:

        size = int(os.path.basename(file))
        size = size * size

        Y.append(size)

        if(os.path.isdir(file)):
            with open(os.getcwd() + '/webgpu/benchdata/' + os.path.basename(file) + '/not_coalesced/output.log', encoding='utf-16le') as data:
                content = data.read()

                lines = content.split(sep="\n")
                lines.pop(0)
                lines.pop(len(lines) - 1)

                new_lines = []

                for line in lines:
                    hrs, min, sec = map(float, line.split(':'))
                    time = sec + 60 * min + 3600 * hrs 

                    line = float(time) #for now we are only interested in the first entry of each row (i.e. the total exec time)
                    new_lines.append(line)

                # avg = sum(new_lines) / len(new_lines)

                wgpu_X.append(new_lines)

                ste = stdev(new_lines) / sqrt(len(new_lines))
                ste = ste * STE_CONST

                wgpu_ste.append(ste)

for size in Y:
    val = int(sqrt(size))
    with open(os.getcwd() + '/artistoo/benchdata/' + str(val) + '.txt', encoding='utf-16le') as data:
        content = data.read()

        lines = content.split(sep="\n")
        lines.pop(0)
        lines.pop(len(lines) - 1)

        new_lines = []

        for line in lines:
            hrs, min, sec = map(float, line.split(':'))
            time = sec + 60 * min + 3600 * hrs 

            line = float(time) #for now we are only interested in the first entry of each row (i.e. the total exec time)
            new_lines.append(line)

        #avg = sum(new_lines) / len(new_lines)

        artistoo_X.append(new_lines)

        ste = stdev(new_lines) / sqrt(len(new_lines))
        ste = ste * STE_CONST

        artistoo_ste.append(ste)

zipped = zip(*sorted(zip(Y, wgpu_X, wgpu_ste, artistoo_X, artistoo_ste), key=lambda x: x[0]))

Y, wgpu_X, wgpu_ste, artistoo_X, artistoo_ste = (list(t) for t in zipped)

print('Windows Ising Model WebGPU vs. Artistoo Comparison')
hypothesis_test_artistoo(wgpu_X, artistoo_X, 0.05)
    
