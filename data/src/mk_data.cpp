#include <cstdio>
#include <cstdlib>
#include <iostream>
#include <fstream>
#include <cmath>
#include <algorithm>
#include <vector>
#include <sys/time.h>

#ifdef _OPENMP
#include <omp.h>
#endif

float zfunc(float x, float y) {
#if 0
	const float z = std::sin(x) * std::sin(y);
#elif 0
	const float z = 0.2 * (std::sin(x)*std::sin(y) + 0.1*std::sin(x*32.0)*std::sin(y*32.0));
#else
	const float a = 0.3; 
	const float sigx = 0.7; 
	const float sigy = 0.7; 
	const float x0 = M_PI; 
	const float y0 = M_PI; 

	const float sigx2 = sigx * sigx;
	const float sigy2 = sigy * sigy;
	const float x2 = (x-x0) * (x-x0);
	const float y2 = (y-y0) * (y-y0);
  const float fxy = 0.05;
	const float z = 
    a * ( std::exp( - (x2/(2.0*sigx2) + y2/(2.0*sigy2)) ) 
      + fxy/2.0*std::sin(x*3.0)*std::sin(y*3.0) 
      + fxy/4.0*std::sin(x*16.0)*std::sin(y*16.0) 
      //+ fxy/8.0*std::sin(x*32.0)*std::sin(y*32.0) 
    );
#endif
	return z;
}

int clamp(int x, int min_x, int max_x) {
	return x >= min_x ? ( x <= max_x ? x : max_x ) : min_x; 
};

struct Image {
	int dim_x;
	int dim_y;
	float dx;
	float dy;
	float *data;

	Image(int _dim_x, int _dim_y, float _sz_x, float _sz_y) {
		dim_x = _dim_x;
		dim_y = _dim_y; 
		dx = _sz_x/_dim_x;
		dy = _sz_y/_dim_y;

		const int dim_xy = dim_x * dim_y;
		data = new float[dim_xy];
	}

	Image(const Image &rhs) {
		dim_x = rhs.dim_x;
		dim_y = rhs.dim_y; 
		dx = rhs.dx;
		dy = rhs.dy;
		const int dim_xy = dim_x * dim_y;
		data = new float[dim_xy];
		std::copy(rhs.data, rhs.data+dim_xy, data);
	}

	~Image() {delete [] data;}

	float &operator() (int ix, int iy) {
    if ( ix <  0     ) ix = 0;
    if ( iy <  0     ) iy = 0;
    if ( ix >= dim_x ) ix = dim_x - 1;
    if ( iy >= dim_y ) iy = dim_y - 1;

		return data[dim_x * iy + ix];
	}

};

double get_time_sec(struct timeval &t) {
	return t.tv_sec + t.tv_usec * 1.0e-6; 

}

