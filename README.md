# Not maintained
I've not maintained this plugin, in a long while as I ended up moving back to homebridge. Please see one of the forks for bug fixes or submit a pull request and I will re-release

## Homebridge plugin for DSP w215

Takes advantage of bikerp/dsp-w215-hnap: https://github.com/bikerp/dsp-w215-hnap.

### Features
* Includes ability to turn on and off w215 smart switches
* Measures temperature from smart plug
* Measures current device consumption in watts
* Measures device total consumption in kilowatt hours

### Install
Setup is straight forward:
````bash
npm install -g homebridge-w215
````
#### Configuration:
Add the following accessory to your config.json.

````javascript
{
	"accessories": [{
		"accessory": "w215",
		"name": "Your device name",
		"host": "hostname of plug or ip address",
		"username": "admin", //default is always admin
		"password": "your device pin"
	}],
	...
}
````
#### Issues
Add a github issue and I will look into it. It's early days yet and I just got this working for my own w215 switches.
#### Notes:
* This accessory plugin does not perform discovery, although that would be great. You have to add it to your config.json. I did consider doing this as a MQTT plugin so that I could use it in both homebridge and smartthings... Maybe in a future life.
* You will not be able to see power consumption in the Home app provided by apple. This is pretty poor really, but if you download eve home, it's a bit more comprehensive. There is also an app in the app store called "Home" that costs £10 that claims to be the most comprehensive... If you're cheap like me, I would go with EVE if you want that kind of information, or use the d-link app to get consumption.
