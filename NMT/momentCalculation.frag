#version 460
#extension GL_NV_gpu_shader5 : enable
#extension GL_NV_fragment_shader_interlock : enable
layout(pixel_interlock_unordered) in;

uniform layout(binding = 0, rgba32f) coherent image2D momentTex;
uniform layout(binding = 1, rgba32f)  coherent image2D totalMomentTex;
uniform layout(binding = 3, rg32f)  coherent image2D minMaxTex;

void main(void) {

	float alpha = 0.2;
	float transmittance = 1 - alpha;

	ivec2 coords=ivec2(gl_FragCoord.xy);

	// Return early if the surface is fully transparent
    	if (transmittance > 0.9999999f) {
        	discard;
   	 }

	beginInvocationInterlockNV();

	//acc
	vec4 prevMoment = imageLoad(momentTex, coords);			  //b1..4
	vec4 prevTotalMoment = imageLoad(totalMomentTex, coords); //b0
	
	
	//Generate Moments
    	float depth = gl_FragCoord.z * 2.0 - 1.0;
	

	float absorbance = -log(transmittance);

	if (absorbance > 10.0f) {
        absorbance = 10.0f;
	}

	float depth_pow2 = depth * depth;
	float depth_pow4 = depth_pow2 * depth_pow2;

	prevTotalMoment.r += absorbance;
	prevTotalMoment.b += 1.0f;

	prevMoment =  prevMoment + vec4(depth, depth_pow2, depth_pow2 * depth, depth_pow4) * absorbance;
	
	imageStore(momentTex, coords,prevMoment);				  //store b1..4
	imageStore(totalMomentTex, coords,vec4(prevTotalMoment.r,0,prevTotalMoment.b,0)); //store b0

	vec4 prevMinMaxDepths = imageLoad(testTex, coords);

	if(gl_FragCoord.z < prevMinMaxDepths.r){
		prevMinMaxDepths.r = gl_FragCoord.z;
	}

	if(gl_FragCoord.z > prevMinMaxDepths.g){
		prevMinMaxDepths.g = gl_FragCoord.z;
	}

	imageStore(minMaxTex, coords,prevMinMaxDepths);


	endInvocationInterlockNV();

}