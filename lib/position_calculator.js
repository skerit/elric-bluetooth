var synaptic  = alchemy.use('synaptic'),
    forkify   = alchemy.use('forkify'),
    Neuron    = synaptic.Neuron,
    Layer     = synaptic.Layer,
    Network   = synaptic.Network,
    Trainer   = synaptic.Trainer,
    Architect = synaptic.Architect,
    fs = require('fs');

/**
 * Beacon Position Calculator:
 * Each (type of) beacon has its own calculator
 *
 * @constructor
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
var Position = Function.inherits('Informer', 'Elric', function PositionCalculator() {

	// The advertisements it sends out per second
	this.aps = 0;

	// Sorted locator ids
	this.locator_ids = [];

	// Locator information
	this.locators = {};

	// Locator neural networks
	this.networks = {};

	// Each locator gets its own input scale
	this.input_scales = {};

	// But there is only 1 output scale
	this.output_scale = null;

	// Ordered train data
	this.location_data = {};

	// Normalized train data, meant for synaptic
	this.location_input = {};

	// All rssi data for training purposes
	this.all_rssi = [];

	// All normalizer values
	this._distance_values = [];
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
Position.setStatic(function unDry(obj) {

	var result = new Position(),
	    key;

	for (key in obj) {
		result[key] = obj[key];
	}

	for (key in result.networks) {
		result.networks[key] = Network.fromJSON(result.networks[key]);

		// Make sure the trainer is removed
		delete result.networks[key]._trainer;
	}

	// Add trainers to networks
	result.createTrainers();

	return result;
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
Position.setMethod('toDry', function toDry() {

	var locators = {},
	    networks = {},
	    locator,
	    network,
	    id;

	// Prepare the locators for export
	for (id in this.locators) {
		locator = Object.assign({}, this.locators[id]);

		// Remove the train samples
		locator.train_samples = null;
		locators[id] = locator;
	}

	// Prepare the networks for export
	for (id in this.networks) {
		network = this.networks[id].toJSON();
		delete network._trainer;

		networks[id] = network;
	}

	return {
		value: {
			locator_ids       : this.locator_ids,
			locators          : locators,
			distance_scale    : this.distance_scale,
			input_scales      : this.input_scales,
			networks          : networks
		},
		path: '__Protoblast.Classes.PositionCalculator'
	};
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
Position.setMethod(function queryLocators(callback) {

	var ClientCapability = Model.get('ClientCapability'),
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
 * Prepare this calculator
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {Function}   callback
 */
