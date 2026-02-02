# node-red-contrib-sia-ultimate


<br/>

[![Donate via PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg?style=flat-square)](https://www.paypal.me/techtoday) 

<br/>

<p>
<b>Version 1.0.11</b> - February 2026<br/>
- NEW: added TCP connection handling options (like ioBroker): you can choose if the SIA server closes the TCP connection after ACK, or if it must wait the panel to close it.<br/>
- NEW: added configurable close delay after ACK (ms) and panel close timeout (sec).<br/>
</p>
<p>
<b>Version 1.0.10</b> - Mai 2024<br/>
- FIX: changed the connection error log's severity, from "error" to "debug" in node-red, to avoid IPv6 net error clogging the log.<br/>
</p>
<p>
<b>Version 1.0.9</b> - April 2024<br/>
- FIX: fixed a crash when you select a server port already used by another service.<br/>
</p>
<p>
<b>Version 1.0.7</b> - October 2023<br/>
- Updated help panel. Now you can read the help direclty in the Node-Red help tab.<br/>
</p>
<p>
<b>Version 1.0.6</b> - January 2022<br/>
- FIX: fixed an issue preventing the TCP server to start.<br/>
</p>
<p>
<b>Version 1.0.5</b> - December 2021<br/>
- FIX: fix a possible crash if you have more than 1 server node with the same port.<br/>
</p>
<p>
<b>Version 1.0.4</b> - December 2021<br/>
- FIX: a possible crash if the TCP/UDP port are already in use.<br/>
</p>
<p>
<b>Version 1.0.2</b> - December 2021<br/>
- FIX: fixed an issue with Ajax Hub 2. In some circumstances, the ACK wasn't read by Ajax due to the too speedy disconnection after senind the ACK telegram.<br/>
</p>
<p>
<b>Version 1.0.1</b> - December 2021<br/>
- Added some try..catch.<br/>
</p>
<p>
<b>Version 1.0.0</b> - September 2021<br/>
- Stable release.<br/>
</p>
<p>
<b>Version 0.0.4 BETA</b> - September 2021<br/>
- You can now add a list of your device names, based on device ID.<br/>
</p>
<p>
<b>Version 0.0.3 BETA</b><br/>
- Added device ID that fired the message, into the payload object.<br/>
</p>
<p>
<b>Version 0.0.2 BETA</b><br/>
- Initial release<br/>
</p>
