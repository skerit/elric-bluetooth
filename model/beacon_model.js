var beacon_cache = {};

/**
 * The Beacon Model
 *
 * @constructor
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.0.1
 * @version  0.1.0
 */
var Beacon = Model.extend(function BeaconModel(options) {
	BeaconModel.super.call(this, options);
});

/**
 * Constitute the class wide schema
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Beacon.constitute(function addFields() {

	var devices = alchemy.shared('elric.device_type');

	// Each beacon belongs to a specific user
	this.belongsTo('User');

	// The advertised name
	this.addField('name', 'String');

	// The title given to this beacon
	this.addField('title', 'String');

	// The bluetooth address
	this.addField('address', 'String');

	// When it was last seen
	this.addField('last_seen', 'Datetime');

	// What kind of address this device has (random or public)
	this.addField('address_type', 'String');
});

/**
 * Configure chimera for this model
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Beacon.constitute(function chimeraConfig() {

	var list,
	    edit;

	if (!this.chimera) {
		return;
	}

	// Get the list group
	list = this.chimera.getActionFields('list');

	list.addField('name');
	list.addField('title');
	list.addField('address');
	list.addField('last_seen');
	list.addField('user_id');

	// Get the edit group
	edit = this.chimera.getActionFields('edit');

	edit.addField('name');
	edit.addField('title');
	edit.addField('address');
	edit.addField('last_seen');
	edit.addField('user_id');
});

/**
 * Create a beacon record by advert
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {String}   address
 * @param    {Boolean}  force_create   Create even if it is a random address
 *
 * @return   {Document}
 */
Beacon.setMethod(function createByAdvert(advert, force_create) {

	var record,
	    data;

	// See if the beacon has already been made
	if (beacon_cache[advert.address]) {
		return beacon_cache[advert.address];
	}

	if (!advert.public && !force_create) {
		console.log('Not creating beacon because of random address', advert);
		return;
	}

	console.log('Creating by advert:', advert);

	data = {
		name         : advert.name,
		title        : advert.name,
		address      : advert.address,
		address_type : advert.public ? 'public' : 'random',
		last_seen    : new Date()
	};

	record = this.createDocument(data);

	// Store the record in the cache
	beacon_cache[advert.address] = record;

	// Save the data
	this.save(record);

	return record;
});

/**
 * Look for a beacon by its id
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {ObjectID} id
 * @param    {Function} callback
 */
Beacon.setMethod(function getById(id, callback) {

	var that = this,
	    address,
	    beacon;

	for (address in beacon_cache) {
		beacon = beacon_cache[address];

		if (String(beacon._id) == String(id)) {
			return callback(null, beacon);
		}
	}

	this.findById(id, function gotBeacon(err, beacon) {

		if (err) {
			return callback(err);
		}

		if (beacon.length) {
			beacon_cache[beacon.address] = beacon;
			return callback(null, beacon);
		}

		return callback(new Error('Beacon not found!'));
	});
});

/**
 * Look for a beacon
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Object}   advert
 * @param    {Boolean}  allow_random
 * @param    {Function} callback
 */
Beacon.setMethod(function getByAdvert(advert, allow_random, callback) {

	var that = this,
	    address = advert.address,
	    options;

	if (typeof allow_random == 'function') {
		callback = allow_random;
		allow_random = false;
	}

	if (beacon_cache[address]) {
		return setImmediate(function doCallback() {
			callback(null, beacon_cache[address]);
		});
	}

	options = {
		conditions: {
			address: address
		}
	};

	this.find('first', options, function gotBeacon(err, beacon) {

		if (err) {
			return callback(err);
		}

		// If it was allready cached in the mean time, return that
		if (beacon_cache[address]) {
			return callback(null, beacon_cache[address]);
		}

		// If a result was found, cache it and return it
		if (beacon.length) {
			beacon_cache[address] = beacon;
			return callback(null, beacon);
		}

		// Else create a new one
		return callback(null, that.createByAdvert(advert, allow_random));
	});
});

/**
 * Initialize the document
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Beacon.setDocumentMethod(function init() {

});

/**
 * Create a throttled save function
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Beacon.setDocumentMethod(function throttleSave() {

	var that = this;

	if (!this._throttled_save) {
		this._throttled_save = Function.throttle(function doSave() {
			that.save();
		}, 2000);
	}

	// Limit it to once every 2 seconds
	this._throttled_save();
});

/**
 * Get this beacon's position classifier
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Function}   callback
 */
