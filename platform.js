'use strict';

/**
 * Utility function to validate String Objects
 * @param val The value to be evaluated.
 * @returns {boolean}
 */
var isString = function (val) {
	return typeof val === 'string' || ((!!val && typeof val === 'object') && Object.prototype.toString.call(val) === '[object String]');
};

/**
 * Utility function to validate Error Objects
 * @param val The value to be evaluated.
 * @returns {boolean}
 */
var isError = function (val) {
	return (!!val && typeof val === 'object') && typeof val.message === 'string' && Object.prototype.toString.call(val) === '[object Error]';
};

/**
 * Utility function to generate a random String as identifier for request IDs
 * @returns {string}
 */
var generateRequestId = function () {
	return (Math.random()*1e64).toString(36);
};

/**
 * Main object used to communicate with the platform.
 * @returns {Platform}
 * @constructor
 */
function Platform() {
	if (!(this instanceof Platform)) return new Platform();

	require('events').EventEmitter.call(this);
	Platform.init.call(this);
}

require('util').inherits(Platform, require('events').EventEmitter);

/**
 * Init function for Platform.
 */
Platform.init = function () {
	['SIGHUP', 'SIGINT', 'SIGTERM'].forEach((signal) => {
		process.on(signal, () => {
			console.log(`Executing ${signal} listener...`);
			this.emit('close');

			setTimeout(() => {
				this.removeAllListeners();
				process.exit();
			}, 2000);
		});
	});

	['unhandledRejection', 'uncaughtException'].forEach((exceptionEvent) => {
		process.on(exceptionEvent, (error) => {
			console.error(exceptionEvent, error);
			this.handleException(error);
			this.emit('close');

			setTimeout(() => {
				this.removeAllListeners();
				process.exit(1);
			}, 2000);
		});
	});

	process.on('message', (m) => {
		if (m.type === 'ready')
			this.emit('ready', m.data.options);
		else if (m.type === 'sync')
			this.emit('sync', m.data.last_sync_dt);
		else if (m.type === 'close')
			this.emit('close');
		else
			this.emit(m.type, m.data);
	});
};

/**
 * Needs to be called once in order to notify the platform that the plugin has already finished the init process.
 * @param {function} [callback] Optional callback to be called once the ready signal has been sent.
 */
Platform.prototype.notifyReady = function (callback) {
	callback = callback || function () {
		};

	setImmediate(() => {
		process.send({
			type: 'ready'
		}, callback);
	});
};

/**
 * Notifies the platform that resources have been released and this plugin can shutdown gracefully.
 * @param {function} [callback] Optional callback to be called once the close signal has been sent.
 */
Platform.prototype.notifyClose = function (callback) {
	callback = callback || function () {
		};

	setImmediate(() => {
		process.send({
			type: 'close'
		}, callback);
	});
};

/**
 * Gets the Device Information from the platform based on the Device ID passed.
 * Returns an auto-generated Request ID or event to listen to for the device data.
 * @param {string} device The client or device identifier.
 * @param {function} callback(error, requestId) Callback function to be called that returns a request id to listen to for the device information. Device information includes the Device ID, Name, Metadata and State.
 */
Platform.prototype.requestDeviceInfo = function (device, callback) {
	if (typeof callback !== 'function') return callback(new Error('Callback function must be provided.'));
	if (!device || !isString(device)) return callback(new Error('A valid client/device identifier is required.'));

	let requestId = generateRequestId();

	setImmediate(() => {
		callback(null, requestId);
	});

	process.send({
		type: 'requestdeviceinfo',
		data: {
			requestId: requestId,
			deviceId: device
		}
	}, (error) => {
		if (error) {
			this.removeAllListeners(requestId);
			this.handleException(error);
		}
	});

	setTimeout(() => {
		this.removeAllListeners(requestId);
	}, 10000);
};

/**
 * Sets the device' state on the platform. State can be any information based on incoming data being received
 * from the device or any other arbitrary information that needs to be stored dynamically.
 * @param {string} device The client or device identifier.
 * @param {any|object|string|number|date|array} state Information to store as device' state.
 * @param {function} [callback] Optional callback to be called once the signal has been sent.
 */
Platform.prototype.setDeviceState = function (device, state, callback) {
	callback = callback || function () {
		};

	setImmediate(() => {
		process.send({
			type: 'setdevicestate',
			data: {
				deviceId: device,
				state: state
			}
		}, callback);
	});
};

/**
 * Sends the device/sensor data to the platform to be processed.
 * @param {string} device The client or device identifier.
 * @param {string} data The JSON data to be processed.
 * @param callback Optional callback to be called once the data has been sent.
 */
Platform.prototype.processData = function (device, data, callback) {
	callback = callback || function () {
		};

	setImmediate(() => {
		if (!device || !isString(device)) return callback(new Error('A valid client/device identifier is required.'));
		if (!data || !isString(data)) return callback(new Error('A valid data is required.'));

		process.send({
			type: 'data',
			data: {
				device: device,
				data: data
			}
		}, callback);
	});
};

/**
 * Logs any data to the attached loggers in the topology.
 * @param {string} data The data that needs to be logged.
 * @param {function} [callback] Optional callback to be called once the data has been sent.
 */
Platform.prototype.log = function (data, callback) {
	callback = callback || function () {
		};

	if (!data || !isString(data)) return callback(new Error('A valid log data is required.'));

	process.send({
		type: 'log',
		data: data
	}, callback);
};

/**
 * Logs errors to all the attached exception handlers in the topology.
 * @param {error} error The error to be handled/logged
 * @param {function} [callback] Optional callback to be called once the error has been sent.
 */
Platform.prototype.handleException = function (error, callback) {
	callback = callback || function () {
		};

	setImmediate(() => {
		if (!isError(error)) return callback(new Error('A valid error object is required.'));

		process.send({
			type: 'error',
			data: {
				name: error.name,
				message: error.message,
				stack: error.stack
			}
		}, callback);
	});
};

module.exports = new Platform();
