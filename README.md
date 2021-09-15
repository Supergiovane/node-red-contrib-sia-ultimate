# node-red-contrib-sia-ultimate
Connect your SIA-DCS compatible alarm system to node-red. It works with Ajax System too.

This is a porting from iobroker.sia by schmupu. They did a very good job.



## EXAMPLE OF CONFIGURING AJAX HUB ##

<img src="https://raw.githubusercontent.com/Supergiovane/node-red-contrib-sia-ultimate/master/img/wiki/ajax.png" width="90%"><br/>


* In the settings of your hub, go to the monitoring stations page.
* Select “SIA Protocol”.
* Enable “Connect on demand”.
* Place Account Id - 3-16 ASCII hex characters. For example 000.
* Insert Node-Red IP address. The hub must be able to reach this IP address. There is no cloud connection necessary.
* Insert Node-Red listening port. This port must not be used by anything else on the machine Node-Red is running on, see the notes on port usage below.
* Select Preferred Network. Ethernet is preferred if hub and HA in same network. Multiple networks are not tested.
* Enable Periodic Reports. The interval with which the alarm systems reports to the monitoring station, default is 1 minute.
* Encryption is preferred but optional. Password is 16, 24 or 32 ASCII characters.