Beacon.setDocumentMethod(function getPositionClassifier(callback) {

	var that = this;

	if (this._fetching_classifier) {
		return this.oncence('position_classifier', function gotClassifier(classifier) {
			return callback(null, classifier);
		});
	}

	Function.series(function getClassifier(next) {

		var LCM,
		    options;

		// If the classifier has already been fetched, do nothing
		if (that._position_classifier) {
			return next();
		}

		options = {
			conditions: {
				beacon_id: that._id
			}
		};

		LCM = Model.get('LocationClassifier');

		LCM.find('first', options, function gotClassifier(err, record) {

			if (err) {
				return next(err);
			}

			if (!record.length) {
				record = LCM.createDocument();
				record.beacon_id = that._id;
			}

			if (!record.instance) {
				record.instance = new Classes.Elric.LocationClassifier();
			}

			that._position_classifier = record;

			that.emit('position_classifier', record);

			next();
		});
	}, function done(err) {

		if (err) {
			return callback(err);
		}

		return callback(null, that._position_classifier);
	});
});

/**
 * Start training the position classifier
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Function}   callback
 */
Beacon.setDocumentMethod(function startLocationTraining(callback) {

	var that = this;

	// Get the classifier record
	this.getPositionClassifier(function gotClassifier(err, classifier) {

		if (err) {
			return callback(err);
		}

		classifier.train(callback);
	});
});

/**
 * Start collection samples for location classifier
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Object}   data   Data containing beacon position
 */
Beacon.setDocumentMethod(function startLocationSampleCollection(data) {

	var record,
	    BT;

	// Ignore if already training
	if (this._training_record) {
		return false;
	}

	BT = Model.get('LocationTrain');
	record = BT.createDocument();

	record.beacon_id = this._id;
	record.name = data.name;
	record.location_id = data.location_id;
	record.data = {};

	this._location_training_record = record;

	console.log('Going to train:', data);
});

/**
 * Stop training location
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Beacon.setDocumentMethod(function stopLocationSampleCollection() {

	var record;

	if (!this._location_training_record) {
		return;
	}

	record = this._location_training_record;
	this._location_training_record = null;

	// A final save
	record.save();
});

/**
 * Start training
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Object}   data   Data containing beacon position
 */
Beacon.setDocumentMethod(function startPositionSampleCollection(data) {

	var record,
	    BT;

	// Ignore if already training
	if (this._training_record) {
		return false;
	}

	BT = Model.get('BeaconTrain');
	record = BT.createDocument();

	record.beacon_id = this._id;
	record.x = data.x;
	record.y = data.y;
	record.z = data.z;
	record.data = {};

	this._training_record = record;

	console.log('Going to train:', data);
});

/**
 * Stop training
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Beacon.setDocumentMethod(function stopPositionSampleCollection() {

	var record;

	if (!this._training_record) {
		return;
	}

	record = this._training_record;
	this._training_record = null;

	// A final save
	record.save();
});

/**
 * Process incoming advert
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Object}   advert
 */
Beacon.setDocumentMethod(function processAdvert(advert, client) {

	var data;

	// Update last seen timestamp
	this.last_seen = new Date();

	// If no name was found yet, set it now
	if (!this.name && advert.name) {
		this.name = advert.name;

		if (!this.title) {
			this.title = advert.name;
		}
	}

	data = {
		seen     : this.last_seen,
		rssi     : advert.rssi,
		tx       : advert.tx,
		distance : this.calculateDistance(advert.rssi, advert.tx)
	};

	if (this._training_record) {

		if (!this._training_record.data[client._id]) {
			this._training_record.data[client._id] = [];
		}

		this._training_record.data[client._id].push(data);

		this.emit('training_data', client._id, data);
	}

	if (this._location_training_record) {
		if (!this._location_training_record.data[client._id]) {
			this._location_training_record.data[client._id] = [];
		}

		this._location_training_record.data[client._id].push(data);

		this.emit('training_data', client._id, data);
	}

	// Save the document
	this.throttleSave();

	// Try getting a classifier
	this.getPositionClassifier(function gotClassifier(err, classifier) {

		var location;

		log.once(advert.address, 'Got classifier?', err, classifier, advert)

		if (err || !classifier || !classifier.instance || !classifier.instance.enabled) {
			return;
		}

		if (!classifier._t) {
			classifier._t = 0;
		}

		classifier._t++;

		location = classifier.addLocatorData(client._id, advert.rssi, new Date());

		if (!location) {
			return;
		}

		// Do something with the location!

	});
});

/**
 * Calculate distance
 * @TODO: certain numbers need to be calibrated per device
 *
 * @author   David Young
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {Number}   rssi
 * @param    {Number}   tx_power
 *
 * @return   {Number}
 */
Beacon.setDocumentMethod(function calculateDistance(rssi, tx_power) {

	var distance,
	    ratio;

	if (rssi == 0) {
		return -1;
	}

	// Fitbit reports tx_power to be "-6", which is wrong
	if (tx_power == null || tx_power > -50) {
		// Hard coded power value. Usually ranges between -59 to -65
		tx_power = -65;
	}

	ratio = rssi / tx_power;

	if (ratio < 1) {
		distance = Math.pow(ratio, 10);
	} else {
		distance = 0.89976 * Math.pow(ratio, 7.7095) + 0.111;
	}

	return distance;
});
