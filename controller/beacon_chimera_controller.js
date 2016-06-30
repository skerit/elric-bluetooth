/**
 * The Floorplan Chimera Controller class
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
var Beacon = Function.inherits('ChimeraController', function BeaconChimeraController(conduit, options) {
	BeaconChimeraController.super.call(this, conduit, options);
});

/**
 * Show all devices
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Conduit}   conduit
 */
Beacon.setMethod(function index(conduit) {

	var that = this,
	    options;

	this.set('pagetitle', 'Beacons');

	options = {
		sort: {last_seen: -1}
	};

	this.getModel('Beacon').find('all', options, function gotBeacons(err, records) {

		that.set('records', records);
		that.render('beacon/chimera_index');
	});
});

/**
 * Train a beacon
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Conduit}   conduit
 */
Beacon.setMethod(function train(conduit) {

	var that = this;

	this.set('pagetitle', 'Train beacon');

	Function.parallel(function getRooms(next) {

		var options = {
			fields: ['_id', 'name', 'elements', 'width', 'height', 'x', 'y', 'z']
		};

		that.getModel('Room').find('list', options, function gotRooms(err, rooms) {

			if (err) {
				return next(err);
			}

			that.set('rooms', rooms);
			next();
		});
	}, function getElementTypes(next) {

		var element_types = {},
		    shared = alchemy.shared('elric.element_type'),
		    entry,
		    key;

		for (key in shared) {
			entry = new shared[key];
			element_types[entry.type_name] = entry;
		}

		that.set('element_types', element_types);

		next();

	}, function getBeacon(next) {

		that.getModel('Beacon').find('first', function gotBeacon(err, beacon) {

			if (err) {
				return next(err);
			}

			if (!beacon.length) {
				return next(new Error('Not found'));
			}

			that.set('record', beacon);
			next();
		});
	}, function done(err) {

		if (err) {
			return conduit.error(err);
		}

		that.render('beacon/train');
	});
});

/**
 * Start training a beacon
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param   {Conduit}   conduit
 */
Beacon.setMethod(function trainLink(conduit, linkup, data) {

	var that = this,
	    stopped,
	    record;

	if (!data.beacon_id) {
		return conduit.error('No beacon id found');
	}

	this.getModel('Beacon').getById(data.beacon_id, function gotBeacon(err, result) {

		if (err) {
			console.error('Cannot train beacon:', err);
			return conduit.error(err);
		}

		record = result;

		// If we've already been stopped during finding,
		// do nothing
		if (stopped) {
			return;
		}

		record.on('training_data', function gotTrainingData(client_id, data) {
			linkup.submit('training_data', {client_id: client_id, data: data});
		});

		record.startTraining(data);
	});

	linkup.on('stop', function gotStop() {
		stopped = true;

		if (record) {
			record.stopTraining();
		}
	});
});

/**
 * Add a new element to a room
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Conduit}   conduit
 */
Beacon.setMethod(function addRoomElement(conduit) {

	var room_id = conduit.param('room'),
	    element_type = conduit.param('element'),
	    options;

	if (!room_id) {
		return conduit.error('Invalid room id given');
	}

	this.getModel('Room').findById(room_id, {fields: ['elements']}, function gotResponse(err, result) {

		var new_element;

		if (err) {
			return conduit.error(err);
		}

		if (!result.length) {
			return conduit.error(new Error('Could not find room'));
		}

		new_element = {
			_id: alchemy.ObjectId(),
			element_type: element_type
		};

		result.elements.push(new_element);

		result.save(function savedRecord(err, data) {

			if (err) {
				return conduit.error(err);
			}

			conduit.end(new_element);
		});
	});
});

/**
 * Add a new element to a room
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Conduit}   conduit
 */
Beacon.setMethod(function saveElement(conduit, data) {

	console.log('Save element+?', data);

	if (!data || !data._id) {
		return conduit.error('No element data given');
	}

	console.log('Should save:', data);

	this.getModel('Room').findById(data.room_id, {fields: ['elements']}, function gotResponse(err, result) {

		var element,
		    i;

		if (err) {
			return conduit.error(err);
		}

		if (!result.length) {
			return conduit.error('Room not found');
		}

		console.log('Result:', result);

		for (i = 0; i < result.elements.length; i++) {
			if (String(result.elements[i]._id) == data._id) {
				element = result.elements[i];
				break;
			}
		}

		if (!element) {
			return conduit.error('Could not find element in room');
		}

		// Inject the new data into the element
		Object.assign(element, data);

		result.save(function saved(err) {

			if (err) {
				return conduit.error(err);
			}
		});
	});
});

/**
 * Get external ids for specific types
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Conduit}   conduit
 */
Beacon.setMethod(function getTypeExternalIds(conduit, data, callback) {

	var that = this,
	    class_name = data.element_type.classify() + 'ElementType',
	    constructor,
	    instance;

	constructor = alchemy.classes.Elric[class_name];

	if (!constructor) {
		return callback(new Error('Not found: "' + class_name + '"'));
	}

	instance = new constructor();

	if (!instance.getExternalIds) {
		return callback(null);
	}

	instance.getExternalIds(function gotExternalIds(err, result) {

		if (err) {
			return callback(err);
		}

		console.log('Responding with', err, result);

		callback(null, result);
	});
});

// Add the dashboard to the menu deck
alchemy.plugins.chimera.menu.set('beacons', {
	title: 'Beacons',
	route: 'chimera@ActionLink',
	parameters: {
		controller: 'Beacon',
		action: 'index'
	},
	icon: {svg: 'compass'}
});