'use strict';

var inherits = require('util').inherits;
var dsp = require('hnap/js/soapclient');

var Characteristic, Service;

module.exports = function(homebridge) {
    console.log("homebridge API version: " + homebridge.version);
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory('homebridge-w215', 'w215', W215Accessory, false);
};

function W215Accessory(log, config, api) {

    this.log = log;
    this.config = config;
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
    var self = this;
    this.login(function(loginStatus) {
        if (!loginStatus) {
            return;
        }
        self.getState(function(deviceStatus) {
            if (!deviceStatus) {
                return;
            }
            self.power = deviceStatus.power;
            self.temperature = deviceStatus.temperature;
            self.consumption = deviceStatus.consumption;
            self.totalConsumption = deviceStatus.totalConsumption;
        });
    });
}

W215Accessory.prototype.login = function(callback) {
    dsp.login(this.username, this.password, this.url).done(callback);
};

W215Accessory.prototype.getPowerState = function(callback) {
    this.getState(function(settings){
        callback(null, settings.power);
    });
}

W215Accessory.prototype.getTemperature = function(callback) {
    this.getState(function(settings){
        callback(null, settings.temperature);
    });
}

W215Accessory.prototype.setPowerState = function(state, callback) {
    var self = this;
    console.log(state);
    if (state) {
        dsp.on().done(function(res) {
            console.log(res);
            self.power = res;
            callback();
        });
    } else {
        dsp.off().done(function(res) {
            console.log(res);
            self.power = res;
            callback();
        });
    }
};

W215Accessory.prototype.getPowerConsumption = function(callback) {
    this.getState(function(settings){
        callback(null, settings.consumption);
    });
};

W215Accessory.prototype.getTotalPowerConsumption = function(callback) {
    this.getState(function(settings){
        callback(null, settings.totalConsumption);
    });
};

W215Accessory.prototype.getState = function(callback) {
    var self = this;
    this.retries = 0;
    dsp.state().done(function(state) {
        // Chances are of state is error we need to login again....
        if (state == 'ERROR') {
            if (self.retries >= 5) {
                return;
            }
            self.retries += 1;
            self.login(function(loginStatus) {
                self.getState(callback);
            });
            return;
        }
        dsp.totalConsumption().done(function(totalConsumption) {
            dsp.consumption().done(function(consumption) {
                dsp.temperature().done(function(temperature) {
                    var settings = {
                        power: state == 'true',
                        consumption: parseInt(consumption),
                        totalConsumption: parseFloat(totalConsumption),
                        temperature: parseFloat(temperature)
                    }
                    console.log("Values");
                    console.log(settings);
                    self.retries = 0;
                    callback(settings);
                });
            });
        });
    });
};

W215Accessory.prototype.identify = function(callback) {
    callback();    
};

W215Accessory.prototype.getServices = function() {
    this.informationService = new Service.AccessoryInformation();

    this.informationService.setCharacteristic(Characteristic.Manufacturer, 'D-Link');
    this.informationService.setCharacteristic(Characteristic.Model, 'DSP W215');
    this.informationService.setCharacteristic(Characteristic.SerialNumber, '123456789');

    // Setup Switch Characteristics
    //================================
    this.switchService = new Service.Switch(this.name);
    // Power
    this.switchService.getCharacteristic(Characteristic.On).on('get', this.getPowerState.bind(this))
        .on('set', this.setPowerState.bind(this));

    // Consumption
    this.powerMeterService = this.__powerConsumptionService();

    // Temperature
    this.temperatureService = new Service.TemperatureSensor(this.name);
    this.temperatureService.getCharacteristic(Characteristic.CurrentTemperature).on('get', this.getTemperature.bind(this));
    
    return [this.switchService, this.powerMeterService, this.temperatureService];
};

W215Accessory.prototype.__powerConsumptionService = function() {
    var PowerConsumption = function() {
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

    var TotalPowerConsumption = function() {
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

    var PowerMeterService = function(displayName, subtype) {
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