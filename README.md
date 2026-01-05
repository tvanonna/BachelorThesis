# BachelorThesis
A reporsitory containing the code and raw data used in my Bachelor's Thesis. For more information, please read the thesis. If there are any questions, feel free to contact me. 


## 1 Code

The code for the WebGPU Ising model was created by Johannes Textor and expanded upon by me. The code for the WebGPU CPM was created by Jan Schering from the WebGPU Ising model and further expanded upon by me. 

The included Artistoo files are the edited versions of the Ising model and cell sorting examples from Artistoo, which were used to compare the performance against the WebGPU Ising model and CPM respectively. The original examples were created by the contributors of Artistoo. 

## 2 Data

The 'data' folder contains all the raw data that was processed for the purposes of this thesis. All of this data was gathered by me, except for the MacOS benchmarking data (which was done by Johannes Textor).

The results of the hypothesis tests may be difficult to comprehend, so I will explain them here. Each setting is given a number from 0-3 (which is which is explained in the file itself). Afterwards (if the null hypothesis can be rejected that all settings have the same execution time) a 2D array is shown. The first number printed shows for which setting the pariwise-tests are performed (i.e. the setting for which we want to determine whether it has a smaller execution time than the other settings). The results [i][j] show whether the execution times of setting i are significantly smaller than that of setting j. The first row shows whether we can reject the null hypothesis of no difference between settings i and j, where as the second line shows the computed p-values. For more information on how this number was calculated, please refer to 'data_analysis/benchdata_t_test.py'.

## 3 Data Analysis

This folder contains the python files that were used to process the data. Each of these has been written by me.
