var Bluejeans = elric.use('bluejeans');

/**
 * The Bluetooth ClientFile
 *
 * @constructor
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
var Bluetooth = Function.inherits('ClientFile', function BluetoothClientFile(client, settings) {

	var that = this;

	// Call the parent constructor
	BluetoothClientFile.super.call(this, client, settings);
});

/**
 * Startup!
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Bluetooth.setMethod(function start(callback) {

	var that = this;

	// Create the bluejeans instance
	this.bluejeans = new Bluejeans();

	// Start scanning for LE devices
	this.bluejeans.backend.leScan();

	// Listen for adverts
	this.bluejeans.backend.on('advert', function onAdvert(advert) {

		var info = {
			address : advert.address,
			rssi    : advert.rssi,
			name    : advert.eir.local_name,
			tx      : advert.eir.tx_power_level,
			public  : advert.address_type == 'public'
		};

		that.remoteCommand('processAdvert', info);
	});

	// Call back when started
	callback(null);
});

/**
 * Stop
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Bluetooth.setMethod(function stop() {
	// Stop the plugin
	if (this.bluejeans && this.bluejeans.backend) {
		this.bluejeans.backend.destroy();
	}

	this.bluejeans = null;
});

module.exports = Bluetooth.create;