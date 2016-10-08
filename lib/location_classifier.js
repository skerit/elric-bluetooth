var synaptic  = alchemy.use('synaptic'),
    forkify   = alchemy.use('forkify'),
    Neuron    = synaptic.Neuron,
    Layer     = synaptic.Layer,
    Network   = synaptic.Network,
    Trainer   = synaptic.Trainer,
    Architect = synaptic.Architect,
    fs = require('fs');

/**
 * Beacon Location Classifier:
 * Map input data to a specific location
 *
 * @constructor
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
var Classifier = Function.inherits('Informer', 'Elric', function LocationClassifier() {

	// Sorted locator ids
	this.locator_ids = [];

	// Locator information
	this.locators = {};

	// Sorted location ids
	this.location_ids = [];

	// Location information
	this.locations = {};

	// Location results
	this.location_results = {};
	this.location_result_array = [];

	// Each locator gets its own input scale
	this.input_scales = {};

	// Ordered train data
	this.location_data = {};

	// Normalized train data, meant for synaptic
	this.training_samples = [];

	// All rssi data for training purposes
	this.all_rssi = [];
});

/**
 * Default training options
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @type    {Object}
 */
Classifier.setProperty('default_training_options', {
	rate       : 0.2,
	iterations : 20,
	shuffle    : true
});

/**
 * unDry an object
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.4
 * @version  0.1.11
 *
 * @return   {Object}
 */
Classifier.setStatic(function unDry(obj) {

	var result,
	    key;

	result = new Classifier();

	for (key in obj) {
		result[key] = obj[key];
	}

	result.network = Network.fromJSON(result.network);

	return result;
});

/**
 * A classifier is enabled if it has certain elements
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @return   {Object}
 */
Classifier.setProperty(function enabled() {
	return this.location_ids.length && this.locator_ids.length;
});

/**
 * Return an object that can be used for JSON representation
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @return   {Object}
 */
Classifier.setMethod(function toJSON() {
	return {
		locator_ids       : this.locator_ids,
		locators          : this.locators,
		location_ids      : this.location_ids,
		locations         : this.locations,
		input_scales      : this.input_scales,
		network           : this.network.toJSON()
	};
});

/**
 * Return an object for json-drying this object.
 * Train data is removed
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @return   {Object}
 */
Classifier.setMethod(function toDry() {
	return {
		value: this.toJSON(),
		path: '__Protoblast.Classes.LocationClassifier'
	};
});

/**
 * Add data
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 */
Classifier.setMethod(function addLocatorData(locator_id, rssi, data) {

	var input,
	    output,
	    winner;
return
	if (!this._position_data) {
		this._position_data = new Classes.Elric.PositionData(this);
	}

	// Set the data
	this._position_data.setData(locator_id, rssi, data);

	// Try getting input
	input = this._position_data.getNormalizedInput();

	if (!input) {
		return;
	}

	output = this.activate(input);
	winner = this.processOutput(output);

	return winner;
});

/**
 * Query the database for locators
 * (Clients with enabled bluetooth capabilities)
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {Function}   callback
 */
Classifier.setMethod(function queryLocators(callback) {

	var that = this,
	    ClientCapability = Model.get('ClientCapability'),
	    location_elements,
	    client_elements,
	    client_ids,
	    Room = Model.get('Room');

	Function.parallel(function getClientIds(next) {

		var options = {
			fields: ['client_id'],
			conditions: {
				name    : 'bluetooth',
				enabled : true
			}
		};

		ClientCapability.find('list', options, function gotClients(err, records) {

			if (err) {
				return next(err);
			}

			client_ids = records.map(String);
			next();
		});
	}, function getRoomElements(next) {

		var room_elements,
		    element,
		    options,
		    i,
		    j;

		options = {
			fields: ['elements'],
			conditions: {
				'elements.element_type': 'client'
			}
		};

		client_elements = {};

		Room.find('list', options, function gotElements(err, records) {

			if (err) {
				return next(err);
			}

			for (i = 0; i < records.length; i++) {
				room_elements = records[i];

				for (j = 0; j < room_elements.length; j++) {
					element = room_elements[j];

					if (element.element_type == 'client') {
						client_elements[element.type_external_id] = element;
					}
				}
			}

			next();
		});
	}, function done(err) {

		var locator,
		    element,
		    result = {},
		    id;

		if (err) {
			return callback(err);
		}

		// Return only the clients with an element type
		// and bluetooth enabled
		for (id in client_elements) {
			if (~client_ids.indexOf(id)) {
				element = client_elements[id];

				// Return the element as a locator
				locator = {
					name : element.name,
					id   : element.type_external_id,
					x    : element.x,
					y    : element.y,
					z    : 0,
				};

				result[id] = locator;
			}
		}

		return callback(null, result);
	});
});

