function initWebGL(canvas, ENABLE_GL_DEBUG) {

	// Try to grab the standard context. If it fails, fallback to experimental.
    var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
	
	if ( ! gl ) {
		alert("webgl is not available ... orz...");
		return null;
	}

	console.log("ENABLE_GL_DEBUG : " + ENABLE_GL_DEBUG);

	if ( ENABLE_GL_DEBUG ) {
		var PRINT_LOG = false;
		var numGLCall = 0;
		if ( PRINT_LOG ) {
			gl = WebGLDebugUtils.makeDebugContext( gl, undefined, 
				function (functionName, args) {
					++numGLCall;
					console.log(
						"called(" + numGLCall + "):" + 
						"gl." + functionName + "(" + WebGLDebugUtils.glFunctionArgsToString(functionName, args) + ")"
					);
				}
			);		
		} else {
			gl = WebGLDebugUtils.makeDebugContext( gl, undefined);
		}
	}

  var cw = canvas.width;
  var ch = canvas.height;

  // set the display size of the canvas.
  canvas.style.width = cw + "px";
  canvas.style.height = ch + "px";

  var dpr = window.devicePixelRatio || 1;
  canvas.width = cw * dpr;
  canvas.height = ch * dpr;

	gl.viewportWidth  = canvas.width ;
	gl.viewportHeight = canvas.height;

	return gl;
}
	
function initProgram(gl, vertexShaderID, fragmentShaderID) {
	var vertexShaderObj   = initShader(gl, document.getElementById(vertexShaderID).text  , gl.VERTEX_SHADER  );
	var fragmentShaderObj = initShader(gl, document.getElementById(fragmentShaderID).text, gl.FRAGMENT_SHADER);

	var programObj = gl.createProgram();
	gl.attachShader(programObj, vertexShaderObj  );
	gl.attachShader(programObj, fragmentShaderObj);
	gl.linkProgram(programObj);
	if ( ! gl.getProgramParameter(programObj, gl.LINK_STATUS) ) {
		alert("webgl SHADER LINK ERROR\n" + gl.getProgramInfoLog(programObj));
		return null;
	}
	return programObj;
	
	////////////////////
	// local function //
	////////////////////
	function initShader(gl, shaderID, shaderType) {
		var shaderObj = gl.createShader(shaderType);
		gl.shaderSource(shaderObj, shaderID);
		gl.compileShader(shaderObj);	
		if ( ! gl.getShaderParameter(shaderObj, gl.COMPILE_STATUS) ) {
			var shaderTypeName = glEnumToString(gl, shaderType);
			alert("webgl " + shaderTypeName + " COMPILE ERROR : \n" + gl.getShaderInfoLog(shaderObj));
			return null;
		}
		return shaderObj;
	}	
}

function glEnumToString(gl, glEnum) {
	for (var propertyName in gl) {
		var property = gl[propertyName]; 
		if ( typeof property == "number" && property == glEnum ) {
			return propertyName;
		}
	}
	return null;
}

function Attrib(gl, prgObj) {
	this.gl = gl;
	this.prgObj = prgObj;
	this.buffer = {};
	this.target = {};
	this.location = {};
	this.setBuffer = function (name, target, data) {
		var gl = this.gl;
		this.buffer[name] = gl.createBuffer();
		this.target[name] = target;

		gl.bindBuffer(this.target[name], this.buffer[name]);
		gl.bufferData(this.target[name], data, gl.STATIC_DRAW);
		gl.bindBuffer(this.target[name], null);
	};
	this.linkBuffer = function (name, stride, type) {
		var gl = this.gl;
		var prgObj = this.prgObj;
		this.location[name] = gl.getAttribLocation(prgObj, name);
		gl.bindBuffer(this.target[name], this.buffer[name]);
		gl.vertexAttribPointer(
			this.location[name],
			stride,
			type,
			false, 0, 0
		);
		gl.bindBuffer(this.target[name], null);
		gl.enableVertexAttribArray(this.location[name]);
	};
	this.bindBuffer = function (name) {
		var gl = this.gl;
		gl.bindBuffer(this.target[name], this.buffer[name]);
	};
	this.replaceData = function (name, data) {
		var gl = this.gl;
		gl.bindBuffer(this.target[name], this.buffer[name]);
		gl.bufferData(this.target[name], data, gl.STATIC_DRAW);
		gl.bindBuffer(this.target[name], null);
	};
	this.deleteBuffer = function (name) {
		var gl = this.gl;
		gl.deleteBuffer(this.buffer[name]);
	};
	this.deleteAllBuffers = function () {
		var gl = this.gl;
		for (name in this.buffer) {
			if ( this.buffer.hasOwnProperty(name) ) {
				gl.deleteBuffer(this.buffer[name]);
			}
		}
	};
}

function UniformLocation () {
	this.location = {};
	this.setLocation = function(name, gl, prgObj) {
			this.location[name] = gl.getUniformLocation(prgObj, name);
	};
	this.getLocation = function(name) { 
		return this.location[name];
	};
}
