/**
 * @author naoki
 */

"use strict";

function webGLStart() {
	var GL_DEBUG_MODE = true;
	//var GL_DEBUG_MODE = false;

	var canvas = document.getElementById("webGLCanvas");
	var gl = initWebGL(canvas, GL_DEBUG_MODE);
	var prgObj = initProgram(gl, "vs", "fs");

	gl.useProgram(prgObj); // Don't forget this 

	var uniform = new UniformLocation();
	initLight(gl, prgObj, uniform);
	initMaterial(gl, prgObj, uniform);
	initMatrix(gl, prgObj, uniform);

	var lod = new LOD();
	var tree = lod.initTree(gl, prgObj);

	var angle = 0.0;
	(function drawScene() {
		gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LEQUAL);
		gl.clearColor(1.0, 1.0, 1.0, 1.0);
		gl.clearDepth(1);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		
		var   pMatrix = mat4.frustum(-0.3, 0.3, -0.3, 0.3, 0.5, 10.0);
		var  mvMatrix = mat4.identity(mat4.create());
		var   nMatrix = mat4.identity(mat4.create());
		var mvpMatrix = mat4.identity(mat4.create());

		angle += 0.01;
		mat4.translate(mvMatrix, [0.0, 0.0, -4.8 + Math.sin(angle * 0.5)*4.0]);
		mat4.translate(mvMatrix, [0.0, 0.2, 0.0]);
		mat4.rotateX(mvMatrix, -45.0/ 180 * Math.PI);
		mat4.rotateZ(mvMatrix, angle);
		mat4.translate(mvMatrix, [-0.5, -0.5, 0.0]);
		mat4.transpose(mat4.inverse(mvMatrix, nMatrix));
		mat4.multiply(pMatrix, mvMatrix, mvpMatrix);
		gl.uniformMatrix4fv(uniform.getLocation("pMatrix"), false, pMatrix);
		gl.uniformMatrix4fv(uniform.getLocation("mvMatrix"), false, mvMatrix);
		gl.uniformMatrix4fv(uniform.getLocation("nMatrix" ), false, nMatrix);

		lod.renderTree(tree);
		lod.updateTree(tree, gl, prgObj, mvpMatrix);
		gl.flush();
	
		var timeoutId = setTimeout(drawScene, 1.0/30 * 1000);
	} ());
	
	function initLight(gl, prgObj, uniform) {
		//var uniform = new UniformLocation();
		uniform.setLocation("lightPosition", gl, prgObj);
		uniform.setLocation("lightDiffuse" , gl, prgObj);
		uniform.setLocation("lightAmbient" , gl, prgObj);
		gl.uniform3fv(uniform.getLocation("lightPosition"), [0, 0, 0]);
		gl.uniform4fv(uniform.getLocation("lightAmbient" ), [1.0, 1.0, 1.0, 1.0]);
		gl.uniform4fv(uniform.getLocation("lightDiffuse" ), [1.0, 1.0, 1.0, 1.0]);
	}
	function initMaterial(gl, prgObj, uniform) {
		//var uniform = new UniformLocation();
		uniform.setLocation("materialAmbient", gl, prgObj);
		uniform.setLocation("materialDiffuse", gl, prgObj);
		gl.uniform4fv(uniform.getLocation("materialAmbient"), [0.1, 0.1, 0.1, 1.0]);
		gl.uniform4fv(uniform.getLocation("materialDiffuse"), [0.5, 0.5, 0.5, 1.0]);
	}
	function initMatrix(gl, prgObj, uniform) {
		//var uniform = new UniformLocation();
		uniform.setLocation("pMatrix" , gl, prgObj);
		uniform.setLocation("mvMatrix", gl, prgObj);
		uniform.setLocation("nMatrix" , gl, prgObj);
		uniform.setLocation("lMatrix" , gl, prgObj);

		var  pMatrix = mat4.identity(mat4.create());
		var mvMatrix = mat4.identity(mat4.create());
		var  lMatrix = mat4.identity(mat4.create());

		gl.uniformMatrix4fv(uniform.getLocation("pMatrix" ), false,  pMatrix);
		gl.uniformMatrix4fv(uniform.getLocation("mvMatrix"), false, mvMatrix);
		gl.uniformMatrix4fv(uniform.getLocation("nMatrix" ), false, mat4.transpose(mat4.inverse(mvMatrix)));
		gl.uniformMatrix4fv(uniform.getLocation("lMatrix" ), false,  lMatrix);
	}
	function initAttrib(gl, prgObj, model, attrib) {
		//var attrib = new Attrib();
		attrib.setBuffer ("vertexPosition", gl, gl.ARRAY_BUFFER        , model.vertices);
		attrib.setBuffer ("vertexNormal"  , gl, gl.ARRAY_BUFFER        , model.normals);
		attrib.setBuffer ("vertexIndex"   , gl, gl.ELEMENT_ARRAY_BUFFER, model.indices);

		attrib.linkBuffer("vertexPosition", gl, prgObj, 3, gl.FLOAT);
		attrib.linkBuffer("vertexNormal"  , gl, prgObj, 3, gl.FLOAT);
		attrib.bindBuffer("vertexIndex", gl);
	}
}