# node-red-contrib-sia-ultimate

<img src="https://raw.githubusercontent.com/Supergiovane/node-red-contrib-sia-ultimate/master/img/main.png" width="80%"><br/>

Connect your SIA-DCS compatible alarm system to node-red.

<br/>

[![NPM version][npm-version-image]][npm-url]
[![NPM downloads per month][npm-downloads-month-image]][npm-url]
[![NPM downloads total][npm-downloads-total-image]][npm-url]
[![MIT License][license-image]][license-url]
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Facebook][facebook-image]][facebook-url]
[![Donate via PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg?style=flat-square)](https://www.paypal.me/techtoday) 

**WARNING: the node is still in BETA version, is not yet stable enough for real use**

## CHANGELOG

* See <a href="https://github.com/Supergiovane/node-red-contrib-sia-ultimate/blob/master/CHANGELOG.md">here the changelog</a>

## EXAMPLE OF CONFIGURING AJAX HUB ##

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