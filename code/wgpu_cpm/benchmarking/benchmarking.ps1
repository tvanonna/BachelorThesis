Set-ExecutionPolicy -ExecutionPolicy RemoteSigned #makes sure we have the permissions to run deno

$Sizes = 512, 768, 1024, 1536, 2048, 2671, 3072, 3584, 4096
$Iterations = 9, 9, 9, 4, 4, 2, 2, 2, 2

$S_length = $Sizes.count

if(Test-Path -Path "benchdata"){
    Write-Host "ERROR: directory benchdata already exists. Terminating..."
    Exit 
} 

New-Item -Path . -Name "benchdata" -ItemType "Directory" | Out-Null

#print device information
deno run --allow-all --unstable-raw-imports ../src/main.js 512 512 10 true false | Out-File -FilePath "benchdata/settings.log"
#echo "GPU Used During Benchmarking: $((Get-WmiObject Win32_VideoController).Name)" | Out-File -Append -FilePath "benchdata/settings.log"
echo "CPU Used During Benchmarking: $((Get-WmiObject Win32_Processor).Name)" | Out-File -Append -FilePath "benchdata/settings.log"

for(($i = 0); $i -lt $S_length; $i++){
    $size = $Sizes[$i]
    $iter = $Iterations[$i]

    $base_dir1 = "benchdata/$($size)/coalesced"
    $base_dir2 = "benchdata/$($size)/not_coalesced"
    $base_dir3 = "benchdata/$($size)/morton_coalesced"
    $base_dir4 = "benchdata/$($size)/morton_not_coalesced"

    New-Item -Path "benchdata" -Name "$($size)" -ItemType "Directory" | Out-Null

    New-Item -Path "benchdata/$($size)" -Name "coalesced" -ItemType "Directory" | Out-Null
    New-Item -Path "benchdata/$($size)" -Name "not_coalesced" -ItemType "Directory" | Out-Null
    New-Item -Path "benchdata/$($size)" -Name "morton_not_coalesced" -ItemType "Directory" | Out-Null
    New-Item -Path "benchdata/$($size)" -Name "morton_coalesced" -ItemType "Directory" | Out-Null

    echo "hours:minutes:seconds.subseconds" | Out-File -FilePath "$($base_dir1)/output.log"
    echo "hours:minutes:seconds.subseconds" | Out-File -FilePath "$($base_dir2)/output.log"
    echo "hours:minutes:seconds.subseconds" | Out-File -FilePath "$($base_dir3)/output.log"
    echo "hours:minutes:seconds.subseconds" | Out-File -FilePath "$($base_dir4)/output.log"

    for(($j = 0); $j -le $iter; $j++){
        #memory coalescing turned on, morton turned off
        (Measure-Command {deno run --allow-all --unstable-raw-imports ../src/main.js $size $size 10 true false}).ToString() | Out-File -Append -FilePath "$($base_dir1)/output.log" 
        #coalescing turned off, morton turned off
        (Measure-Command {deno run --allow-all --unstable-raw-imports ../src/main.js $size $size 18 false false}).ToString() | Out-File -Append -FilePath "$($base_dir2)/output.log" 
        #coalescing turned on, morton turned on
        (Measure-Command {deno run --allow-all --unstable-raw-imports ../src/main.js $size $size 18 true true}).ToString() | Out-File -Append -FilePath "$($base_dir3)/output.log" 
        #coalescing turned off, morton turned on
        (Measure-Command {deno run --allow-all --unstable-raw-imports ../src/main.js $size $size 18 false true}).ToString() | Out-File -Append -FilePath "$($base_dir4)/output.log" 
    }
    
}