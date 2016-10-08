var Beacon;

/**
 * Bluetooth Capability
 *
 * @constructor
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.0.1
 * @version  0.1.0
 */
var Bluetooth = Function.inherits('Elric.Capability', function BluetoothCapability() {
	BluetoothCapability.super.call(this);
});

/**
 * Constitute the class wide schema
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Bluetooth.constitute(function addFields() {
	// What version does this bluetooth dongle support?
	this.schema.addField('bluetooth_version', 'Number', {default: 4});
});

/**
 * The description of this capability
 *
 * @type   {String}
 */
Bluetooth.setProperty('description', 'Detect and control bluetooth devices');

/**
 * The view element to use for the configuring panel
 *
 * @type   {String}
 */
Bluetooth.setProperty('config_element', '');

/**
 * Process a remote advert
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {ClientDocument}   client
 * @param    {Object}           advert
 */
Bluetooth.setMethod(function processAdvert(client, advert) {

	// Get a single beacon model instance
	if (!Beacon) {
		Beacon = Model.get('Beacon');
	}

	// Certain beacons aren't random, but still say they are,
	// so don't return for now
	if (!advert.public) {
		//console.log('Skipping non-public advert', advert);
		//return;
	}

	// Get or create by advert, allow random addresses
	Beacon.getByAdvert(advert, true, function gotBeacon(err, beacon) {

		if (err) {
			console.error('Could not get/create beacon!', advert);
			throw err;
		}

		if (!beacon) {
			console.log('Could not find beacon', advert);
			return;
		}

		beacon.processAdvert(advert, client);
	});
});