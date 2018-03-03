var LOD = function () {
  //////////////////////
  // private variable //
  //////////////////////
  var _connector = new function () {
    this.baseURL = document.URL.replace(/[^/]+$/, "") + "data";
    this.getConfigURL = function () { 
      var url = this.baseURL + "/" + "config.json";
      return url;
    };
    this.getNodeURL = function (lv, ix, iy) { 
      var url = this.baseURL + "/" + lv+"_"+ix+"_"+iy+".json";
      return url;
    };
    this.getJson = function(url, async, onload, onloadArgs) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, async);
      xhr.onreadystatechange = function () {
        if ( xhr.readyState == 4 /**/) { 
          if ( xhr.status == 200 || ( xhr.status == 0 && document.domain.length == 0 ) ) {
            var json = JSON.parse(xhr.responseText);
            onloadArgs.push(json);
            onload.apply(null, onloadArgs);
          } else {
            //alert(
            console.log(
              "There was a ploblem loading the file: " + url + "\n" + 
              "HTML error code: " + xhr.status
            ); 
                
          }
        }
      }; // function
      //to fix "Not well-formed" firefox error while looping through JSON file 
      xhr.overrideMimeType("application/json");
      xhr.send();
    };
  };

  this.initTree = function (gl, prgObj) {
    var tree = {
      "root": null,
      "numLevel": 0,
      "numNodes": 0,
      "numLoadingNodes": 0,
      "acceptableCellSizeMax": 5.0, // if max cell length of a node in pixel go over  this number, the node is divided
      "acceptableCellSizeMin": 2.0, // if max cell length of a node in pixel go under this number, the node is composited
      "acceptableNumNodes": 4096,
      "acceptableNumLoadingNodes": 64
    };
    loadConfig(tree);
    addRoot(tree, gl, prgObj);

    return tree;
    
    ////////////////////
    // local function //
    ////////////////////
    function loadConfig(tree) {
      var url = _connector.getConfigURL();
      var async = false;
      _connector.getJson(url, async, onload, [tree]);
  
      return;
      
      ////////////////////
      // local function //
      ////////////////////
      function onload(tree, json) {
        // lock tree
        tree.numLevel = json.numLevel;
        // unlock tree
      }
    }
    function addRoot(tree, gl, prgObj) {
      var lv = tree.numLevel - 1;
      var ix = 0;
      var iy = 0;
      var url = _connector.getNodeURL(lv, ix, iy);
      var async = false;
      _connector.getJson(url, async, onload, [tree, gl, prgObj]);
  
      return;
  
      ////////////////////
      // local function //
      ////////////////////
      function onload(tree, gl, prgObj, json) {
        var node = new Node(json, gl, prgObj);
        node.attrib.setBuffer ("vertexIndex"   , gl.ELEMENT_ARRAY_BUFFER, new Uint16Array (node.indices ));
        // lock tree
        tree.root = node;
        ++tree.numNodes;
        // unlock tree
      }
    }
  };

  this.updateTree = function (tree, gl, prgObj, mvpMatrix) {
    var viewportWidth  = gl.viewportWidth;
    var viewportHeight = gl.viewportHeight;
    var acceptableCellSizeMax = tree.acceptableCellSizeMax;
    var acceptableCellSizeMin = tree.acceptableCellSizeMin;
    var acceptableNumNodes = tree.acceptableNumNodes;
    var acceptableNumLoadingNodes = tree.acceptableNumLoadingNodes;
    //console.log("tree.numNodes:" + tree.numNodes);
    (function traverse(node) {
      var dpxl = deltaPixels(node, mvpMatrix, viewportWidth, viewportHeight);
      // lock node
      if ( node.getNumReadyChildren() == 4 ) {
        // unlock node
        //0.5x number is used, because it is compared with parent node's value
        if ( dpxl.maxCellSize * 0.5 < acceptableCellSizeMin && dpxl.isInsideFrustum ) {
          deleteChildren(node, tree);
        } else {
          for (var childIdx=0; childIdx < 4; ++childIdx) {
            traverse(node.children[childIdx]);
          }
        }
      } else {
        if ( dpxl.maxCellSize > acceptableCellSizeMax && dpxl.isInsideFrustum && node.level > 0 ) {
          // lock tree
          if ( tree.numNodes < acceptableNumNodes && tree.numLoadingNodes < acceptableNumLoadingNodes ) {
            // unlock tree
            // lock node
            if ( node.getNumLoadingChildren() == 0 ) {
              node.loadingChildren = 1<<0 | 1<<1 | 1<<2 | 1<<3; // make all bits up
              // unlock node
              for (var childIdx=0; childIdx < 4; ++childIdx) {
                addChild(node, childIdx, tree, gl, prgObj);
              }
            }
            // unlock node
          }
          // unlock tree
        }
      }
    } (tree.root));
    
    return;

    ////////////////////
    // local function //
    ////////////////////
    function addChild(parent, childIdx, tree, gl, prgObj) {
      var lv = parent.level - 1;
      var ix = parent.idx.x*2 + (childIdx & 1 ? 1 : 0);
      var iy = parent.idx.y*2 + (childIdx & 2 ? 1 : 0);
      var url = _connector.getNodeURL(lv, ix, iy);
      var async = true;
      _connector.getJson(url, async, onload, [parent, childIdx, tree, gl, prgObj]);
      tree.numNodes += 1;
      tree.numLoadingNodes += 1;
  
      return;
    
      ////////////////////
      // local function //
      ////////////////////
      function onload(parent, childIdx, tree, gl, prgObj, json) {
        var node = new Node(json, gl, prgObj);
        // lock parent
        parent.children[childIdx] = node;
        parent.readyChildren |= 1<<childIdx;
        parent.loadingChildren &= ~(1<<childIdx);
        // unlock parent
        // lock tree
        //if ( parent.getNumReadyChildren() == 4 ) {
        //  tree.numNodes += 4;
        //}
        // unlock tree
        tree.numLoadingNodes -= 1;
      }
    }
    function deleteChildren(node, tree) {
      if ( node.getNumLoadingChildren() > 0 ) {
        return false;
      }
      
      if ( node.getNumReadyChildren() == 4 ) {
        var numDeletableChildren = 0;
        for (var childIdx=0; childIdx < 4; ++childIdx) {
          if ( deleteChildren(node.children[childIdx], tree) ) {
            ++numDeletableChildren;
          }
        }
        // This node's children can't be deleted.
        // Because some of the children are in loading status.
        if ( numDeletableChildren < 4 ) return false;

        for (var childIdx=0; childIdx < 4; ++childIdx) {
          // lock node
          node.readyChildren &= ~(1<<childIdx);
          node.children[childIdx].destroy();
          node.children[childIdx] = null;
          // unlock node
          tree.numNodes -= 1;
        }
        // lock tree
        // unlock tree
      } 
      return true;
    }
    function deltaPixels(node, mvpMatrix, viewportWidth, viewportHeight) {
      var offX = node.offset.x;
      var offY = node.offset.y;
      var cszX = node.cellSize.x;
      var cszY = node.cellSize.y;
      var numcX = node.dim.x - 1;
      var numcY = node.dim.y - 1;
      var  szX = (numcX - 1) * cszX;
      var  szY = (numcY - 1) * cszY;
    
      var maxPxl = 0.0;
      var numInsideFrustum = 0;
      var vws = [];
      for (var corner=0; corner < 4; ++corner) { // find the maximum value of 4 corners
        // Object Coordinates
        var ox = offX + szX * (corner&1?1:0);
        var oy = offY + szY * (corner&2?1:0);
        var oz = 0.0;
        var vw = xyz2win(ox, oy, oz, mvpMatrix, viewportWidth, viewportHeight);

        if ( vw.isInsideFrustum ) ++numInsideFrustum;
        vws[corner] = vw;
      }

      //  2------3
      //  |      |
      //  |      |
      //  0------1

      var i01=[[0,1],[1,3],[3,2],[2,0]];
      for (var corner=0; corner < 4; ++corner) { // find the maximum value of 4 corners
        var i0 = i01[corner][0];
        var i1 = i01[corner][1];
        var v0 = vws[i0];
        var v1 = vws[i1];

        var dwx = (v1.x - v0.x) / numcX;
        var dwy = (v1.y - v0.y) / numcY;
        var pxl = Math.sqrt(dwx*dwx + dwy*dwy);
        maxPxl = pxl > maxPxl ? pxl : maxPxl;
      }
      return {"maxCellSize": maxPxl, "isInsideFrustum": numInsideFrustum > 0};
      
      ////////////////////
      // local function //
      ////////////////////
      function xyz2win(x, y, z, mvpMatrix, width, height) {
        // Object Coordinates
        var obj = [x, y, z, 1.0];
        // Clip Coordinates 
        var clip = [0, 0, 0, 0];
        mat4.multiplyVec4(mvpMatrix, obj, clip);
        // Normalized Device Coordinates (NDC)
        var ndc = [clip[0]/clip[3], clip[1]/clip[3], clip[2]/clip[3]];
        // Window Coordinates
        var win = {
          "x": ndc[0]*width *0.5,
          "y": ndc[1]*height*0.5,
          "isInsideFrustum" : ndc[0] >= -1 && ndc[0] <= 1 && ndc[1] >= -1 && ndc[1] <= 1
        };
        return win;
      }
    }
  }; // end of updateTree

  this.renderTree = function (tree) {
    tree.root.attrib.bindBuffer("vertexIndex");
    (function traverse(node) {
      if ( node.getNumReadyChildren() == 4 ) {
        for (var childIdx=0; childIdx < 4; ++childIdx) {
          traverse(node.children[childIdx]);
        }
      } else {
        renderNode(node);
      }
    } (tree.root));
    return;
    
    ////////////////////
    // local function //
    ////////////////////
    function renderNode(node) {
      var gl = node.attrib.gl;
      node.attrib.linkBuffer("vertexPosition", 3, gl.FLOAT);
      node.attrib.linkBuffer("vertexNormal"  , 3, gl.FLOAT);
      //node.attrib.bindBuffer("vertexIndex");
      gl.drawElements(gl.TRIANGLES, node.indices.length, gl.UNSIGNED_SHORT, 0);
      //gl.drawElements(gl.LINES    , node.indices.length, gl.UNSIGNED_SHORT, 0);
    }  
  }; // end of renderTree
  
  ////////////////////
  // local function //
  ////////////////////
  function Node(json, gl, prgObj) {
    // copy of JSON
    this.level = json.level;
    this.idx = json.idx;
    this.dim = json.dim;
    this.offset = json.offset;
    this.cellSize = json.cellSize;
    this.vertices = json.vertices;
    // from JSON
    this.indices = triangleIndices(this.dim.x, this.dim.y);
    this.normals = triangleNormals(this.vertices, this.indices);
    // for webGL
    this.attrib = new Attrib(gl, prgObj);
    this.attrib.setBuffer ("vertexPosition", gl.ARRAY_BUFFER        , new Float32Array(this.vertices));
    this.attrib.setBuffer ("vertexNormal"  , gl.ARRAY_BUFFER        , new Float32Array(this.normals ));
    //this.attrib.setBuffer ("vertexIndex"   , gl.ELEMENT_ARRAY_BUFFER, new Uint16Array (this.indices ));
    // for children
    this.children = new Array(4);
    this.loadingChildren = 0;
    this.readyChildren = 0;
  }
  Node.prototype.getNumReadyChildren = function () {
    // lock this
    var num = 0;
    if ( this.readyChildren & 1<<0 ) ++num;
    if ( this.readyChildren & 1<<1 ) ++num;
    if ( this.readyChildren & 1<<2 ) ++num;
    if ( this.readyChildren & 1<<3 ) ++num;
    // unlock this
    return num;
  };
  Node.prototype.getNumLoadingChildren = function () {
    var num = 0;
    if ( this.loadingChildren & 1<<0 ) ++num;
    if ( this.loadingChildren & 1<<1 ) ++num;
    if ( this.loadingChildren & 1<<2 ) ++num;
    if ( this.loadingChildren & 1<<3 ) ++num;
    return num;
  };
  Node.prototype.destroy = function () {
        // This is necessary
        this.attrib.deleteAllBuffers();
        // But these are not necessary
        this.vertices = null;
        this.indices = null;
        this.normals = null;
        this.attrib = null;
  };
  function triangleIndices(dimX, dimY) {
    var numX = dimX-1; var numY = dimY-1;
    var indices = new Uint16Array(numX * numY * 2 * 3);
    for (var iy=0, i=0; iy < numY; ++iy)
    for (var ix=0     ; ix < numX; ++ix) {
      // ^ y
      // |
      // +--------+
      // | +    2 |
      // |   +    | 
      // |     +  | 
      // |  1    +| 
      // +--------+ ---> x
      // triangle-1
      indices[i++] = (iy  ) * dimX + ix  ;
      indices[i++] = (iy  ) * dimX + ix+1;
      indices[i++] = (iy+1) * dimX + ix  ;
      // triangle-2
      indices[i++] = (iy+1) * dimX + ix  ;
      indices[i++] = (iy  ) * dimX + ix+1; 
      indices[i++] = (iy+1) * dimX + ix+1;
    }
    return indices;
  }
  function triangleNormals(vertices, indices) {
    var num = indices.length;
    var normals = new Float32Array(num * 3);
    for (var i=0; i < num; i+=3) {
      var i0 = indices[i+0] * 3;
      var i1 = indices[i+1] * 3;
      var i2 = indices[i+2] * 3;
      var v0 = [vertices[i0+0], vertices[i0+1], vertices[i0+2]];
      var v1 = [vertices[i1+0], vertices[i1+1], vertices[i1+2]];
      var v2 = [vertices[i2+0], vertices[i2+1], vertices[i2+2]];
      var v10 = vec3.create();
      var v20 = vec3.create();
      var n   = vec3.create();
      vec3.subtract(v1, v0, v10);
      vec3.subtract(v2, v0, v20);
      vec3.cross(v10, v20, n);
      vec3.normalize(n);
      normals[i0+0] = n[0]; normals[i0+1] = n[1]; normals[i0+2] = n[2];
      normals[i1+0] = n[0]; normals[i1+1] = n[1]; normals[i1+2] = n[2];
      normals[i2+0] = n[0]; normals[i2+1] = n[1]; normals[i2+2] = n[2];
    }
    return normals;
  }
}; // end of LOD