/**
 * Query the database for locations
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {Function}   callback
 */
Classifier.setMethod(function queryLocations(callback) {

	var that = this,
	    Room = Model.get('Room'),
	    room_elements,
	    element,
	    options,
	    i,
	    j;

	options = {
		fields: ['elements'],
		conditions: {
			'elements.element_type': 'location'
		}
	};

	Room.find('list', options, function gotElements(err, records) {

		var location_id;

		if (err) {
			return next(err);
		}

		for (i = 0; i < records.length; i++) {
			room_elements = records[i];

			for (j = 0; j < room_elements.length; j++) {
				element = room_elements[j];

				if (element.element_type == 'location') {
					that.locations[element._id] = element;

					location_id = String(element._id);

					if (that.location_ids.indexOf(location_id) == -1) {
						that.location_ids.push(location_id);
					}
				}
			}
		}

		// Sort the locations
		that.location_ids.sort();

		callback(null);
	});
});

/**
 * Prepare this classifier:
 * get locators, locations and train data
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {ObjectID}   beacon_id
 * @param    {Function}   callback
 */
Classifier.setMethod(function prepare(beacon_id, callback) {

	var that = this,
	    locators;

	if (typeof beacon_id == 'function') {
		callback = beacon_id;
		beacon_id = null;
	}

	Function.series(function getLocators(next) {
		that.queryLocators(function gotLocators(err, result) {

			var key;

			if (err) {
				return next(err);
			}

			console.log('Adding locators', result)

			locators = result;

			for (key in locators) {
				that.addLocator(key, locators[key]);
			}

			next();
		});
	}, function getLocations(next) {
		that.queryLocations(next);
	}, function getTrainData(next) {
		that.queryTrainData(beacon_id, next);
	}, function done(err) {

		if (err) {
			return callback(err);
		}

		that.min_rssi = Math.min.apply(Math, that.all_rssi);
		that.max_rssi = Math.max.apply(Math, that.all_rssi);

		callback(null);
	});
});

/**
 * Add a locator
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {String}   id
 * @param    {Object}   data
 */
Classifier.setMethod(function addLocator(id, data) {

	var locator;

	// Add the id if it isn't in the array yet
	if (this.locator_ids.indexOf(id) == -1) {
		this.locator_ids.push(id);

		// Sort alphabetically
		this.locator_ids.sort();
	}

	this.locators[id] = data;
});

/**
 * Create the network
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 */
Classifier.setMethod(function createNetwork() {

	var location_count = this.location_ids.length,
	    locator_count = this.locator_ids.length,
	    hidden_count = (location_count * 2) + (locator_count * 2),
	    input_count = locator_count * 2,
	    trainer,
	    network,
	    id;

	// Ignore if already created
	if (this.network) {
		return;
	}

	console.log('Creating network with', input_count, 'inputs,', hidden_count, 'hidden nodes and' , location_count, 'outputs');

	this.network = new Architect.LSTM(input_count, hidden_count, location_count);
});

/**
 * Query the database for training data
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {ObjectID}   beacon_id
 * @param    {Function}   callback
 */
