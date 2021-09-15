const siaendpointConfig = require("./siaendpoint-config");


module.exports = function (RED) {
	function SIAUltimate(config) {
		RED.nodes.createNode(this, config);
		var node = this;
		node.topic = config.topic || config.name;
		node.server = RED.nodes.getNode(config.server)
		node.ringStatus = (config.ringStatus === null || config.ringStatus === undefined) ? "all" : config.ringStatus.toLowerCase();
		node.floorNo = (config.floorNo === null || config.floorNo === undefined) ? "all" : config.floorNo;
		node.unitNo = (config.unitNo === null || config.unitNo === undefined) ? "all" : config.unitNo;
		node.zoneNo = (config.zoneNo === null || config.zoneNo === undefined) ? "all" : config.zoneNo;
		node.buildingNo = (config.buildingNo === null || config.buildingNo === undefined) ? "all" : config.buildingNo;
		node.currentEmittedMSG = {}; // To keep the current status and avoid emitting msg if already emitted.

		node.setNodeStatus = ({ fill, shape, text }) => {
			var dDate = new Date();
			node.status({ fill: fill, shape: shape, text: text + " (" + dDate.getDate() + ", " + dDate.toLocaleTimeString() + ")" })
		}



		node.sendPayload = (_msg) => {
			if (_msg === null || _msg === undefined) return;
			_msg.topic = node.topic;
			if (_msg.hasOwnProperty("errorDescription")) { node.send([null, _msg]); return; }; // It's a connection error/restore comunication.

			// Humanize sia message
			// data_message: "#000|Nri0/RP0000"

			//node.SIACodes = []; // Array of objects { code: "TR", description: "trouble"}
			try {
				// Delete the data buffer
				delete (_msg.data);
			} catch (error) {
			}
			let sCode = "";
			let sDescription = "";
			try {
				if (_msg.decoded.data_message.toString().includes("|")) {
					sCode = sCode.split("|")[0];
					sCode = sCode.split("/")[1];
					sDescription = node.server.SIACodes.find(a => a.code === sCode.substring(0, 2)).description;
				}
			} catch (error) {
			}
			_msg.payload = { code: sCode, description: sDescription };
			node.setNodeStatus({ fill: "green", shape: "dot", text: "Received " + _msg.decoded.data_message });
			node.send([_msg, null]);

		}

		// On each deploy, unsubscribe+resubscribe
		if (node.server) {
			node.server.removeClient(node);
			node.server.addClient(node);
		}


		this.on('input', function (msg) {
			// node.request = async function (_callerNode, _method, _URL, _body) {



		});

		node.on("close", function (done) {
			if (node.server) {
				node.server.removeClient(node);
			}
			if (node.server) {
				node.server.removeClient(node);
			}
			done();
		});

	}

	RED.nodes.registerType("SIAUltimate", SIAUltimate);
}