const siaendpointConfig = require("./siaendpoint-config");


module.exports = function (RED) {
	function SIAUltimate(config) {
		RED.nodes.createNode(this, config);
		var node = this;
		node.topic = config.topic || config.name;
		node.server = RED.nodes.getNode(config.server)
		node.discardAutomaticTest = config.discardAutomaticTest === "yes" ? true : false;
		node.deviceList = []; // { id: "5", devicename: "PIR Soggiorno" }

		// Contains the coupe ID,DeviceName (for example 4,PIR Badroom). One Device per row.
		try {
			if (node.server.deviceList.trim() !== "") {
				let sRows = node.server.deviceList.split("\n");
				for (let index = 0; index < sRows.length; index++) {
					const element = sRows[index];
					node.deviceList.push({ id: element.split(",")[0].toString(), devicename: element.split(",")[1].toString() });
				}
			}	
		} catch (error) {			
		}
		

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
				delete (_msg.decoded.data);
			} catch (error) {
			}
			let sCode = "";
			let sDescription = "";
			let sDeviceID = "";
			let sDeviceName = "";
			try {
				if (_msg.decoded.data_message.toString().includes("|")) {
					sCode = _msg.decoded.data_message.toString().split("|")[1];
					if (sCode.includes("\/")) {
						sCode = sCode.split("\/")[1];
						sDeviceID = sCode.substring(2);
						sCode = sCode.substring(0, 2);
						sDescription = node.server.SIACodes.find(a => a.code === sCode).description || "Unknown";
						try {
							sDeviceName = node.deviceList.find(a => a.id.toString() === sDeviceID).devicename;	
						} catch (error) {							
						}
						
					}
				}
			} catch (error) {
			}

			if (node.discardAutomaticTest && sCode === "RP") {
				node.setNodeStatus({ fill: "grey", shape: "ring", text: "Discarded " + sDescription });
				return;
			}

			_msg.payload = { deviceName: sDeviceName, deviceID: sDeviceID, code: sCode, description: sDescription };
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