#!/bin/sh
export OMP_NUM_THREADS=4
#make clean 
rm ../*.json 
set -x
make && time ./mk_data.exe 256 256 8
#make && time ./mk_data.exe 512 512 16
