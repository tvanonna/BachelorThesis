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
            with open(os.getcwd() + '/' + os.path.basename(file) + '/not_coalesced/output.log', encoding="utf-16le") as data:
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

                ncoal_X.append(new_lines)

                ste = stdev(new_lines) / sqrt(len(new_lines))
                ste = ste * STE_CONST

                ncoal_ste.append(ste)

        if(os.path.isdir(file)):
            with open(os.getcwd() + '/' + os.path.basename(file) + '/coalesced/output.log', encoding="utf-16le") as data:
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

                coal_X.append(new_lines)

                ste = stdev(new_lines) / sqrt(len(new_lines))
                ste = ste * STE_CONST

                coal_ste.append(ste)

        if(os.path.isdir(file)):
            with open(os.getcwd() + '/' + os.path.basename(file) + '/morton_coalesced/output.log', encoding="utf-16le") as data:
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

                coal_morton_X.append(new_lines)

                ste = stdev(new_lines) / sqrt(len(new_lines))
                ste = ste * STE_CONST

                coal_morton_ste.append(ste)

        if(os.path.isdir(file)):
            with open(os.getcwd() + '/' + os.path.basename(file) + '/morton_not_coalesced/output.log', encoding="utf-16le") as data:
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

                ncoal_morton_X.append(new_lines)

                ste = stdev(new_lines) / sqrt(len(new_lines))
                ste = ste * STE_CONST

                ncoal_morton_ste.append(ste)


zipped = zip(*sorted(zip(Y, coal_X, ncoal_X, coal_morton_X, ncoal_morton_X), key=lambda x: x[0]))

Y, coal_X, ncoal_X, coal_morton_X, ncoal_morton_X = (list(t) for t in zipped)

#TODO: implement hypothesis testing here to see which of the settings has a significantly lower value than the rest (if any)
#If one or more groups fail the normality test -> Kruskal-Wallis test -> Dunn's test
#Otherwise: if one of the groups fails Levene's test for equal variance: Kruskal-Wallis -> ...
#Otherwise: ANOVA -> Post-hoc analysis?

def hypothesis_test(data_coalesced, data_not_coalesced, data_morton_coalesced, data_morton_not_coalesced, alpha: int):
    from scipy import stats 
    import scikit_posthocs as ph 

    print("if an index of the shown results[i][j] is true, it means that data[i] is significantly smaller than data[j].")

    for i in range(len(data_coalesced)):
        normal_stat1, normal_pval1 = stats.normaltest(data_coalesced[i], nan_policy='raise')
        normal_stat2, normal_pval2 = stats.normaltest(data_not_coalesced[i], nan_policy='raise')
        normal_stat3, normal_pval3 = stats.normaltest(data_morton_coalesced[i], nan_policy='raise')
        normal_stat4, normal_pval4 = stats.normaltest(data_morton_not_coalesced[i], nan_policy='raise')

        is_normal = (normal_pval1 > alpha) and (normal_pval2 > alpha) and (normal_pval3 > alpha) and (normal_pval4 > alpha)

        if(is_normal):
            levene_stat, levene_pval = stats.levene(data_coalesced[i], data_not_coalesced[i],data_morton_coalesced[i],data_morton_not_coalesced[i], center='mean') 
            equal_variance = bool(levene_pval < alpha)

            statistic, pval = stats.f_oneway(data_coalesced[i], data_not_coalesced[i],data_morton_coalesced[i],data_morton_not_coalesced[i], equal_var=equal_variance)
            print(f"size: {sqrt(Y[i])}, test: ANOVA, statistic: {statistic}, p-value: {pval}, equal variance: {equal_variance}, reject null hypothesis: {(pval < alpha)}")

            pairwise_t = [[False for _ in range(4)] for _ in range(4)]
            pairwise_tp = [[False for _ in range(4)] for _ in range(4)]
            data = [data_coalesced[i], data_not_coalesced[i],data_morton_coalesced[i],data_morton_not_coalesced[i]]

            for j in range(4):
                for ij in range(4):
                    levene_stat2, levene_pval2 = stats.levene(data[j],data[ij], center='mean') 
                    equal_variance2 = bool(levene_pval2 < alpha)

                    t_stat, t_pval = stats.ttest_ind(data[j], data[ij],alternative='less', equal_var=equal_variance2) #one-sided hypothesis test
                    pairwise_t[j][ij] = bool(t_pval < alpha)
                    pairwise_tp[j][ij] = t_pval

            print("0 = data_coalesced, 1 = data_not_coalesced, 2 = data_moton_coalesced, 3 = data_morton_not_coalesced")

            for j in range(4):
                print(f"{j} {pairwise_t[j]}")
                print(f"{j} {pairwise_tp[j]}")
        else:
            statistic, pval = stats.kruskal(data_coalesced[i], data_not_coalesced[i],data_morton_coalesced[i],data_morton_not_coalesced[i], nan_policy='raise')
            print(f"size: {sqrt(Y[i])}, test: Kruskal-Wallis, statistic: {statistic}, p-value: {pval}, reject null hypothesis: {(pval < alpha)}")

            if(pval < alpha):
                data = [data_coalesced[i], data_not_coalesced[i],data_morton_coalesced[i],data_morton_not_coalesced[i]]
                pairwise_u = [[False for _ in range(4)] for _ in range(4)]
                pairwise_up = [[False for _ in range(4)] for _ in range(4)]

                for j in range(4):
                    for ij in range(4):
                        u_stat, u_pval = stats.mannwhitneyu(data[j], data[ij],alternative='less', method='auto') #one-sided hypothesis test
                        pairwise_u[j][ij] = bool(u_pval < alpha)
                        pairwise_up[j][ij] = u_pval
                # dunn_pvals = ph.posthoc_dunn(data, p_adjust='holm')

                print("0 = data_coalesced, 1 = data_not_coalesced, 2 = data_moton_coalesced, 3 = data_morton_not_coalesced")
                for j in range(4):
                    print(f"{j} {pairwise_u[j]}")
                    print(f"{j} {pairwise_up[j]}")

                # print(dunn_pvals<alpha)


hypothesis_test(coal_X, ncoal_X, coal_morton_X, ncoal_morton_X, 0.05)
            
