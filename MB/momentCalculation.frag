#version 460
#extension GL_NV_gpu_shader5 : enable
#extension GL_NV_fragment_shader_interlock : enable
layout(pixel_interlock_unordered) in;

uniform layout(binding=0,	rgba32f) coherent image2D momentTex;
uniform layout(binding = 1, rgba32f)    coherent image2D totalMomentTex;


void main(void) {
	float transmittance = 1 - alpha;
	float absorbance = -log(transmittance);

	ivec2 coords=ivec2(gl_FragCoord.xy);
	float depth = gl_FragCoord.z * 2.0 - 1.0;
	
	float depth_pow2 = depth * depth;
	float depth_pow4 = depth_pow2 * depth_pow2;

	beginInvocationInterlockNV();

	vec4 prevMoment = imageLoad(momentTex, coords);			  //b1..4
	vec4 prevTotalMoment = imageLoad(totalMomentTex, coords); //b0

	prevTotalMoment.r += absorbance;

	prevMoment.yw += vec2(depth_pow2, depth_pow4) * absorbance;	   //b_even
	prevMoment.xz += vec2(depth, depth_pow2 * depth) * absorbance; //b_odd
	
	imageStore(momentTex, coords,prevMoment);				  //store b1..4
	imageStore(totalMomentTex, coords,vec4(prevTotalMoment.r,0,0,0)); //store b0

	endInvocationInterlockNV();
}