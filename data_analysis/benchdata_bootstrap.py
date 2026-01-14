import matplotlib.pyplot as plt
import csv, re, sys, random, os
from statistics import stdev
from math import sqrt

from scipy import stats
import numpy as np 

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

                #avg = sum(new_lines) / len(new_lines)

                ncoal_X.append(new_lines)

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

                #avg = sum(new_lines) / len(new_lines)

                coal_X.append(new_lines)

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

                #avg = sum(new_lines) / len(new_lines)

                coal_morton_X.append(new_lines)

                ste = stdev(new_lines) / sqrt(len(new_lines))
                ste = ste * STE_CONST

                coal_morton_ste.append(ste)

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

                #avg = sum(new_lines) / len(new_lines)

                ncoal_morton_X.append(new_lines)

                ste = stdev(new_lines) / sqrt(len(new_lines))
                ste = ste * STE_CONST

                ncoal_morton_ste.append(ste)


zipped = zip(*sorted(zip(Y, coal_X, ncoal_X, coal_morton_X, ncoal_morton_X), key=lambda x: x[0]))

Y, coal_X, ncoal_X, coal_morton_X, ncoal_morton_X = (list(t) for t in zipped)

def get_ci(b_data):

    #since most of the data is not normal, we will use bootstrapping to generate confidence intervals

    res = stats.bootstrap([b_data], statistic=np.mean,  n_resamples=10000, confidence_level=0.95, alternative='two-sided', method='percentile', axis=0)

    ci = res.confidence_interval
    return (ci[0], ci[1])

def get_u(b_data, baseline):
    u, p = stats.mannwhitneyu(b_data, baseline, alternative='less', method='exact')
    return u

def get_r(u, n_1, n_2):
    #based on the computation of z as described below
    #https://pmc.ncbi.nlm.nih.gov/articles/PMC12701665/

    #when r is negative, the former sample group (i.e. the first arg to get_effect_size)
    #is smaller than the latter (i.e. the second arg)

    teller = u - (0.5 * n_1 * n_2)
    noemer = sqrt((n_1 * n_2 * (n_1 + n_2 + 1)) / 12)

    z = teller / noemer 

    r = z / sqrt(n_1 + n_2)

    return r

def get_effect_size(b_data, baseline):
    u_val, p_val = stats.mannwhitneyu(b_data, baseline, alternative='less', method='exact')

    res = stats.bootstrap([b_data, baseline], statistic=get_u, n_resamples=10000, confidence_level=0.95, alternative='two-sided', method='percentile', axis=0)
    ci = res.confidence_interval

    ns = len(b_data) #both samples have the same size so this is fine

    z_val = get_r(u_val, ns, ns) #these are r values, not z values
    z_ci_low = get_r(ci[0], ns, ns)
    z_ci_high = get_r(ci[1], ns, ns)

    return(z_val, z_ci_low, z_ci_high, p_val) #contains the effect size, and effect size of CI percentiles

def compute_baseline_improvement(b_data, ci, baseline):

    #computes the mean difference between the execution time on some setting 
    #to that of the 'baseline' (i.e. mean execution time where  both memory prefetching and Morton indexing)
    #are disabled

    mean = np.mean(b_data)
    mean_baseline = np.mean(baseline)

    impr_mean = ((mean_baseline - mean) / mean_baseline) * 100 #mean improvement
    impr_low = ((mean_baseline - ci[0]) / mean_baseline) * 100 #improvement of lower CI percentile
    impr_high = ((mean_baseline - ci[1]) / mean_baseline) * 100 #improvement of higher CI percentile

    return (impr_mean, impr_low, impr_high)


def compute_all(grid_size, b_data, baseline, setting):
    
    width = int(np.sqrt(grid_size))

    ci = get_ci(b_data)
    ez = get_effect_size(b_data, baseline)
    impr = compute_baseline_improvement(b_data, ci, baseline)

    print(f"{width}x{width} & {setting} & {round(impr[0],2)}({round(impr[1],2)}-{round(impr[2],2)})% & r = {round(ez[0],2)}({round(ez[1],2)}-{round(ez[2],2)}) & p = {round(ez[3],2)}")
    

print("Grid Size & Setting & Performance Improvement Over Baseline & Effect Size & P-value")

for i in range(len(Y)):
    compute_all(Y[i], coal_X[i], ncoal_X[i], "Prefetching Enabled, Morton Disabled") #ncoal is always the baseline (since both features are disabled here)
    compute_all(Y[i], coal_morton_X[i], ncoal_X[i], "Prefetching Enabled, Morton Enabled")
    compute_all(Y[i], ncoal_morton_X[i], ncoal_X[i], "Prefetching Disabled, Morton Enabled")

    print('\n')
    





            
