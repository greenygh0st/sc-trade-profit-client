/*
	@license magnet:?xt=urn:btih:0b31508aeb0634b347b8270c7bee4d411b5d4109&dn=agpl-3.0.txt
	
	Copyright (C) 2016 SabineWren
	
	GNU AFFERO GENERAL PUBLIC LICENSE Version 3, 19 November 2007
	https://www.gnu.org/licenses/agpl-3.0.html
	
	@license-end

	@Description: Issue POST request to the RSI Starmap API and use the result to generate a list of systems with data (including jump tunnels).
	This script can be rerun at any time to maintain data integrity when CIG pushes changes to the starmap. We include tunnel data within the system list to gain several advantages:
	- we only need one JSON file
	- we can loop up a complete list of tunnels by system ID, from which we can easily implement the single-source-shortest-path algorithm (Dijkstra's)
	- the tunnels are saved as single-direction, which means if CIG ever creates one-way tunnels, we don't have to change our code
	
	@Output: vertices.json, details.json
	
	Example Vertex:
	"314":{
		"system": 314,
		"name": "Stanton",
		"danger":10,
		"tunnels":{
			"318": { "size":"M", "exit":"318", "parent":"314", "xDanger":0 },
			"319": { "size":"L", "exit":"319", "parent":"314", "xDanger":0 },
			"316": { "size":"L", "exit":"316", "parent":"314", "xDanger":0 }
		}
	}
	
	Example Detail:
	"314":{
		"system": 314,
		"name": "Stanton",
		"description":"While the UEE still controls the rights to the system overall, the four planets themselves were sold by the government to four megacorporations making them the only privately-owned worlds in the Empire. Though subject to the UEE’s Common Laws and standard penal code, the UEE does not police the region. Instead, private planetary security teams enforce the local law.",
		"affiliation":"UEE",
		"danger":10,
		"thumbnail":"https://robertsspaceindustries.com/media/anxi4tr0ija81r/source/JStanton-Arccorp.jpg",
	}
	
*/
var path  = require('path');
var https = require('https');
var fs    = require('fs');

/* known valid paths:
 *
 * star-systems
 * star-systems/<system>
 * jump-tunnels
 * bootup
 *
 * we use bootup, which contains all data, because it's used by the Starpmap (expected least likely URL to change in the future)
*/
var post_options = {
	host: 'robertsspaceindustries.com',
	port: '443',
	path: '/api/starmap/bootup',
	method: 'POST',
	headers: {
		'accept': '*/*',
		'Content-Type': 'application/x-www-form-urlencoded',
		'Content-Length': 0
	}
};

var callbackResponse = function(response){
	response.setEncoding('utf8');
	var jump_tunnel_data = "";
	
	var filterJumpData = function(){
		responseObject = JSON.parse(jump_tunnel_data);
		
		//generate list of systems with basic system data
		var systems = {};
		var details = {};
		for(var system in responseObject.data.systems.resultset){
			var id = responseObject.data.systems.resultset[system]['id'];//surrogate key for system
			//push current system using key
			systems[id] = {
				'system'            : id,
				'name'              : responseObject.data.systems.resultset[system]['name'],
				'danger' : parseFloat( responseObject.data.systems.resultset[system]['aggregated_danger'] ),
				'tunnels'           : {}
			};
			details[id] = {
				'system'            : id,
				'name'              : responseObject.data.systems.resultset[system]['name'],
				'description'       : responseObject.data.systems.resultset[system]['description'],
				'affiliation'       : responseObject.data.systems.resultset[system]['affiliation'][0]['name'],//owning faction
				'thumbnail'         : path.resolve(__dirname, '../data/defaultSystemThumbnail.png')
			}
			//if a custom image exists, override default thumbnail
			if( typeof responseObject.data.systems.resultset[system]['thumbnail'] !== 'undefined' ){
				details[id]['thumbnail'] = responseObject.data.systems.resultset[system]['thumbnail']['source'];
			}
		}
		
		//add jump tunnels
		for(var tunnel in responseObject.data.tunnels.resultset){
			var entrySystem = responseObject.data.tunnels.resultset[tunnel]['entry']['star_system_id'];
			var exit  = responseObject.data.tunnels.resultset[tunnel]['exit']['star_system_id'];
			
			//add forward direction tunnel
			var newTunnel = {
				size:       responseObject.data.tunnels.resultset[tunnel].size,
				exit: exit,
				parent: entrySystem,
				xDanger: systems[exit]['danger']
			};
			systems[entrySystem]['tunnels'][exit] = newTunnel;
			
			//add opposite tunnel, as current RSI uses undirected edges, whereas ours are directional
			var backTunnel = {
				size:       responseObject.data.tunnels.resultset[tunnel].size,
				exit: entrySystem,
				parent: exit,
				xDanger: systems[entrySystem]['danger']
			}
			systems[exit]['tunnels'][entrySystem] = backTunnel;
		}
		
		fs.writeFileSync( path.resolve(__dirname, '../data/vertices.json'), JSON.stringify(systems) );
		fs.writeFileSync( path.resolve(__dirname, '../data/details.json'), JSON.stringify(details) );
	};
	
	//POST returns data in pieces (chunks), so we concatenate them before continuing
	response.on('data', function (chunk) {
		jump_tunnel_data = jump_tunnel_data + chunk;
	});
	response.on('end', filterJumpData);
};

var post_request = https.request(post_options, callbackResponse);
post_request.end();

