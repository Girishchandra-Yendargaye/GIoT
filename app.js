'use strict';

var platform = require('./platform'),
	mqttClient;

platform.once('close', function () {
	let d = require('domain').create();

	d.once('error', function (error) {
		console.error(error);
		platform.handleException(error);
		platform.notifyClose();
		d.exit();
	});

	d.run(function () {
		mqttClient.end();
		platform.notifyClose();
		d.exit();
	});
});

platform.once('ready', function (options) {
    let mqtt = require('mqtt'),
        isEmpty = require('lodash.isempty'),
        async = require('async'),
        get = require('lodash.get'),
        connectionParams = {};

    if(options.host.endsWith('/'))
        options.host = options.host.slice(0, -1);

    connectionParams.host = options.host;
    connectionParams.port = options.port;

    if(!isEmpty(options.username) && !isEmpty(options.password)){
        connectionParams.username = options.username;
        connectionParams.password = options.password;
    }

	var url  = 'mqtts://'+ connectionParams.username+':'+connectionParams.password +'@'+connectionParams.host+':'+connectionParams.port;
    mqttClient = mqtt.connect(url);

    mqttClient.on('message', (topic, payload) => {
        payload = payload.toString();

        async.waterfall([
            async.constant(payload || '{}'),
            async.asyncify(JSON.parse)
        ], (error, data) => {
            if (error || isEmpty(data)) {
                return platform.handleException(new Error(`Invalid data. Data must be a valid JSON String. Raw Message: ${payload}`));
            }

            if(isEmpty(get(data, 'device')))
                return platform.handleException(new Error(`Data should contain a device field. Data: ${data}`));

            platform.requestDeviceInfo(data.device, function (error, requestId) {
                platform.once(requestId, function (deviceInfo) {
                    if (deviceInfo) {
                        platform.processData(data.device, payload);

                        platform.log(JSON.stringify({
                            title: 'MQTT Stream - Data Received',
                            device: data.device,
                            data: data
                        }));
                    }
                    else
                        platform.handleException(new Error(`Device ${data.device} not registered`));
                });
            });
        });
    });

    mqttClient.on('connect', () => {
        mqttClient.subscribe(options.topic);

        platform.notifyReady();
        platform.log('MQTT Stream has been initialized.');
    });
});