Position.setMethod(function prepare(callback) {

	var that = this,
	    locators;

	Function.series(function getLocators(next) {
		that.queryLocators(function gotLocators(err, result) {

			var key;

			if (err) {
				return next(err);
			}

			locators = result;

			for (key in locators) {
				that.addLocator(key, locators[key]);
			}

			next();
		});
	}, function getTrainData(next) {
		that.queryTrainData(next);
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
Position.setMethod(function addLocator(id, data) {

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
 * Load a network from JSON
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {Object}   data
 */
Position.setMethod(function loadNetwork(data) {
	this._network = Network.fromJSON(data);
});

/**
 * Create the networks,
 * one per locator
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 */
Position.setMethod(function createNetworks() {

	var locator_count = this.locator_ids.length,
	    hidden_count = locator_count * 6,
	    input_count = locator_count * 2,
	    trainer,
	    network,
	    id;

	for (id in this.locators) {
		// Create a new Long-Short-Term-Memory neural network
		network = new Architect.LSTM(input_count, hidden_count, 1);
		//network = new Architect.Perceptron(input_count, hidden_count, 1);

		this.networks[id] = network;
	}

	// Add trainers
	this.createTrainers();
});

/**
 * Create network trainers
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 */
Position.setMethod(function createTrainers() {

	var network,
	    id;

	for (id in this.networks) {
		network = this.networks[id];

		if (network._trainer) {
			continue;
		}

		network._trainer = new Trainer(network, {
			rate: .1,
			iterations: 100,
			error: .1,
			shuffle: false,
			log: 50,
			cost: Trainer.cost.CROSS_ENTROPY
		});
	}
});

/**
 * Query the database for training data
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {Function}   callback
 */
Position.setMethod(function queryTrainData(callback) {

	var that = this,
	    options;

	options = {
		recursive: 0,
		document: false
	};

	Model.get('BeaconTrain').find('all', options, function gotAll(err, records) {

		var i;

		if (err) {
			return callback(err);
		}

		for (i = 0; i < records.length; i++) {
			that.addTrainData(records[i].BeaconTrain);
		}

		callback();
	});
});

/**
 * Calculate distance between 2 points
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 */
Position.setMethod(function getDistance(sx, sy, dx, dy) {

	var x = Math.pow(dx - sx, 2),
	    y = Math.pow(dy - sy, 2);

	return Math.sqrt(x + y);
});

/**
 * Add train data for a specific coordinate
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {Object}   record
 */
Position.setMethod(function addTrainData(record) {

	var that = this,
	    prev_sample,
	    locator,
	    counter,
	    samples,
	    sample,
	    ldata,
	    name,
	    cset,
	    id,
	    i;

	console.log('Adding train data for', record.name, ''+record._id);

	if (record.name) {
		name = record.name;
	} else {
		name = record.x + '-' + record.y + '-' + record.z;
	}

	this.location_input[name] = [];
	this.location_data[name] = ldata = [];

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
				// Beacons emitting advertisements more than once
				// per 300ms will have some samples dropped
				if ((sample.seen - prev_sample.seen) < 300) {
					continue;
				}
			}

			// Only use 50 samples
			// @TODO: take the lowest amount of sample size
			if (counter > 50) {
				break;
			}

			counter++;

			// Get the absolute value of the RSSI
			sample.abs = Math.abs(sample.rssi);
			sample.mdist = calculateDistance(sample.rssi);

			// Calculate the distance between the locator and beacon
			sample.real_distance = this.getDistance(record.x, record.y, locator.x, locator.y);

			sample.name = record.name;
			sample.locator_id = id;

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
});

/**
 * Generate input train data
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 */
Position.setMethod(function normalizeTrainData() {

	var normalized,
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

	// Normalize the output data
	this.distance_scale = Number.calculateNormalizeFactors([0, 520], [0, 1]);

	// Remove outliers and apply a lowpass filter
	//this.rssi_filtered = Math.lowpass(Math.removeOutliers(this.all_rssi, true), 0.25);
	//this.rssi_scale = Number.calculateNormalizeFactors(this.rssi_filtered, [0, 1]);

	// Calculate the distance between the samples and the locators
	for (id in this.locators) {
		locator = this.locators[id];
		locator._mapped_distances = {};

		input_vals = [];

		for (name in this.location_data) {
			samples = this.location_data[name];

			for (i = 0; i < samples.length; i++) {
				sample = samples[i];

				if (sample.locator_id != id) {
					continue;
				}

				// Save this input value
				input_vals.push(sample.input);

				if (locator._mapped_distances[sample.name] != null) {
					continue;
				}

				normalized = Number.normalize([sample.real_distance], this.distance_scale)[0];
				locator._mapped_distances[sample.name] = normalized;
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

	for (name in this.location_data) {
		samples = this.location_data[name];

		// Create a pdata instance
		pdata = new Classes.Elric.PositionData(this);

		console.log('Normalizing', name, ':', samples.length, pdata);

		// Now iterate over the sorted data again
		for (i = 0; i < samples.length; i++) {
			sample = samples[i];

			input = pdata.setTrainData(sample.locator_id, sample.input, sample.seen);

			// Skip invalid input
			if (!input) {
				continue;
			}

			for (id in this.locators) {
				locator = this.locators[id];

				if (!locator.train_samples) {
					locator.train_samples = [];
				}

				obj = {
					lid    : sample.locator_id,
					name   : name,
					rssi   : sample.rssi,
					mdist  : sample.mdist,
					lpdist : pdata.last_lp_val,
					cycle  : pdata.cycle,
					input  : input,
					output : [locator._mapped_distances[name]]
				};

				this.location_input[name].push(obj)
				locator.train_samples.push(obj);
			}
		}
	}

	// for (id in this.locators) {
	// 	console.log('Locator', this.locators[id].name, 'has', this.locators[id].train_samples.length, 'samples');
	// 	console.log('Samples example:', this.locators[id].train_samples.slice(1500, 1520));
	// }
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
Position.setMethod(function startTraining(callback) {

	var train_result,
	    network,
	    samples,
	    id;

	this.createNetworks();

	// Normalize the train data
	this.normalizeTrainData();

	if (callback) {
		return this._doForkedTraining(callback);
	}

	console.log('Iterating over the networks');

	for (id in this.networks) {
		network = this.networks[id];
		samples = this.locators[id].train_samples;

		train_result = network._trainer.train(samples);

		console.log('Finished training', id, ':', train_result);
		fs.writeFileSync(PATH_TEMP + '/lposcalc1_' + Date.now() + '.dry.json', JSON.dry(this, null, 2));
	}
});

/**
 * Do forked training
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {Function}   callback
 */
Position.setMethod(function _doForkedTraining(callback) {

	var that = this,
	    tasks = [];

	Object.each(this.networks, function eachNetwork(network, id) {
		tasks.push(function doTraining(next) {

			var options,
			    start = Date.now();

			options = {
				network    : network.toJSON(),
				rate       : 0.3,
				iterations : 300 * 1, // 300 = 26m
				shuffle    : true,
				samples    : that.locators[id].train_samples
			};

			shuffle(options.samples);
			console.log('Network', id, 'will train with', options.samples.length, options.samples.slice(20, 40), 'for', options.iterations, 'iterations');

			forkTraining(options, function doneTraining(err, result) {

				if (err) {
					return next(err);
				}

				console.log('Network', id, 'trained in', ~~((Date.now() - start) / (1000 * 60)), 'minutes, report:', result.report, result.reports);

				// Revive the serialized network
				that.networks[id] = Network.fromJSON(result.network);

				next();
			});
		});
	});

	Function.parallel(tasks, callback);
});

/**
 * Activate the networks
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 */
Position.setMethod(function activate(normalized_input) {

	var result = {},
	    id,
	    i;

	// Iterate over the locator ids so we can add the results in order
	for (i = 0; i < this.locator_ids.length; i++) {
		id = this.locator_ids[i];
		result[id] = Number.denormalize(this.networks[id].activate(normalized_input), this.distance_scale)[0];
	}

	return result;
});

// Set forkify instances limit to 4
forkify.limit = 4;
forkify.max_running = 1;

/**
 * Forked training
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 */
var forkTraining = forkify(function forkTraining(data, callback) {

	var iterations,
	    schedule,
	    synaptic  = require('synaptic'),
	    Network   = synaptic.Network,
	    Trainer   = synaptic.Trainer,
	    reports   = [],
	    trainer,
	    network,
	    report,
	    costFnc;

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
			do: function(data) {
				reports.push(data);
			}
		}
	});

	callback(null, {network: network.toJSON(), report: report, reports: reports});
});

function shuffle(array) {

	var counter,
	    index,
	    temp;

	counter = array.length;

	// While there are elements in the array
	while (counter > 0) {
		// Pick a random index
		index = Math.floor(Math.random() * counter);

		// Decrease counter by 1
		counter--;

		// And swap the last element with it
		temp = array[counter];
		array[counter] = array[index];
		array[index] = temp;
	}

	return array;
}

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