int main (int argc, char *argv[]) {
	const int MARGIN = 0;

	if ( argc != (1+3)  ) {
		printf("How to run\n");
		printf(" $ ./a.out <NUM_X> <NUM_Y> <BLOCK_DIM>\n");
		return 0;
	}

	printf("This is %s\n", argv[0]);
	printf("1st argument is %s\n", argv[1]);
	printf("2nd argument is %s\n", argv[2]);
	printf("3rd argument is %s\n", argv[3]);

#ifdef _OPENMP
	printf("Max OpenMP Threads: %d\n", omp_get_max_threads());
#endif

	timeval t0, t1;
	gettimeofday(&t0, NULL);

	const int org_dim_x = std::atoi(argv[1]); 
	const int org_dim_y = std::atoi(argv[2]);
	const int block_dim = std::atoi(argv[3]);
	const float org_sz_x = 1.0;
	const float org_sz_y = 1.0;

	Image org(org_dim_x, org_dim_y, org_sz_x, org_sz_y);
	for (int iy=0; iy<org.dim_y; ++iy) {
		const float y = 2.0 * M_PI * (float)iy / (org.dim_y-1);
		for (int ix=0; ix<org.dim_x; ++ix) {
			const float x = 2.0 * M_PI * (float)ix / (org.dim_x-1);
			const float z = zfunc(x, y);
			org(ix, iy) = z;
		}
	}
	int max_lv = 0;
	while( block_dim*(1<<max_lv) < org_dim_x ) ++max_lv;
	while( block_dim*(1<<max_lv) < org_dim_y ) ++max_lv;

	std::vector<Image *> lod_img(max_lv+1);

	for (int lv=0; lv <= max_lv; ++lv) {
		const int num_blk = 1<<(max_lv-lv);

		const int dim_x = block_dim * num_blk;
		const int dim_y = block_dim * num_blk;

		lod_img[lv] = new Image(dim_x, dim_y, org_sz_x, org_sz_y);

		if ( lv == 0 ) {
			Image &crn = *lod_img[lv  ];
			for (int iy=0; iy < dim_y; ++iy)
			for (int ix=0; ix < dim_x; ++ix) {
				crn(ix, iy) = ix < org.dim_x && iy < org.dim_y ? org(ix, iy) : 0.0;
			}
		} else  {
			Image &crn = *lod_img[lv  ];
			Image &prv = *lod_img[lv-1];
			for (int iy=0; iy < dim_y; ++iy)
			for (int ix=0; ix < dim_x; ++ix) {
				crn(ix, iy) = (
					prv(ix*2-1, iy*2-1) *1.0+
					prv(ix*2-1, iy*2  ) *2.0+
					prv(ix*2-1, iy*2+1) *1.0+

					prv(ix*2  , iy*2-1) *2.0+
					prv(ix*2  , iy*2  ) *4.0+
					prv(ix*2  , iy*2+1) *2.0+

					prv(ix*2+1, iy*2-1) *1.0+
					prv(ix*2+1, iy*2  ) *2.0+
					prv(ix*2+1, iy*2+1) *1.0

				) / 16.0;
			}
		}
	} // lv

	std::string base_path =  "../";
	std::string cnf_fname = base_path + "/config.json"; 
	std::fstream cnf_file(cnf_fname.c_str(), std::ios::out);
	if ( ! cnf_file ) {
		std::printf("Can't open file: %s\n", cnf_fname.c_str());
	}
	cnf_file << "{" << std::endl;
	cnf_file << "    \"numLevel\": " << max_lv + 1<< std::endl; 
	cnf_file << "}" << std::endl;
	cnf_file.close();

	for (int lv=0; lv <= max_lv; ++lv) {
		const int num_blk = 1<<(max_lv-lv);

		Image &crn = *lod_img[lv];

		const float dx = crn.dx;
		const float dy = crn.dy;
#pragma omp parallel for
		for (int blk_iy=0; blk_iy < num_blk; ++blk_iy) {
		for (int blk_ix=0; blk_ix < num_blk; ++blk_ix) {
			const int glv_ix0 = blk_ix * block_dim;
			const int glv_iy0 = blk_iy * block_dim;

			const float blk_x0 = glv_ix0 * dx + 0.5 * dx;
			const float blk_y0 = glv_iy0 * dy + 0.5 * dy;

			const int blk_dim_x = block_dim + MARGIN*2;
			const int blk_dim_y = block_dim + MARGIN*2;

			char dat_fname[512];
			sprintf(dat_fname, "%s/%d_%d_%d.json", base_path.c_str(), lv, blk_ix, blk_iy);
			std::fstream dat_file(dat_fname, std::ios::out);

			dat_file << "{" << std::endl;
			dat_file << "    \"level\": " << lv << "," << std::endl;
			dat_file << "    \"idx\": " << "{\"x\": " << blk_ix << ", " << "\"y\": " << blk_iy << "}," << std::endl;
			dat_file << "    \"dim\": " << "{\"x\": " << blk_dim_x << ", " << "\"y\": " << blk_dim_y << "}," << std::endl;
			dat_file << "    \"offset\": " << "{\"x\": " << blk_x0 << ", " << "\"y\": " << blk_y0 << "}," << std::endl;
			dat_file << "    \"cellSize\": " << "{\"x\": " << dx << ", " << "\"y\": " << dy << "}," << std::endl;

			dat_file << "    \"vertices\": [" << std::endl;
			const int bgn_lcl_ix = 0-MARGIN; const int end_lcl_ix = block_dim+MARGIN;
			const int bgn_lcl_iy = 0-MARGIN; const int end_lcl_iy = block_dim+MARGIN;
			for (int lcl_iy=bgn_lcl_iy; lcl_iy < end_lcl_iy; ++lcl_iy) {
				dat_file << "        ";
				for (int lcl_ix=bgn_lcl_ix; lcl_ix < end_lcl_ix; ++lcl_ix) {
					const int glv_ix = glv_ix0 + lcl_ix;
					const int glv_iy = glv_iy0 + lcl_iy;
					const float z = crn(glv_ix, glv_iy);
					const float x = blk_x0 + lcl_ix * dx;
					const float y = blk_y0 + lcl_iy * dy;
					dat_file << x << ", " << y << ", " << z;
					if ( lcl_ix < end_lcl_ix-1 || lcl_iy < end_lcl_iy-1 ) dat_file << ", ";
				
				}
				dat_file << std::endl;
			}
			dat_file << "    ]" << std::endl;
			dat_file << "}";
			dat_file << std::endl;
			dat_file.close();
		}
		}
	} // lv

	for (int lv=0; lv <= max_lv; ++lv) delete lod_img[lv];

	gettimeofday(&t1, NULL);

	printf("Elapse: %lf sec\n", get_time_sec(t1) - get_time_sec(t0));

	return 0;
}