Classifier.setMethod(function queryTrainData(beacon_id, callback) {

	var that = this,
	    options;

	if (typeof beacon_id == 'function') {
		callback = beacon_id;
		beacon_id = null;
	}

	options = {
		recursive: 0,
		document: false
	};

	// If a beacon_id is given, only fetch those training samples
	if (beacon_id) {
		options.conditions = {
			beacon_id : beacon_id
		};
	}

	Model.get('LocationTrain').find('all', options, function gotAll(err, records) {

		var i;

		if (err) {
			return callback(err);
		}

		for (i = 0; i < records.length; i++) {
			that.addTrainData(records[i].LocationTrain);
		}

		callback();
	});
});

/**
 * Add train data for a specific coordinate
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {Object}   record
 *
 * @return   {Object}
 */
Classifier.setMethod(function addTrainData(record) {

	var that = this,
	    prev_sample,
	    location_id,
	    locator,
	    counter,
	    samples,
	    sample,
	    ldata,
	    name,
	    cset,
	    id,
	    i;

	if (record.name) {
		name = record.name;
	} else {
		name = record.x + '-' + record.y + '-' + record.z;
	}

	location_id = String(record.location_id);

	// Creates an array if the location doesn't exist yet.
	// Multiple records of the same location will get added together
	if (!this.location_data[location_id]) {
		this.location_data[location_id] = [];
	}

	ldata = this.location_data[location_id];

	// Iterate over all the locator sample arrays
	for (id in record.data) {
		samples = record.data[id];
		locator = this.locators[id];

		if (!locator) {
			log.error('Could not find locator ' + id + '. Skipping training data.');
			continue;
		}

		// Sort them by date
		samples.sortByPath(1, 'seen');
		prev_sample = null;
		counter = 0;

		// Filter them
		for (i = 0; i < samples.length; i++) {
			sample = samples[i];

			if (prev_sample) {
				// Skip echoes
				if ((sample.seen - prev_sample.seen) < 100) {
					continue;
				}
			}

			counter++;

			// Get the absolute value of the RSSI
			sample.abs = Math.abs(sample.rssi);
			sample.mdist = calculateDistance(sample.rssi);

			sample.name = record.name;
			sample.locator_id = id;
			sample.location_id = location_id;

			// Decide which value to use for input
			// For now, we'll go with the absolute rssi value
			sample.input = sample.abs;

			// Actually store the sample in the array
			ldata.push(sample);

			prev_sample = sample;
		}
	}

	// And now order all the combined samples
	ldata.sortByPath(1, 'seen');

	return ldata;
});

/**
 * Generate input train data
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 */
Classifier.setMethod(function normalizeTrainData() {

	var location_count = this.location_ids.length,
	    location_id,
	    normalized,
	    input_vals,
	    locator,
	    sample,
	    record,
	    output,
	    pdata,
	    input,
	    name,
	    obj,
	    id,
	    i;

	if (this._normalized) return;
	this._normalized = true;

	// Set the rssi scales, remove outliers
	for (id in this.locators) {
		locator = this.locators[id];

		input_vals = [];

		for (location_id in this.location_data) {
			samples = this.location_data[location_id];

			for (i = 0; i < samples.length; i++) {
				sample = samples[i];

				if (sample.locator_id != id) {
					continue;
				}

				// Save this input value
				input_vals.push(sample.input);
			}
		}

		// Calculate the input scale
		this.input_scales[id] = Number.calculateNormalizeFactors(input_vals, [0, 1]);

		// Remove duplicate values
		//input_vals = input_vals.unique();

		// Rssi values per network? Not needed, I think
		input_vals.sort(function(a,b){return a-b});
		console.log('Network rssi:', id, input_vals, Math.min.apply(Math, input_vals), Math.max.apply(Math, input_vals));

		input_vals = Math.removeOutliers(input_vals);
		console.log('(No outliers) Network rssi:', id, input_vals, Math.min.apply(Math, input_vals), Math.max.apply(Math, input_vals));
	}

	console.log('Got input scales:', this.input_scales)

	// Actually normalize the samples per location
	for (location_id in this.location_data) {
		samples = this.location_data[location_id];

		name = this.locations[location_id].name;

		// Create a pdata instance
		pdata = new Classes.Elric.PositionData(this);

		// Create the correct output
		output = new Array(location_count);
		output.fill(0);

		// Set this location's spot in the output array to 1
		output[this.location_ids.indexOf(location_id)] = 1;

		// Now iterate over the sorted data again
		for (i = 0; i < samples.length; i++) {
			sample = samples[i];

			input = pdata.setTrainData(sample.locator_id, sample.input, sample.seen);

			// Skip invalid input
			if (!input) {
				continue;
			}

			obj = {
				lid    : sample.locator_id,
				name   : name,
				rssi   : sample.rssi,
				mdist  : sample.mdist,
				lpdist : pdata.last_lp_val,
				cycle  : pdata.cycle,
				input  : input,
				output : output
			};

			this.training_samples.push(obj);
		}
	}

	return this.training_samples;
});

