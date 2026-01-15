# BachelorThesis
A reporsitory containing the code and raw data used in my Bachelor's Thesis. For more information, please read the thesis. If there are any questions, feel free to contact me. 


## 1 Code

The code for the WebGPU Ising model was created by Johannes Textor and expanded upon by me. The code for the WebGPU CPM was created by Jan Schering from the WebGPU Ising model and further expanded upon by me. 

The included Artistoo files are the edited versions of the Ising model and cell sorting examples from Artistoo, which were used to compare the performance against the WebGPU Ising model and CPM respectively. The original examples were created by the contributors of Artistoo. 

## 2 Data

The 'data' folder contains all the raw data that was processed for the purposes of this thesis. All of this data was gathered by me, except for the MacOS benchmarking data (which was done by Johannes Textor). The p-values, speed-ups and effect sizes which were computed for the benchmarking experiment are output by the Python script as latex text, so the data looks exactly like it does in the Bachelor Thesis PDF.

## 3 Data Analysis

This folder contains the python files that were used to process the data. Each of these has been written by me. The 'windows' folder contains the files that were used to specifically process the Windows data (these are mostly the same but use a different encoding). The other python scripts were used for the Linux/MacOS data. 
