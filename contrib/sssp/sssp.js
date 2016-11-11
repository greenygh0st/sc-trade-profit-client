/*
	@license magnet:?xt=urn:btih:0b31508aeb0634b347b8270c7bee4d411b5d4109&dn=agpl-3.0.txt
	
	Copyright (C) 2016 SabineWren
	
	GNU AFFERO GENERAL PUBLIC LICENSE Version 3, 19 November 2007
	https://www.gnu.org/licenses/agpl-3.0.html
	
	@license-end
	
	@Description: Single Source Shortest Path calculation using Dijkstra's algorithm and a replaceable comparator function
*/
function backtrackParent(vertex, vertexList){
	path = [];
	for(var current = vertex; current['system'] !== current['parent']; current = vertexList[current['parent']]){
		path.unshift( current['system'] );
	}
	path.unshift( current['system'] );
	return path;
}

//create callback to decide which of two vertices has lower weight
function createCompareFunction(weightType){
	//check if an intermediary path improves total weight
	if(weightType === 'jumps')var compare = function(vertex1, vertex2){
		if( vertex2['weightDistance'] < vertex1['weightDistance'] )return  1;
		if( vertex2['weightDistance'] > vertex1['weightDistance'] )return -1;
		else return 0;
	}
	if(weightType === 'danger')var compare = function(vertex1, vertex2){
		if( vertex2['weightDanger'] < vertex1['weightDanger'] )return  1;
		if( vertex2['weightDanger'] > vertex1['weightDanger'] )return -1;
		else return 0;
	};
	return compare;
}

function createVertexList(input){
	var vertexList = [];
		for(vertex in input){
			//init all vertices and their path weights
			var newVertex = {
				system : input[vertex]['system'],
				danger : input[vertex]['danger'],
				tunnels: input[vertex]['tunnels'],
				parent : sourceVertexName,
				weightDistance: Number.MAX_VALUE,
				weightDanger  : Number.MAX_VALUE
			};
			vertexList[newVertex.system] = newVertex;
		}
	return vertexList;
}

function getFullPath(vertexList){
	for(vertex in vertexList){
		var path = backtrackParent(vertexList[vertex], vertexList);
		vertexList[vertex]['path'] = path;
	}
	return vertexList;
}

/* @Description: use Dijkstra's algortim to create a Sinlge Source Shortest Path list of all other vertices
 * @Input: all vertex data, source, and comparator function to select shortest edge
 * @Output: a complete path from source to each destination and the corresponding distance
 */
function sssp(weightType, minSize, sourceVertexName){
	var path = require('path');
	var fs   = require('fs');
	var heap = require('heap');

	var input = path.resolve(__dirname + '/../data/vertices.json');
	    input = JSON.parse( fs.readFileSync(input) );
	
	//create an array of vertices for us to heapify
	var vertexList = createVertexList(input);
	delete(input);
	
	var compare = createCompareFunction(weightType);
	
	var vertexHeap = new heap(compare);
	var visitNodes = [];
	
	//init starting weights
	vertexHeap.push(vertexList[sourceVertexName]);
	visitNodes.push(sourceVertexName);
	vertexList[sourceVertexName]['weightDistance'] = 0;
	vertexList[sourceVertexName]['weightParent']   = sourceVertexName;
	vertexList[sourceVertexName]['weightDanger']   = vertexList[sourceVertexName]['danger'];
	vertexList[sourceVertexName]['size']           = 'N';
	
	//visit all vertices
	while( !vertexHeap.empty() )visitVertex(vertexHeap, visitNodes, vertexList, weightType, minSize);
	
	//add path information
	getFullPath(vertexList);
	
	var output = {};
	for(vertex in vertexList){
		var data = {
			system   : vertexList[vertex].system,
			distance : vertexList[vertex].weightDistance,
			danger   : vertexList[vertex].weightDanger,
			path     : vertexList[vertex].path
		}
		output[vertexList[vertex].system] = data;
	}
	return output;
}

//decide if the visiting vertex helps, depending on what weight we're optimizing
function tryNewEdge(visitingVertex, targetVertex, weightType){
	if(weightType === 'jumps') return (1 + visitingVertex['weightDistance'] < targetVertex['weightDistance']);
	if(weightType === 'danger')return (targetVertex['danger'] + visitingVertex['weightDanger'] < targetVertex['weightDanger']);
}

function visitVertex(vertexHeap, visitNodes, vertexList, weightType, minSize){
	var visitingVertex = vertexHeap.pop();
	var visitingName   = visitingVertex['system'];
	
	//relax all outgoing edges
	for(edge in visitingVertex['tunnels']){
		if( minSize === 'medium' && visitingVertex['tunnels'][edge]['size'] === 'S' )continue;
		if( minSize === 'large'  && visitingVertex['tunnels'][edge]['size'] === 'S' )continue;
		if( minSize === 'large'  && visitingVertex['tunnels'][edge]['size'] === 'M' )continue;
	
		var targetSystemName = visitingVertex['tunnels'][edge]['exit'];
		
		//if we can get to target system faster thru the visiting one, then do so
		if( tryNewEdge(visitingVertex, vertexList[targetSystemName], weightType) ){
			vertexList[targetSystemName]['weightDistance'] = 1 + visitingVertex['weightDistance'];
			vertexList[targetSystemName]['parent']   = visitingName;
			vertexList[targetSystemName]['weightDanger'] = visitingVertex['weightDanger'] + visitingVertex['tunnels'][edge]['xDanger'];
			vertexList[targetSystemName]['size'] = visitingVertex['tunnels'][edge]['size'];
		}
		
		//plan to visit any newly found vertices
		if( typeof visitNodes[targetSystemName] === 'undefined' ){
			visitNodes[targetSystemName] = true;
			vertexHeap.push(vertexList[targetSystemName]);
		}
	}
}

/* allowed tunnel weights: jumps, danger
 * allowed tunnel sizes: small, medium, large
 */
//defaults:
var sourceVertexName = '314';
var weightType = 'jumps';
var minSize = 'small';
if(typeof process.argv[2] !== 'undefined')weightType = process.argv[2];
if(typeof process.argv[3] !== 'undefined')minSize    = process.argv[3];
if(typeof process.argv[4] !== 'undefined')sourceVertexName = process.argv[4];

console.log( sssp(weightType, minSize, sourceVertexName) );