/**
 * Start training
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {Function}   callback   If a callback is given, threads are used
 */
Classifier.setMethod(function startTraining(options, callback) {

	var that = this,
	    train_result,
	    training,
	    network,
	    samples,
	    start,
	    id;

	if (typeof options == 'function') {
		callback = options;
		options = null;
	}

	// Make sure the network exists
	this.createNetwork();

	// Normalize the training samples
	this.normalizeTrainData();

	// Generate options
	options = Object.assign({}, this.default_training_options, options);

	// Set samples and network
	options.samples = this.training_samples;
	options.network = this.network.toJSON();

	// Forkify require fix
	options.dirname = __dirname;

	// Set start time
	start = Date.now();

	require('fs').writeFile('/tmp/test_network.json', JSON.stringify(options, null, 2));

	// Start training
	training = forkTraining(options, function doneTraining(err, result) {

		if (err) {
			return callback(err);
		}

		console.log('Network trained in', ~~((Date.now() - start) / (1000 * 60)), 'minutes, report:', result.report, result.reports);

		// Revive the serialized network
		that.network = Network.fromJSON(result.network);

		// Remove the reference
		that.current_trainer = null;

		callback();
	});

	training.on('report', function onReport(report) {
		console.log('Iteration', report.iterations, 'of', options.samples.length , ' samples, report: (' + report.rate + ')', report.error, report);
	});

	this.current_trainer = training;

	return training;
});

/**
 * Activate the networks
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 */
Classifier.setMethod(function activate(normalized_input) {

	var result = [],
	    location,
	    output,
	    winner,
	    max = 0,
	    val,
	    id,
	    i;

	output = this.network.activate(normalized_input);

	for (i = 0; i < this.location_ids.length; i++) {
		id = this.location_ids[i];
		location = this.locations[id];
		val = output[i];

		if (val > max) {
			max = val;
			winner = location.name;
		}

		val = Math.round(val * 10000) / 100;

		// Push the result onto the array
		result.push({name: location.name, id: id, value: val})
	}

	// Sort the array by descending value
	result.sortByPath(-1, 'value');

	return result;
});

/**
 * Proces network output
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {Array}
 */
