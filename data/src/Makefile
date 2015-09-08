TARGET0=mk_data

CXX=g++
#CXX_FLAGS=-fopenmp

OBJ0=mk_data.o

all: ${TARGET0}

.cpp.o:
	${CXX} ${CXX_FLAGS} -c $<

${TARGET0}: ${OBJ0}
	${CXX} ${CXX_FLAGS} $< -o $@

clean:
	rm *.o *.exe
