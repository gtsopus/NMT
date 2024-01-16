#version 460
#extension GL_NV_gpu_shader5 : enable
#extension GL_NV_fragment_shader_interlock : enable
layout(pixel_interlock_unordered) in;

uniform layout(binding = 0, rgba32f) coherent image2D momentTex;
uniform layout(binding = 1, rgba32f)    coherent image2D totalMomentTex;
uniform layout(binding = 2, rgba32f) coherent image2D colorTex;

vec4 computeColor(){} //Generic color function

float mad(float a,float b,float c){
	return a * b + c;
}

float saturate(float x) {
    if (isinf(x)) x = 1.0;
    return clamp(x, 0.0, 1.0);
}

// Code from: Münstermann, Cedrick et al. “Moment-Based Order-Independent Transparency.” 
// Proc. ACM Comput. Graph. Interact. Tech. 1 (2018): 7:1-7:20.

float computeTransmittanceAtDepthFrom4PowerMoments(float b_0, vec2 b_even, vec2 b_odd, float depth, float bias, float overestimation, vec4 bias_vector)
{
	vec4 b = vec4(b_odd.x, b_even.x, b_odd.y, b_even.y);
	
	// Bias input data to avoid artifacts
	b = mix(b, bias_vector, bias);
	vec3 z;
	z[0] = depth;

	// Compute a Cholesky factorization of the Hankel matrix B storing only non-
	// trivial entries or related products
	float L21D11=fma(-b[0],b[1],b[2]);
	float D11=fma(-b[0],b[0], b[1]);
	float InvD11=1.0f/D11;
	float L21=L21D11*InvD11;
	float SquaredDepthVariance=fma(-b[1],b[1], b[3]);
	float D22=fma(-L21D11,L21,SquaredDepthVariance);

	// Obtain a scaled inverse image of bz=(1,z[0],z[0]*z[0])^T
	vec3 c = vec3(1.0f,z[0],z[0]*z[0]);
	// Forward substitution to solve L*c1=bz
	c[1]-=b.x;
	c[2]-=b.y+L21*c[1];
	// Scaling to solve D*c2=c1
	c[1]*=InvD11;
	c[2]/=D22;
	// Backward substitution to solve L^T*c3=c2
	c[1]-=L21*c[2];
	c[0]-=dot(c.yz,b.xy);
	// Solve the quadratic equation c[0]+c[1]*z+c[2]*z^2 to obtain solutions 
	// z[1] and z[2]
	float InvC2=1.0f/c[2];
	float p=c[1]*InvC2;
	float q=c[0]*InvC2;
	float D=(p*p*0.25f)-q;
	float r=sqrt(D);
	z[1]=-p*0.5f-r;
	z[2]=-p*0.5f+r;
	// Compute the absorbance by summing the appropriate weights
	vec3 polynomial;
	vec3 weight_factor = vec3(overestimation, (z[1] < z[0])?1.0f:0.0f, (z[2] < z[0])?1.0f:0.0f);
	float f0=weight_factor[0];
	float f1=weight_factor[1];
	float f2=weight_factor[2];
	float f01=(f1-f0)/(z[1]-z[0]);
	float f12=(f2-f1)/(z[2]-z[1]);
	float f012=(f12-f01)/(z[2]-z[0]);
	polynomial[0]=f012;
	polynomial[1]=polynomial[0];
	polynomial[0]=f01-polynomial[0]*z[1];
	polynomial[2]=polynomial[1];
	polynomial[1]=polynomial[0]-polynomial[1]*z[0];
	polynomial[0]=f0-polynomial[0]*z[0];
	float absorbance = polynomial[0] + dot(b.xy, polynomial.yz);
	// Turn the normalized absorbance into transmittance
	return saturate(exp(-b_0 * absorbance));
}

void main(void) {
	float transmittance = 1 - alpha;

	ivec2 coords=ivec2(gl_FragCoord.xy);
	float depth = gl_FragCoord.z * 2.0 - 1.0;
	float transmittance_at_depth = 1;
    	float total_transmittance = 1;

	beginInvocationInterlockNV();
	
	vec4 bt = imageLoad(totalMomentTex, coords);
	vec4 moments14 = imageLoad(momentTex, coords);

	float b0 = bt.r;

	if (b0 < 0.00100050033f) {
        	discard;
    	}

	total_transmittance = exp(-b0);
	vec4 bias_vector = vec4(0.0, 0.375, 0.0, 0.375);

	moments14 /= b0;
	transmittance_at_depth  = b0*computeTransmittanceAtDepthFrom4PowerMoments(1,vec2(moments14.yw),vec2(moments14.xz),depth,0.00006, 0.25,bias_vector)//as explained in the MB paper	
	float prevTras = bt.g;
	bt = vec4(b0,prevTras+alpha*transmittance_at_depth,0,0); //Used for the normalization

	vec4 color = transmittance_at_depth*computeColor()*alpha; 
	vec4 prevColor = imageLoad(colorTex, coords);
	prevColor = prevColor + color;

	imageStore(colorTex,coords,prevColor);
	imageStore(totalMomentTex, coords,bt); //store b0

	endInvocationInterlockNV();

}
