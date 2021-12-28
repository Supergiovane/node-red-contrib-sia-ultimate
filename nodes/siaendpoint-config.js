
module.exports = (RED) => {

    const dp = require('./lib/datapoints');
    const net = require('net');
    const dgram = require('dgram');
    const crypto = require('crypto');
    var fs = require('fs');

    let servertcp; // Server instance TCP
    let serverudp; // Server instance UDP

    function siaendpointConfig(config) {
        RED.nodes.createNode(this, config)
        var node = this
        node.port = config.port || 4628;
        node.nodeClients = []; // Stores the registered clients
        node.errorDescription = ""; // Contains the error description in case of connection error.
        node.aes = config.aes === "yes" ? true : false;
        node.hex = config.hex === "yes" ? true : false;
        node.acktimeout = config.acktimeout || 0;
        node.SIACodes = []; // Array of objects { code: "TR", description: "trouble"}
        node.heartbeatTimeout = config.heartbeatTimeout || 120; // If a messages doesn't arrive withing this time, emits error on PIN 2
        node.timerHeartBeat = null;
        node.deviceList = config.deviceList || ""; // Contains the coupe ID,DeviceName (for example 4,PIR Badroom). One Device per row.

        RED.log.info("siaendpointConfig: siaendpointConfig: Account: " + node.credentials.accountnumber + ", AES:" + node.aes + ", HEX:" + node.hex);

        if (node.aes === true) {
            if (node.hex === true) {
                // if password is hex instead of byte, convert hex to byte
                // adapter.config.keys[i].password = new Buffer(adapter.config.keys[i].password, 'hex').toString();
                node.credentials.password = new Buffer.from(node.credentials.password, 'hex');
            }
            let len = node.credentials.password.length;
            // Password for AES is not allowed to be longer than 16, 24 and 32 characters 
            if (len !== 16 && len !== 24 && len !== 32) {
                RED.log.error('siaendpointConfig: Password for accountnumber ' + node.credentials.accountnumber + ' must be 16, 24 or 32 Byte or 32, 48 or 64 Hex long');
            }
        }

        node.setAllClientsStatus = ({ fill, shape, text }) => {
            function nextStatus(oClient) {
                oClient.setNodeStatus({ fill: fill, shape: shape, text: text })
            }
            node.nodeClients.map(nextStatus);
        }

        // 15/09/2021 Read the CSV containing the SIA codes to be humanized
        try {
            let aRows = fs.readFileSync(__dirname + "/lib/siacodes.csv", "utf8").split("\n");
            for (let index = 0; index < aRows.length; index++) {
                const element = aRows[index];
                node.SIACodes.push({ code: element.split(",")[0], description: element.split(",")[1] });
            }
            RED.log.info("siaendpointConfig: siaendpointConfig: Total SIA codes in csv file: " + node.SIACodes.length);
        } catch (err) {
            node.SIACodes = [];
            node.setAllClientsStatus({ fill: "yellow", shape: "ring", text: "Unable to read SIA codes from file " + err.message });
            RED.log.info("siaendpointConfig: siaendpointConfig: Error reading SIA codes from csv file: " + err.message);
        }


        /**
         * convert subcriber to ID for using as channel name. Special characters and spaces are deleted.
         * @param {string} accountnumber - accountnumber 
         */
        function getAcountNumberID(accountnumber) {
            let id = accountnumber.replace(/[.\s]+/g, '_');
            return id;
        }


        // *****************************************************************************************************
        // Encrypt / Input: ASCII , Output: HEX
        // *****************************************************************************************************
        /**
         * Encrypt messages
         * @param {string or buffer} password - key / password for decrypting message  
         * @param {string} decrypted - messages for encrypting
         */
        function encrypt_hex(password, decrypted) {
            try {
                let test = decrypted.length;
                let iv = new Buffer.alloc(16);
                iv.fill(0);
                let crypted = decrypted;
                let aes;
                // password = customPadding(password, 24, 0x0, "hex"); // magic happens here
                switch (password.length) {
                    case 16:
                        aes = 'aes-128-cbc';
                        break;
                    case 24:
                        aes = 'aes-192-cbc';
                        break;
                    case 32:
                        aes = 'aes-256-cbc';
                        break;
                    default:
                        return undefined;
                }
                let cipher = crypto.createCipheriv(aes, password, iv);
                cipher.setAutoPadding(false);
                let encoded = cipher.update(crypted, 'utf8', 'hex');
                encoded += cipher.final('hex');
                return (encoded ? encoded : undefined);
            } catch (e) {
                return undefined;
            }
        }

        /**
         * Decrypt messages
         * @param {string or buffer} password - key / password for decrypting message  
         * @param {string} value - messages to decrypt
         */
        function decrypt_hex(password, encrypted) {
            try {
                let iv = new Buffer.alloc(16);
                iv.fill(0);
                // let crypted = new Buffer(encrypted, 'hex').toString('binary');
                let crypted = new Buffer(encrypted, 'hex');
                let aes;
                //  password = customPadding(password, 24, 0x0, "hex"); // magic happens here
                switch (password.length) {
                    case 16:
                        aes = 'aes-128-cbc';
                        break;
                    case 24:
                        aes = 'aes-192-cbc';
                        break;
                    case 32:
                        aes = 'aes-256-cbc';
                        break;
                    default:
                        return undefined;
                }
                let decipher = crypto.createDecipheriv(aes, password, iv);
                decipher.setAutoPadding(false);
                // let decoded = decipher.update(crypted, 'binary', 'utf8');
                // decoded += decipher.final('utf8');
                let decoded = decipher.update(crypted, 'hex', 'utf8');
                decoded += decipher.final('utf8');
                return (decoded ? decoded : undefined);
            } catch (e) {
                return undefined;
            }
        }

        /**
         * get timestamp in following format <_HH:MM:SS,MM-DD-YYYY>
         * @param {date} datum - date object or leave empty
         */

        function getTimestamp(datum) {
            if (!datum) {
                datum = new Date();
            }
            // let month = ('0' + datum.getUTCMonth()).slice(-2); // liefert 0 - 11
            let month = (('0' + datum.getUTCMonth() + 1) < 10 ? '0' : '') + (datum.getMonth() + 1);
            let year = datum.getUTCFullYear(); // YYYY (startet nicht bei 0)
            let day = ('0' + datum.getUTCDate()).slice(-2); // liefert 1 - 31
            let hour = ('0' + datum.getUTCHours()).slice(-2); // liefert 0 - 23
            let minute = ('0' + datum.getUTCMinutes()).slice(-2);
            let second = ('0' + datum.getUTCSeconds()).slice(-2);
            let str = '_' + hour + ':' + minute + ':' + second + ',' + month + '-' + day + '-' + year;
            return str;
        }

        /**
         * Is SIA Message in time (+20 or -40 seconds)
         * @param {number} ts - timestamp in seconds, for examp -20, +20
         */
        function isInTime(ts) {
            if (ts) {
                let [tt, dd] = ts.split(',');
                let val = new Date(dd + "," + tt + " UTC");
                // val = val.toUTCString();
                [tt, dd] = getTimestamp().substring(1).split(',');
                let now = new Date();
                // now = now.toUTCString();
                let diff = Math.abs((val - now) / 1000);
                // if (diff > 20 || diff < -40) {
                if (node.acktimeout > 0 && diff > node.acktimeout) {
                    RED.log.info("siaendpointConfig: Timeout Error. Calculated diff between SIA message and ACK ist " + diff + "sec. . Allowed are max " + node.acktimeout + " sec. Sending NAK.");
                    RED.log.debug("siaendpointConfig: Timestamp difference. Time in message " + val.toUTCString() + ". Time now " + now.toUTCString());
                    return false;
                } else {
                    return true;
                }
            } else {
                return true;
            }
        }

        /**
         * Acount configuration
         * @param {string} act - accountnumber
         */
        function getAcctInfo(act) {
            if (node.credentials.accountnumber === act) {
                return { password: node.credentials.password, aes: node.aes };
            } else {
                return undefined;
            }
        }

        /**
         * Accountnumber exist in Config
         * @param {string} act - accountnumber
         */
        function acctExist(act) {
            let key = getAcctInfo(act);
            if (key) {
                return true;
            } else {
                return false;
            }
        }

        // *****************************************************************************************************
        // Acknowledge for SIA
        // *****************************************************************************************************
        function nackSIA(crcformat) {
            let ts = getTimestamp(); // tiemstamp
            let str = '"NAK"' + '0000' + 'R0' + 'L0' + 'A0' + '[]' + ts;
            let crc = crc16str(str);
            let len = str.length;
            let crchex = ('0000' + crc.toString(16)).substr(-4).toUpperCase();
            let lenhex = ('0000' + len.toString(16)).substr(-4).toUpperCase();
            /*
            let start = new Buffer([0x0a, crc >>> 8 & 0xff, crc & 0xff, len >>> 8 & 0xff, len & 0xff]);
            let end = new Buffer([0x0d]);
            let buf = new Buffer(str);
            let nack = Buffer.concat([start, buf, end]);
            */
            let start = new Buffer.from([0x0a]);
            let end = new Buffer.from([0x0d]);
            let crcbuf;
            if (crcformat === 'bin') {
                // Lupusec sends in 2 bin instead of 4 hex
                crcbuf = new Buffer.from([crc >>> 8 & 0xff, crc & 0xff]);
                RED.log.info("siaendpointConfig: Created NAK : <0x0A><0x" + crchex + ">" + lenhex + str + "<0x0D>");
            } else {
                crcbuf = new Buffer.from(crchex);
                RED.log.info("siaendpointConfig: Created NAK : <0x0A>" + crchex + "" + lenhex + str + "<0x0D>");
            }
            // let crcbuf = new Buffer(crchex);
            // let crcbuf = new Buffer([crc >>> 8 & 0xff, crc & 0xff]);
            let lenbuf = new Buffer.from(lenhex);
            let buf = new Buffer.from(str);
            let nack = Buffer.concat([start, crcbuf, lenbuf, buf, end]);
            try {
                RED.log.debug("siaendpointConfig: nackSIA : " + JSON.stringify(nack));
            } catch (error) { }

            return nack;
        }

        /**
         * Create Acknowledge for SIA
         * @param {string} sia - SIA Message
         */
        function ackSIA(sia) {
            if (sia) {
                let ts = getTimestamp(); // tiemstamp
                let cfg = getAcctInfo(sia.act);
                let str = "";
                try {
                    RED.log.debug("siaendpointConfig: ackSIA (cfg) : " + JSON.stringify(cfg));
                    RED.log.debug("siaendpointConfig: ackSIA (sia) : " + JSON.stringify(sia));
                } catch (error) { }
                if (sia.crc == sia.calc_crc && sia.len == sia.calc_len && cfg && isInTime(sia.ts)) {
                    // if (sia.crc == sia.calc_crc && sia.len == sia.calc_len && cfg) {
                    let rpref = sia.rpref && sia.rpref.length > 0 ? "R" + sia.rpref : "";
                    let lpref = sia.lpref && sia.lpref.length > 0 ? "L" + sia.lpref : "";
                    if (sia.id[0] == "*") {
                        let msglen = ('|]' + ts).length;
                        let padlen = 16 - (msglen % 16);
                        // let pad = new Buffer(padlen);
                        let pad = Buffer.alloc(padlen, padlen);
                        // let pad = Buffer.alloc(padlen, 0x00); 
                        let msg = encrypt_hex(cfg.password, pad + '|]' + ts);
                        let dmsg = decrypt_hex(cfg.password, msg); // only for deguging
                        let dmsghex = new Buffer.from(dmsg).toString('hex');
                        str = '"*ACK"' + sia.seq + rpref + lpref + '#' + sia.act + '[' + msg;
                    } else {
                        str = '"ACK"' + sia.seq + rpref + lpref + '#' + sia.act + '[]';
                    }
                    let crc = crc16str(str);
                    let len = str.length;
                    let crchex = ('0000' + crc.toString(16)).substr(-4).toUpperCase();
                    let lenhex = ('0000' + len.toString(16)).substr(-4).toUpperCase();

                    /*
                    let start = new Buffer([0x0a, crc >>> 8 & 0xff, crc & 0xff, len >>> 8 & 0xff, len & 0xff]);
                    let end = new Buffer([0x0d]);
                    let buf = new Buffer(str);
                    let ack = Buffer.concat([start, buf, end]);
                    */
                    let start = new Buffer.from([0x0a]);
                    let end = new Buffer.from([0x0d]);
                    let crcbuf;
                    if (sia && sia.crcformat === 'bin') {
                        // Lupusec sends in 2 bin instead of 4 hex
                        crcbuf = new Buffer.from([crc >>> 8 & 0xff, crc & 0xff]);
                        RED.log.info("siaendpointConfig: Created ACK : <0x0A><0x" + crchex + ">" + lenhex + str + "<0x0D>");
                    } else {
                        crcbuf = new Buffer.from(crchex);
                        RED.log.info("siaendpointConfig: Created ACK : <0x0A>" + crchex + "" + lenhex + str + "<0x0D>");
                    }
                    // let crcbuf = new Buffer(crchex);
                    // let crcbuf = new Buffer([crc >>> 8 & 0xff, crc & 0xff]);
                    let lenbuf = new Buffer.from(lenhex);
                    let buf = new Buffer.from(str);
                    let ack = Buffer.concat([start, crcbuf, lenbuf, buf, end]);
                    try {
                        RED.log.debug("siaendpointConfig: ackSIA : " + JSON.stringify(ack));
                    } catch (error) { }
                    return ack;
                }
            }
            return undefined;
        }

        /**
         * Set state for SIA message
         * @param {string} sia - SIA Message
         */
        function setStatesSIA(sia) {

            let obj = dp.dpSIA || {};
            let val = null;
            if (sia) {
                RED.log.debug("siaendpointConfig: setStatesSIA sia.act : " + sia.act);
                if (acctExist(sia.act)) {
                    RED.log.debug("siaendpointConfig: setStatesSIA for " + sia.act + " : " + JSON.stringify(sia));
                    let id = getAcountNumberID(sia.act);
                    for (let prop in obj) {
                        let sid = id + '.' + prop;
                        switch (prop) {
                            case 'id':
                                val = sia.id;
                                break;
                            case 'sequence':
                                val = sia.seq;
                                break;
                            case 'rpref':
                                val = sia.rpref;
                                break;
                            case 'lpref':
                                val = sia.lpref;
                                break;
                            case 'accountnumber':
                                val = sia.act;
                                break;
                            case 'msgdata':
                                val = sia.data_message;
                                break;
                            case 'extdata':
                                val = sia.data_extended;
                                break;
                            case 'ts':
                                /*
                                 let [tt, dd] = sia.ts.split(',');
                                 if (tt && dd) {
                                   val = new Date(dd + "," + tt + " UTC");
                                 } else {
                                   val = "";
                                 }
                                 */
                                val = sia.ts;
                                break;
                            case 'crc':
                                val = sia.crc;
                                break;
                            case 'len':
                                val = sia.len;
                                break;
                            default:
                                val = null;
                        }
                        RED.log.debug("siaendpointConfig: ackSIA : set state for id " + sid + " with value " + val);
                        //node.send([{ sid: sid, payload: val }, null]);

                        // adapter.setState(sid, {
                        //     val: val,
                        //     ack: true
                        // });
                    }
                }
            }
        }

        /**
         * start socket server for listening for SIA
         */
        function serverStartTCP() {
            try {
                servertcp = net.createServer(onClientConnectedTCP(servertcp));
                servertcp.listen(node.port, () => {
                    try {
                        let text = 'siaendpointConfig: SIA Server listening on IP-Adress (TCP): ' + servertcp.address().address || "" + ':' + servertcp.address().port;
                        RED.log.info(text);
                    } catch (error) {
                        RED.log.error("siaendpointConfig: Unable to listen to the TCP server: " + error.message + " do you have another config node with the same port?");
                        throw (error);
                    }

                });
            } catch (error) {
                RED.log.error("siaendpointConfig: Unable to instantiate the TCP server: " + error.message + " do you have another config node with the same port?");
                throw (error);
            }

        }

        /**
         * start socket server for listining for SIA by UDP
         */
        function serverStartUDP() {
            try {
                serverudp = dgram.createSocket('udp4');
                onClientConnectedUDP(serverudp);
                serverudp.bind(node.port, () => {
                    try {
                        let text = 'siaendpointConfig: SIA Server listening on IP-Adress (UDP): ' + serverudp.address().address + ':' + serverudp.address().port;
                        RED.log.info(text);
                    } catch (error) {
                        RED.log.error("siaendpointConfig: Unable to listen to the UDP server: " + error.message);
                        throw (error);
                    }
                });
            } catch (error) {
                RED.log.error("siaendpointConfig: Unable to instantiate the UDP server: " + error.message);
                throw (error);
            }

        }



        /**
         * SIA CRC Format
         * @param {string} data - CRC
         */
        function getcrcFormat(data) {
            let crcformat = 'hex';
            if (data) {
                // Check if CRC 2 Byte Binary or 4 Byte HEX
                if (data[5] == '0'.charCodeAt() && data[9] == '"'.charCodeAt()) {
                    crcformat = 'hex';
                }
                // Lupusec sends the CRC in binary forum
                if (data[3] == '0'.charCodeAt() && data[7] == '"'.charCodeAt()) {
                    crcformat = 'bin';
                }
            }
            return crcformat;
        }


        /**
         * delete 0x00 at the end of the buffer
         * @param {buffer} data - string buffer
         */
        function deleteAppendingZero(data) {
            if (data) {
                for (let i = data.length - 1; i > 0; i--) {
                    if (data[i] === 0x00) {
                        data = data.slice(0, i);
                    } else {
                        break;
                    }
                }
            }
            return data;
        }

        /**
         * parse SIA message
         * @param {string} data - SIA Message
         */
        function parseSIA(data) {
            data = deleteAppendingZero(data);
            let sia = {};
            let len = data.length - 1;
            let str = null;
            let m = null;
            let regex = null;
            if (data && data[0] == 0x0a && data[len] == 0x0d) {
                sia.data = data; // komplette Nachricht
                sia.lf = data[0]; // <lf>
                // Check if CRC 2 Byte Binary or 4 Byte HEX
                if (data[5] == '0'.charCodeAt() && data[9] == '"'.charCodeAt()) {
                    str = new Buffer.from((data.subarray(9, len)));
                    sia.len = parseInt(data.toString().substring(5, 9), 16);
                    sia.crc = parseInt(data.toString().substring(1, 5), 16);
                    sia.crcformat = 'hex';
                }
                // Lupusec sends the CRC in binary forum
                if (data[3] == '0'.charCodeAt() && data[7] == '"'.charCodeAt()) {
                    str = new Buffer.from((data.subarray(7, len)));
                    sia.len = parseInt(data.toString().substring(3, 7), 16);
                    sia.crc = data[1] * 256 + data[2];
                    sia.crcformat = 'bin';
                }
                // Length of Message
                //tmp = data.toString().substring(3, 7);
                // let tmp = (data.subarray(3, 7)).toString();
                // sia.len = parseInt(tmp, 16); // length of data
                RED.log.debug("siaendpointConfig: data : " + data);
                sia.cr = data[len]; // <cr>
                // str = new Buffer((data.subarray(7, len)));

                sia.str = str.toString();
                sia.calc_len = str.length;
                sia.calc_crc = crc16str(str);
                /*
                sia.calc_len = sia.str.length;
                sia.calc_crc = crc16str(sia.str);
                */
                let crchex = ('0000' + sia.crc.toString(16)).substr(-4).toUpperCase();
                let lenhex = ('0000' + sia.len.toString(16)).substr(-4).toUpperCase();
                if (sia.crcformat === 'bin') {
                    // Lupusec sends in 2 bin instead of 4 hex
                    RED.log.info("siaendpointConfig: SIA Message : <0x0A><0x" + crchex + ">" + lenhex + str + "<0x0D>");
                } else {
                    RED.log.info("siaendpointConfig: SIA Message : <0x0A>" + crchex + "" + lenhex + str + "<0x0D>");
                }

                RED.log.debug("siaendpointConfig: parseSIA sia.str : " + sia.str);
                if (sia.calc_len != sia.len || sia.calc_crc != sia.crc) {
                    RED.log.info("siaendpointConfig: CRC or Length different to the caclulated values");
                    RED.log.debug("siaendpointConfig: SIA crc= " + sia.crc + ", calc_crc=" + sia.calc_crc);
                    RED.log.debug("siaendpointConfig: SIA len= " + sia.len + ", calc_len=" + sia.calc_len);
                    RED.log.debug("siaendpointConfig: Message for CRC and LEN calculation" + sia.str);
                    RED.log.debug("siaendpointConfig: Message for CRC and LEN calculation (String)" + sia.str.toString());
                    return undefined;
                    // sia.calc_len = sia.len;
                    // sia.calc_crc = sia.crc;
                }
                // Example str:
                // "SIA-DCS"0002R1L232#78919[1234|NFA129][S123Main St., 55123]_11:10:00,10-12-2019
                // "SIA-DCS"0002R1L232#78919[ ][ ]_11:10:00,10-12-2019
                // "SIA-DCS"0266L0#alarm1[alarm2|Nri1OP0001*Familie*]_16:22:03,06-08-2018
                // http://s545463982.onlinehome.us/DC09Gen/
                // "*SIA-DCS"9876R579BDFL789ABC#12345A[209c9d400b655df7a26aecb6a887e7ee6ed8103217079aae7cbd9dd7551e96823263460f7ef0514864897ae9789534f1
                // regex = /\"(.+)\"(\d{4})(R(.{1,6})){0,1}(L(.{1,6}))\#([\w\d]+)\[(.+)/gm; // befor Isue 11
                // regex = /\"(.+)\"(\d{4})(R(.{0,6})){0,1}(L(.{0,6}))\#([\w\d]+)\[(.+)/gm; // Isue 11
                regex = /"(.+)"(\d{4})(R(.{0,6})){0,1}(L(.{0,6}))#([\w\d]+)\[(.+)/gm; // Isue 11
                if ((m = regex.exec(sia.str)) !== null && m.length >= 8) {
                    let lpref = undefined;
                    RED.log.debug("siaendpointConfig: parseSIA regex   : " + JSON.stringify(sia));
                    sia.id = m[1] || undefined; // id (SIA-DCS, ACK) - required
                    sia.seq = m[2] || undefined; // sqeuence number (0002 or 0003) - required
                    sia.rpref = m[4] || ""; // Receiver Number - optional (R0, R1, R123456)
                    if (m[5] === 'L') { lpref = 0; }
                    sia.lpref = m[6] || lpref; // Prefix Acount number - required (L0, L1, L1232) - required
                    sia.act = m[7] || undefined; // Acount number - required (1224, ABCD124) - required
                    sia.pad = ""; // Pad
                    let msg = m[8] || "";
                    let cfg = getAcctInfo(sia.act);
                    if (!cfg) {
                        RED.log.info("siaendpointConfig: Could not found entries for accountnumber " + sia.act + " in the configuration");
                        return undefined;
                    }
                    // if id starts with *, message is encrypted
                    if (sia.id && sia.id[0] == "*") {
                        if (cfg.aes == true && cfg.password) {
                            msg = decrypt_hex(cfg.password, msg);
                            if (msg) {
                                let padlen = msg.indexOf("|");
                                sia.pad = msg.substring(0, padlen); // len of pad
                                msg = msg.substring(padlen + 1); // Data Message
                                RED.log.info("siaendpointConfig: SIA Message decrypted part: " + msg);
                            } else {
                                RED.log.info("siaendpointConfig: Could not decrypt message");
                                return undefined;
                            }
                        } else {
                            RED.log.info("siaendpointConfig: Could not decrypt message, because AES encrypting disabled or password is missing");
                            return undefined;
                        }
                    }
                    if (sia.id && sia.id[0] != "*" && cfg.aes == true) {
                        RED.log.info("siaendpointConfig: Encrypting enabled, message was sent not entcrypted");
                        return undefined;
                    }
                    regex = /(.+?)\](\[(.*?)\])?(_(.+)){0,1}/gm;
                    if ((m = regex.exec(msg)) !== null && m.length >= 1) {
                        sia.data_message = m[1] || ""; // Message
                        sia.data_extended = m[3] || ""; // extended Message
                        sia.ts = m[5] || "";
                    }
                }
            }
            RED.log.debug("siaendpointConfig: parseSIA : " + JSON.stringify(sia));
            // Test if all required fields will be sent
            if (sia && sia.id && sia.seq && sia.lpref && sia.act && sia.pad != undefined) {
                return sia;
            } else {
                RED.log.info("siaendpointConfig: Required SIA fields missing");
                return undefined;
            }
        }

        /**
         * alarm system connected and sending SIA  message (TCP/IP)
         * @param {socet} sock - socket
         */
        function onClientConnectedTCP(sock) {
            // See https://nodejs.org/api/stream.html#stream_readable_setencoding_encoding
            // sock.setEncoding(null);
            // Hack that must be added to make this work as expected
            // delete sock._readableState.decoder;
            let remoteAddress = sock.remoteAddress + ':' + sock.remotePort;
            let ack = null;
            // RED.log.info('siaendpointConfig: New client connected: ' + remoteAddress);
            sock.on('data', (data) => {
                // data = Buffer.from(data,'binary');
                // data = new Buffer(data);
                RED.log.debug('siaendpointConfig: TCP received from ' + remoteAddress + ' following data: ' + JSON.stringify(data));
                RED.log.debug('siaendpointConfig: TCP received from ' + remoteAddress + ' following message: ' + data.toString().trim());
                let sia = parseSIA(data);
                if (sia) {
                    ack = ackSIA(sia);
                    if (ack) {
                        // set states only if ACK okay
                        setStatesSIA(sia);
                        node.nodeClients.forEach(oClient => {
                            oClient.sendPayload({ connection: "TCP", decoded: sia });
                        })
                        node.errorDescription = ""; // Reset the error
                        startHeartBeat();
                    } else {
                        let crcformat = getcrcFormat(data);
                        ack = nackSIA(crcformat);
                    }
                } else {
                    let crcformat = getcrcFormat(data);
                    ack = nackSIA(crcformat);
                }
                try {
                    //sock.end(ack);
                    // 23/12/2021 Fix for issue https://github.com/Supergiovane/node-red-contrib-sia-ultimate/issues/2
                    sock.write(ack);
                    setTimeout(() => {
                        sock.end();
                    }, 700);
                    RED.log.info('siaendpointConfig: sending ACK VIA TCP to ' + remoteAddress + ' following message: ' + ack.toString().trim());
                } catch (e) {
                    // Error Message 
                    try {
                        RED.log.error('siaendpointConfig: sending ACK VIA TCP to ' + remoteAddress + ' following message: ' + ack.toString().trim() + " Error:" + e.message);
                    } catch (error) { }

                }
            });
            sock.on('close', () => {
                RED.log.info('siaendpointConfig: TCP connection from ' + remoteAddress + ' closed');
            });
            sock.on('error', (err) => {
                RED.log.error('siaendpointConfig: TCP Connection ' + remoteAddress + ' error: ' + err.message);
            });
        }

        /**
         * alarm system connected and sending SIA message (UDP)
         * @param {socket} sock - socket
         */
        function onClientConnectedUDP(sock) {
            // See https://nodejs.org/api/stream.html#stream_readable_setencoding_encoding
            // sock.setEncoding(null);
            // Hack that must be added to make this work as expected
            // delete sock._readableState.decoder;
            let ack = null;
            // RED.log.info('siaendpointConfig: New client connected: ' + remoteAddress);
            sock.on('message', (data, remote) => {
                // data = Buffer.from(data,'binary');
                // data = new Buffer(data);
                RED.log.debug('siaendpointConfig: UDP received from ' + remote.address + ' following data: ' + JSON.stringify(data));
                RED.log.info('siaendpointConfig: UDP received from ' + remote.address + ' following message: ' + data.toString().trim());
                let sia = parseSIA(data);
                if (sia) {
                    ack = ackSIA(sia);
                    if (ack) {
                        // set states only if ACK okay
                        setStatesSIA(sia);
                        node.nodeClients.forEach(oClient => {
                            oClient.sendPayload({ connection: "UDP", decoded: sia });
                        })
                        node.errorDescription = ""; // Reset the error
                        startHeartBeat();

                    } else {
                        let crcformat = getcrcFormat(data);
                        ack = nackSIA(crcformat);
                    }
                } else {
                    let crcformat = getcrcFormat(data);
                    ack = nackSIA(crcformat);
                }
                try {
                    RED.log.info('siaendpointConfig: sending ACK via UDP to ' + remote.address + ' following message: ' + ack.toString().trim());
                    sock.send(ack, 0, ack.length, remote.port, remote.address, (err, bytes) => {
                    });
                } catch (e) {
                    // Error Message
                    RED.log.error('siaendpointConfig: UDP Error sending ACK ' + e.message);
                }
            });
            sock.on('close', () => {
                RED.log.info('siaendpointConfig: UDP Connection closed');
            });
            sock.on('error', (err) => {
                RED.log.error('siaendpointConfig: UDP Error: ' + err.message);
                sock.close();
            });
        }

        /**
         * CRC Calculation. Example. crc16([0x20, 0x22])
         * @param {string} data - string
         */
        function crc16(data) {
            /* CRC table for the CRC-16. The poly is 0x8005 (x^16 + x^15 + x^2 + 1) */
            const crctab16 = new Uint16Array([
                0x0000, 0xC0C1, 0xC181, 0x0140, 0xC301, 0x03C0, 0x0280, 0xC241,
                0xC601, 0x06C0, 0x0780, 0xC741, 0x0500, 0xC5C1, 0xC481, 0x0440,
                0xCC01, 0x0CC0, 0x0D80, 0xCD41, 0x0F00, 0xCFC1, 0xCE81, 0x0E40,
                0x0A00, 0xCAC1, 0xCB81, 0x0B40, 0xC901, 0x09C0, 0x0880, 0xC841,
                0xD801, 0x18C0, 0x1980, 0xD941, 0x1B00, 0xDBC1, 0xDA81, 0x1A40,
                0x1E00, 0xDEC1, 0xDF81, 0x1F40, 0xDD01, 0x1DC0, 0x1C80, 0xDC41,
                0x1400, 0xD4C1, 0xD581, 0x1540, 0xD701, 0x17C0, 0x1680, 0xD641,
                0xD201, 0x12C0, 0x1380, 0xD341, 0x1100, 0xD1C1, 0xD081, 0x1040,
                0xF001, 0x30C0, 0x3180, 0xF141, 0x3300, 0xF3C1, 0xF281, 0x3240,
                0x3600, 0xF6C1, 0xF781, 0x3740, 0xF501, 0x35C0, 0x3480, 0xF441,
                0x3C00, 0xFCC1, 0xFD81, 0x3D40, 0xFF01, 0x3FC0, 0x3E80, 0xFE41,
                0xFA01, 0x3AC0, 0x3B80, 0xFB41, 0x3900, 0xF9C1, 0xF881, 0x3840,
                0x2800, 0xE8C1, 0xE981, 0x2940, 0xEB01, 0x2BC0, 0x2A80, 0xEA41,
                0xEE01, 0x2EC0, 0x2F80, 0xEF41, 0x2D00, 0xEDC1, 0xEC81, 0x2C40,
                0xE401, 0x24C0, 0x2580, 0xE541, 0x2700, 0xE7C1, 0xE681, 0x2640,
                0x2200, 0xE2C1, 0xE381, 0x2340, 0xE101, 0x21C0, 0x2080, 0xE041,
                0xA001, 0x60C0, 0x6180, 0xA141, 0x6300, 0xA3C1, 0xA281, 0x6240,
                0x6600, 0xA6C1, 0xA781, 0x6740, 0xA501, 0x65C0, 0x6480, 0xA441,
                0x6C00, 0xACC1, 0xAD81, 0x6D40, 0xAF01, 0x6FC0, 0x6E80, 0xAE41,
                0xAA01, 0x6AC0, 0x6B80, 0xAB41, 0x6900, 0xA9C1, 0xA881, 0x6840,
                0x7800, 0xB8C1, 0xB981, 0x7940, 0xBB01, 0x7BC0, 0x7A80, 0xBA41,
                0xBE01, 0x7EC0, 0x7F80, 0xBF41, 0x7D00, 0xBDC1, 0xBC81, 0x7C40,
                0xB401, 0x74C0, 0x7580, 0xB541, 0x7700, 0xB7C1, 0xB681, 0x7640,
                0x7200, 0xB2C1, 0xB381, 0x7340, 0xB101, 0x71C0, 0x7080, 0xB041,
                0x5000, 0x90C1, 0x9181, 0x5140, 0x9301, 0x53C0, 0x5280, 0x9241,
                0x9601, 0x56C0, 0x5780, 0x9741, 0x5500, 0x95C1, 0x9481, 0x5440,
                0x9C01, 0x5CC0, 0x5D80, 0x9D41, 0x5F00, 0x9FC1, 0x9E81, 0x5E40,
                0x5A00, 0x9AC1, 0x9B81, 0x5B40, 0x9901, 0x59C0, 0x5880, 0x9841,
                0x8801, 0x48C0, 0x4980, 0x8941, 0x4B00, 0x8BC1, 0x8A81, 0x4A40,
                0x4E00, 0x8EC1, 0x8F81, 0x4F40, 0x8D01, 0x4DC0, 0x4C80, 0x8C41,
                0x4400, 0x84C1, 0x8581, 0x4540, 0x8701, 0x47C0, 0x4680, 0x8641,
                0x8201, 0x42C0, 0x4380, 0x8341, 0x4100, 0x81C1, 0x8081, 0x4040
            ]);
            let len = data.length;
            let buffer = 0;
            let crc;
            while (len--) {
                crc = ((crc >>> 8) ^ (crctab16[(crc ^ (data[buffer++])) & 0xff]));
            }
            return crc;
            // return [(crc >>> 8 & 0xff), (crc & 0xff)];
        }

        /**
         * CRC Calculation. Example. crc16([0x20, 0x22])
         * @param {*} str 
         */
        function crc16str(str) {
            return crc16(new Buffer.from(str));
        }


        // Start the heartbeat timer
        function startHeartBeat() {
            if (node.timerHeartBeat !== null) clearTimeout(node.timerHeartBeat);
            node.timerHeartBeat = setTimeout(() => {
                node.errorDescription = "Timeout waiting for a message withing " + node.heartbeatTimeout + " seconds.";
                node.nodeClients.forEach(oClient => {
                    oClient.sendPayload({ errorDescription: node.errorDescription });
                })
                node.setAllClientsStatus({ fill: "red", shape: "dot", text: "Timeout waiting for a message withing " + node.heartbeatTimeout + " seconds." });
            }, node.heartbeatTimeout * 1000);
        }

        //#region "FUNCTIONS"
        node.on('close', function (removed, done) {
            try {
                if (servertcp !== null) servertcp.close();
                if (serverudp !== null) serverudp.close();
            } catch (error) { }
            done();
        });


        node.addClient = (_Node) => {
            // Check if node already exists
            if (node.nodeClients.filter(x => x.id === _Node.id).length === 0) {
                // Add _Node to the clients array
                node.nodeClients.push(_Node)
            }
            try {
                _Node.setNodeStatus({ fill: "grey", shape: "ring", text: "Waiting for connection" });
            } catch (error) { }
        };

        node.removeClient = (_Node) => {
            // Remove the client node from the clients array
            //if (node.debug) RED.log.info( "BEFORE Node " + _Node.id + " has been unsubscribed from receiving KNX messages. " + node.nodeClients.length);
            try {
                node.nodeClients = node.nodeClients.filter(x => x.id !== _Node.id)
            } catch (error) { }
            //if (node.debug) RED.log.info("siaendpointConfig: AFTER Node " + _Node.id + " has been unsubscribed from receiving KNX messages. " + node.nodeClients.length);

            // If no clien nodes, disconnect from bus.
            if (node.nodeClients.length === 0) {

            }
        };
        //#endregion

        // start socket server
        setTimeout(() => {
            try {
                serverStartTCP();
                serverStartUDP();
            } catch (error) {
                node.setAllClientsStatus({ fill: "red", shape: "dot", text: "Error instantiating server " + error.message });
                return;
            }

            startHeartBeat();

        }, 5000);

    }


    RED.nodes.registerType("siaendpoint-config", siaendpointConfig, {
        credentials: {
            accountnumber: { type: "text" },
            password: { type: "password" }
        }
    });
}
    ;