Classifier.setMethod(function processOutput(output) {

	var location,
	    winner,
	    second,
	    result,
	    values,
	    value,
	    max,
	    min,
	    mod,
	    obj,
	    i;

	result = [];

	// Iterate over the location probabilities
	for (i = 0; i < output.length; i++) {
		location = output[i];

		// Make sure the location entries exist
		if (!this.location_results[location.id]) {
			this.location_results[location.id] = {
				nvalues : [],
				values  : [],
				value   : 0,
				count   : 0,
				name    : location.name,
				id      : location.id
			};

			this.location_result_array.push(this.location_results[location.id]);
		}

		// Get the counting object for this location
		obj = this.location_results[location.id];

		// Add the current value
		obj.nvalues.push(location.value);

		// Remove old samples
		if (obj.nvalues.length > 5) {
			obj.nvalues.shift();
			obj.values.shift();
		}

		// Apply a lowpass filter over the network values
		value = Math.lowpass(obj.nvalues).last();

		// If there was a previous winner, give that location a bias
		if (this.current_location) {

			// See if this is the previous winner
			if (this.current_location.id == location.id) {

				// Get the highest value, be it this or the previous one
				max = Math.max(value, this.current_location.value);

				// Calculate a modifier, an extra to add to the mean
				mod = max * (1 + (Math.min(10, obj.count)/100));

				// Calculate the new value, take the previous value and the count into consideration
				value = Math.mean(value, this.current_location.value, mod);
			} else {
				// Previous losers get a punishment
				min = Math.min(value, location.value);

				// Calculate the mean
				value = Math.mean(value, min);
			}
		}

		obj.values.push(value);

		// Store the current calculated value
		obj.value = value;
	}

	// Sort the result array
	this.location_result_array.sortByPath(-1, 'value');

	// Get the winner
	winner = this.location_result_array[0];

	// Get the runner up
	second = this.location_result_array[1];

	// Increase the winner count
	winner.count++;

	// Set the loser count to zero
	for (i = 1; i < this.location_result_array.length; i++) {
		this.location_result_array[i].count = 0;
	}

	// Store the current winner
	this.current_location = winner;

	log.less('Location output', 'First "' + winner.name + '" with ' + winner.value.toFixed(1) + ', second "' + second.name + '" with ' + second.value.toFixed(1), JSON.clone(this.location_result_array));

	return winner;
});

/**
 * Forked training
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 */
var forkTraining = forkify(function forkTraining(data, callback) {

	var that = this,
	    iterations,
	    schedule,
	    synaptic  = require(data.dirname + '/../node_modules/synaptic'),
	    do_stop,
	    Network   = synaptic.Network,
	    Trainer   = synaptic.Trainer,
	    reports   = [],
	    trainer,
	    network,
	    report,
	    costFnc;

	// Listen for stop requests
	this.on('stop_request', function onStopRequest() {
		do_stop = true;
	});

	// Get the wanted iterations
	iterations = data.iterations || 20;

	// Calculate schedule based on that
	// We want about 60 error logs every time
	// If there are less than 60 iterations,
	// log every one of them
	schedule = Math.round(iterations / Math.min(iterations, 60));

	costFnc = Trainer.cost.MSE;

	// Arctan: Punish larger errors more
	costFnc = function Arctan(target, output) {

		var err = 0,
		    i;

		for (i = 0; i < output.length; i++) {
			err += Math.pow(Math.atan(target[i] - output[i]), 2);
		}

		return err / output.length;
	};

	// Root Arctan
	costFnc = function Rarctan(target, output) {

		var err = 0,
		    i;

		for (i = 0; i < output.length; i++) {
			err += Math.pow(Math.atan(target[i] - output[i]), 2);
		}

		return Math.sqrt(err / output.length);
	};

	costFnc = Trainer.cost.CROSS_ENTROPY;

	// Revive the network
	network = Network.fromJSON(data.network);

	// Create the trainer
	trainer = new Trainer(network, {

		// Learning rate (smaller is slower, but helps when error won't decrease)
		rate: data.rate || .3,

		// Number of iterations
		iterations: data.iterations || 20,

		// If this error rate is achieved, stop training
		error: data.error || .00001,

		cost: costFnc
	});

	report = trainer.train(data.samples, {

		// Shuffle samples at every iteration (to prevent the network to recognize patterns?)
		shuffle: data.shuffle == null ? true : data.shuffle,

		schedule: {
			every: schedule,
			do: function(report_data) {

				// Send report to parent process
				that.emit('report', report_data);

				// Store in the reports array
				reports.push(report_data);

				if (do_stop) {
					return true;
				}
			}
		}
	});

	callback(null, {network: network.toJSON(), report: report, reports: reports});
});


function calculateDistance(rssi, tx_power) {

	var distance,
	    ratio;

	if (rssi == 0) {
		return 0;
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
}