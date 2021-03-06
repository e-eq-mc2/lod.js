/**
 * @author naoki
 */

"use strict";

$(function() {
//function webGLStart() {
	//var ENABLE_GL_DEBUG = true;
	var ENABLE_GL_DEBUG = false;

	var canvas = document.getElementById("webGLCanvas");
	var gl = initWebGL(canvas, ENABLE_GL_DEBUG);
	var prgObj = initProgram(gl, "vs", "fs");

	gl.useProgram(prgObj); // Don't forget this !!!!

	var uniform = new UniformLocation();
	initLight(gl, prgObj, uniform);
	initMaterial(gl, prgObj, uniform);
	initMatrix(gl, prgObj, uniform);

	var lod = new LOD();
	var tree = lod.initTree(gl, prgObj);

	var angle = 0.0;
	(function drawScene() {
		(function drawMainView() {
			gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
			gl.enable(gl.DEPTH_TEST);
			gl.depthFunc(gl.LEQUAL);
			gl.clearColor(1.0, 1.0, 1.0, 1.0);
			gl.clearDepth(1);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		
      var flen = 0.6;
      var asp  = gl.viewportHeight / gl.viewportWidth;
			var   pMatrix = mat4.frustum(-flen*0.5, flen*0.5, -flen*0.5 * asp, flen*0.5 * asp, 0.2, 25.0);
			var  mvMatrix = mat4.identity(mat4.create());
			var   nMatrix = mat4.identity(mat4.create());
			var mvpMatrix = mat4.identity(mat4.create());

      var damper = Math.cos(angle) < 0.0 ? (1.0 + Math.cos(angle)) : 1.0;
			angle += 0.008 * damper + 0.0005;
      var distance = 12.0;
			mat4.translate(mvMatrix, [0.0, 0.0, - distance - (Math.cos(angle) * distance * 0.95) ]);
			mat4.translate(mvMatrix, [0.0, 0.2, 0.0]);
			mat4.rotateX(mvMatrix, -40.0 / 180 * Math.PI);
			mat4.rotateZ(mvMatrix, angle);
			mat4.translate(mvMatrix, [-0.5, -0.5, 0.0]);
			mat4.transpose(mat4.inverse(mvMatrix, nMatrix));
			mat4.multiply(pMatrix, mvMatrix, mvpMatrix);
			gl.uniformMatrix4fv(uniform.getLocation("pMatrix"), false, pMatrix);
			gl.uniformMatrix4fv(uniform.getLocation("mvMatrix"), false, mvMatrix);
			gl.uniformMatrix4fv(uniform.getLocation("nMatrix" ), false, nMatrix);

			lod.renderTree(tree);
			lod.updateTree(tree, gl, prgObj, mvpMatrix);
		})();
		gl.flush();
		
		printInfo(tree);

		var timeoutId = setTimeout(drawScene, 1.0/30 * 1000);
	} ());
	
	////////////////////
	// local function //
	////////////////////
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
		gl.uniform4fv(uniform.getLocation("materialDiffuse"), [0.6, 0.6, 0.6, 1.0]);
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
	function printInfo(tree) {
		var nodeDim                   = new String(tree.root.dim.x + "x" + tree.root.dim.y);
		var numNodes                  = num2str(tree.numNodes, 5);
		var numLoadingNodes           = tree.numLoadingNodes;
		var acceptableCellSizeMin     = tree.acceptableCellSizeMin;
		var acceptableCellSizeMax     = tree.acceptableCellSizeMax;
    var acceptableNumLoadingNodes = tree.acceptableNumLoadingNodes;
    var barmax = 16;
    var barlen = Math.min(Math.floor(numLoadingNodes/acceptableNumLoadingNodes*barmax), barmax);
		$("#info").html(
			//"<p>Node x-y Dimension:&nbsp;" + nodeDim + "</p>" +
			//"<p>Acceptable Cell Size:&nbsp;" + acceptableCellSizeMin + "px <= Cell <= " + acceptableCellSizeMax + "px</p>" +
			"<p>Loading Nodes:" +  "=".repeat(barlen) + "&nbsp;".repeat(barmax-barlen) + "|" + "</p>" +
			"<p>Nodes in Tree:" + numNodes + "</p>"
		);
		

		////////////////////
		// local function //
		////////////////////
		function num2str(num, digit) {
			var str = new String(num);
			while ( str.length < digit ) {str = " " + str;}
			return str.replace(/ /g, "&nbsp;");
		}
	}
//}
});
