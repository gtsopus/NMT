#version 460
#extension GL_NV_gpu_shader5 : enable
#extension GL_NV_fragment_shader_interlock : enable

layout(pixel_interlock_unordered) in;

out vec4 FragColor;

uniform layout(binding = 0, rgba32f) coherent image2D momentTex;
uniform layout(binding = 1, rgba32f)    coherent image2D totalMomentTex;
uniform layout(binding = 2, rgba32f) coherent image2D colorTex;

uniform sampler2D opaqueBG;

void main(){
	ivec2 coords=ivec2(gl_FragCoord.xy);
	vec4 color = imageLoad		(colorTex, coords);

	vec4 bgColor = ...; //Background color


	vec4 bt = imageLoad(totalMomentTex, coords);
	vec4 prevMoment = imageLoad(momentTex, coords);			  //b1..4

	float b0 = bt.r;

	if(b0 == 0){
		FragColor = bgColor;
		return;
	}

	float cc = 1 - exp(-b0);
	cc = cc/bt.g;


	FragColor = cc*color + exp(-b0)*bgColor; //bgColor = white

	imageStore(momentTex,		coords,vec4(0.0f));
	imageStore(totalMomentTex,  coords,vec4(0.0f));
	imageStore(colorTex,		coords,vec4(0.0f));
}