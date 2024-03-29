# node-red-contrib-sia-ultimate

Connect your SIA-DCS compatible alarm system to node-red.

<br/>

[![NPM version][npm-version-image]][npm-url]
[![NPM downloads per month][npm-downloads-month-image]][npm-url]
[![NPM downloads total][npm-downloads-total-image]][npm-url]
[![MIT License][license-image]][license-url]
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Facebook][facebook-image]][facebook-url]
[![Donate via PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg?style=flat-square)](https://www.paypal.me/techtoday) 


<br/>
<br/>

## CHANGELOG

* See <a href="https://github.com/Supergiovane/node-red-contrib-sia-ultimate/blob/master/CHANGELOG.md">here the changelog</a>

<br/>
<br/>

**EXAMPLE OF CONFIGURING AJAX HUB**

<img src="https://raw.githubusercontent.com/Supergiovane/node-red-contrib-sia-ultimate/master/img/ajax.png" width="50%"><br/>


* In the settings of your hub, go to the monitoring stations page.
* Select “SIA Protocol”.
* Enable “Connect on demand”.
* Place Account Id - 3-16 ASCII hex characters. For example 000.
* Insert Node-Red IP address. The hub must be able to reach this IP address. There is no cloud connection necessary.
* Insert Node-Red listening port. This port must not be used by anything else on the machine Node-Red is running on, see the notes on port usage below.
* Select Preferred Network. Ethernet is preferred if hub and HA in same network. Multiple networks are not tested.
* Enable Periodic Reports. The interval with which the alarm systems reports to the monitoring station, default is 1 minute.
* Encryption is preferred but optional. Password is 16, 24 or 32 ASCII characters.

<br/>
<br/>

# SIA-DCS NODE
The SIA-DCS node listens from incoming SIA messages from your alarm device.<br/>
Everytime a SIA message arrives, the node decodes it and outputs it to the flow.<br/>

<br/>

<img src="https://raw.githubusercontent.com/Supergiovane/node-red-contrib-sia-ultimate/master/img/main.png" width="80%"><br/>

In this example, the node retrieves all messages from the SIA client. You'll see that the device list (in the server configuration window), is also filled with some devicenames/id samples.

**Copy this code and paste it into your flow**

<details><summary>View code</summary>

> Adjust the nodes according to your setup

<code>
[{"id":"90f04fe351adfd9b","type":"debug","z":"4e8eb9b80650f523","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","statusVal":"","statusType":"auto","x":470,"y":120,"wires":[]},{"id":"2fc45b7cddeb3150","type":"SIAUltimate","z":"4e8eb9b80650f523","name":"","topic":"Banano","server":"bea9e0c70f4e12c6","discardAutomaticTest":"no","x":200,"y":140,"wires":[["90f04fe351adfd9b"],["30898bf6227f9439"]]},{"id":"30898bf6227f9439","type":"debug","z":"4e8eb9b80650f523","name":"","active":true,"tosidebar":true,"console":false,"tostatus":false,"complete":"true","targetType":"full","statusVal":"","statusType":"auto","x":470,"y":160,"wires":[]},{"id":"169dd9a9fdde7c6c","type":"comment","z":"4e8eb9b80650f523","name":"SIA-DCS Messages receiver","info":"","x":240,"y":100,"wires":[]},{"id":"bea9e0c70f4e12c6","type":"siaendpoint-config","port":"4628","name":"Server","acktimeout":"12","hex":"no","aes":"no","heartbeatTimeout":"120","deviceList":"0000,Alarm Panel\n1,PIR Bedrom\n2,Microwave Front Door\n4,PIR Soggiorno","credentials":{}}]
</code>
</details>

<br/>
<br/>

## CONFIGURATION

**SERVER CONFIGURATION**

* **Name:** choose the name you want. This is the node name.
* **Listen to port**: choose a free port. This port must be the same you set into the SIA configuration of your alarm panel
* **SIA Account**: choose what you want, for example 000
* **SIA Password**: optional, you can choose a password to decrypt the messages (Default, leave blank). This work if you select **Crypted** "yes" below.
* **Crypted**: optional, AES decryption enabled/disabled (Default "No")
* **Password in HEX format**: optional, select "yes" if the password you choose in your SIA configuration of your alarm panel is in HEX format (Default "No")
* **SIA message must be no older than (in secs)**: discard messages older than, for example, 20 seconds. This avoid processing old unwanted events (Default 0, that means that nothing will be discarded)
* **Emit error if no messages arrive within seconds**: if a message is not received during this interval (in seconds), the node will emit an error on PIN 2. This is useful for monitoring the connection to your alarm panel (Default 120 seconds)
* **SIA-DC09 Device List**: You can import your own list of device names and device ids. The node will emit the device name based on device ID in the SIA message. Currently compatible only with ***SIA-DC09***. For example:
    - 0000,Alarm Panel
    - 1,PIR Bedrom
    - 2,Microwave Front Door
    - 4,PIR Soggiorno

<br/>

**NODE CONFIGURATION**

* **Server**: choose the server from the list, or add a new one
* **Name**: choose the name you want. This is the node name.
* **Node Topic**: this is the node topic. Choose what you want
* **FILTERS**
    * **Discard test messages**: your alarm panel can send an automatic test message once a time, to check that the SIA-DCS node is connected. You can avoid the node sending a msg to the flow everytime this automatuc test message is received. The node will still emit an ERROR message on the PIN 2, if it doesn't receive any message during the period specified in *Emit error if no messages arrive within seconds* parameter.

<br/>
<br/>

**Output PIN 1**

Pin 1 emits the current received SIA message

```javascript
msg = {
   "connection":"TCP", // (Or UDP, in case of UDP connections)
   "decoded":{
      "lf":10,
      "len":37,
      "crc":53406,
      "crcformat":"hex",
      "cr":13,
      "str":"\"SIA-DCS\"0119L0#000[#000|Nri0/RP0000]",
      "calc_len":37,
      "calc_crc":53406,
      "id":"SIA-DCS",
      "seq":"0119",
      "rpref":"",
      "lpref":"0",
      "act":"000",
      "pad":"",
      "data_message":"#000|Nri0/RP0000",
      "data_extended":"",
      "ts":""
   },
   "topic":"Banano",
   "payload":{ // This contains the message decoded
      "deviceName": "PIR Badroom", // The device name is taken from the list you filled in the server configuration node
      "deviceID": "4", // Device ID that fired the event
      "code":"RP",
      "description":"AUTOMATIC TEST"
   },
   "_msgid":"9e49e52528dbfac5"
}
```

**Output PIN 2 (connection error)**

If, after the elapsed intervall, no messages have been received, it raises an error

```javascript
msg = {
    "topic": "",
    "errorDescription": "" // This will contain the error rescription, in case of errors.
}
```

<br/>
<br/>


<br/>
This is a partial porting/revisiting from iobroker.sia by schmupu. They did a very good job.


[license-image]: https://img.shields.io/badge/license-MIT-blue.svg
[license-url]: https://github.com/Supergiovane/node-red-contrib-sia-ultimate/master/LICENSE
[npm-url]: https://npmjs.org/package/node-red-contrib-sia-ultimate
[npm-version-image]: https://img.shields.io/npm/v/node-red-contrib-sia-ultimate.svg
[npm-downloads-month-image]: https://img.shields.io/npm/dm/node-red-contrib-sia-ultimate.svg
[npm-downloads-total-image]: https://img.shields.io/npm/dt/node-red-contrib-sia-ultimate.svg
[facebook-image]: https://img.shields.io/badge/Visit%20me-Facebook-blue
[facebook-url]: https://www.facebook.com/supergiovaneDev