'use strict';

var inherits = require('util').inherits;
const requireUncached = require('require-uncached');

var Characteristic, Service;

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory('homebridge-w215', W215Accessory);
};

class W215Accessory {

    constructor(log, config, api) {
        this.api = api
        this.log = log;
        this.config = config;
        this.dsp = requireUncached('hnap/js/soapclient');
        this.name = config.name || 'DSP W215 Smart Plug';
        this.url = "http://" + config.host + "/HNAP1";
        this.username = config.username || 'admin';
        this.password = config.password;
        this.legacy = config.legacy || false;

        this.power = false;
        this.temperature = 0;
        this.consumption = 0;
        this.totalConsumption = 0;

        this.model = 'DSP W215';
        this.serialNumber = '12345';
        this.manufacturer = 'D-Link';

        this.informationService = new Service.AccessoryInformation()
            .setCharacteristic(Characteristic.Manufacturer, 'D-Link')
            .setCharacteristic(Characteristic.Model, 'DSP W215')
            .setCharacteristic(Characteristic.SerialNumber, '123456789');

        // Setup Switch Characteristics
        //================================
        // this.switchService = new Service.Switch(this.name);
        this.switchService = new this.api.hap.Service.Switch(this.name);

        // Power
        this.switchService.getCharacteristic(this.api.hap.Characteristic.On)
            .on('get', this.getPowerState.bind(this))
            .on('set', this.setPowerState.bind(this));

        // Consumption
        this.powerMeterService = this.__powerConsumptionService();

        // Temperature
        this.temperatureService = new this.api.hap.Service.TemperatureSensor(this.name);
        this.temperatureService.getCharacteristic(this.hap.api.Characteristic.CurrentTemperature)
            .on('get', this.getTemperature.bind(this));

        // Login
        this.login((loginStatus) => {
            if (!loginStatus) {
                return;
            }
            this.getState(function (deviceStatus) {
                if (!deviceStatus) {
                    return;
                }
                this.power = deviceStatus.power;
                this.temperature = deviceStatus.temperature;
                this.consumption = deviceStatus.consumption;
                this.totalConsumption = deviceStatus.totalConsumption;
            });
        });
    }

    login(callback) {
        this.dsp.login(this.username, this.password, this.url).done(callback);
    }

    getPowerState(callback) {
        this.getState((settings) => {
            callback(null, settings.temperature)
        })
    }

    setPowerState(newState, callback) {
        if (newState) {
            this.dsp.on().done((res) => {
                this.log.info("Power state changed to on")
                this.power = res;
                callback()
            })
        } else {
            this.dsp.off().done((res) => {
                this.log.info("Pwer state changed to off")
                this.power = res;
                callback();
            })
        }
    }

    getState(callback) {
        this.retries = 0;
        this.dsp.state().done((state) => {
            // Chances are of state is error we need to login again....
            if (state == 'ERROR') {
                if (this.retries >= 5) {
                    return;
                }
                this.retries += 1;
                this.login(function (loginStatus) {
                    this.getState(callback);
                });
                return;
            }
            this.dsp.totalConsumption().done(function (totalConsumption) {
                this.dsp.consumption().done(function (consumption) {
                    this.dsp.temperature().done(function (temperature) {
                        var settings = {
                            power: state == 'true',
                            consumption: parseInt(consumption),
                            totalConsumption: parseFloat(totalConsumption),
                            temperature: parseFloat(temperature)
                        }
                        this.retries = 0;
                        callback(settings);
                    });
                });
            });
        });
    }

    getPowerState(callback) {
        this.getState(function (settings) {
            callback(null, settings.power);
        });
    }

    getPowerConsumption(callback) {
        this.getState(function (settings) {
            callback(null, settings.consumption);
        });
    }

    getTemperature(callback) {
        this.getState(function (settings) {
            callback(null, settings.temperature);
        });
    }

    getTotalPowerConsumption(callback) {
        this.getState(function (settings) {
            callback(null, settings.totalConsumption);
        });
    }

    identify(callback) {
        callback();
    }

    getServices() {
        return [this.switchService, this.powerMeterService, this.temperatureService]
    }

    __powerConsumptionService() {
        var PowerConsumption = () => {
            Characteristic.call(this, 'Consumption', '2E05E08B-37AA-4113-8407-D99D41B74682');
            this.setProps({
                format: Characteristic.Formats.UINT16,
                unit: 'watts',
                maxValue: 10000,
                minValue: 0,
                minStep: 1,
                perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
            });
            this.value = this.getDefaultValue();
        };
        inherits(PowerConsumption, Characteristic);
    
        var TotalPowerConsumption = () => {
            Characteristic.call(this, 'Total Consumption', '4B29EE79-2464-461F-9DA7-F2390FD18207');
            this.setProps({
                format: Characteristic.Formats.FLOAT,
                unit: 'kilowatthours',
                maxValue: 1000000000,
                minValue: 0,
                minStep: 0.001,
                perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
            });
            this.value = this.getDefaultValue();
        };
        inherits(TotalPowerConsumption, Characteristic);
    
        var PowerMeterService = (displayName, subtype) => {
            Service.call(this, displayName, 'EB30422F-0872-4D62-82C0-E6DEA9A4557A', subtype);
            this.addCharacteristic(PowerConsumption);
            this.addOptionalCharacteristic(TotalPowerConsumption);
        };
    
        inherits(PowerMeterService, Service);
    
        var powerMeterService = new PowerMeterService(this.name);
        powerMeterService.getCharacteristic(PowerConsumption).on('get', this.getPowerConsumption.bind(this));
        powerMeterService.addCharacteristic(TotalPowerConsumption).on('get', this.getTotalPowerConsumption.bind(this));
        return powerMeterService;
    }
}
