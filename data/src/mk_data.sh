#!/bin/sh
export OMP_NUM_THREADS=4
#make clean 
rm ../*.json 
set -x
#make && time ./mk_data 256 256 8
#make && time ./mk_data 512 512 16
make && time ./mk_data 1024 1024 16
