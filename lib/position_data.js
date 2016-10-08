var synaptic  = alchemy.use('synaptic'),
    Neuron    = synaptic.Neuron,
    Layer     = synaptic.Layer,
    Network   = synaptic.Network,
    Trainer   = synaptic.Trainer,
    Architect = synaptic.Architect;

/**
 * Position Calculator Data
 *
 * @constructor
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
var PData = Function.inherits('Informer', 'Elric', function PositionData(position_calculator) {

	// Parent calculator
	this.position_calculator = position_calculator;

	// Current values
	this.values = {};

	// The second we're in
	this._second = null;

	// The normalized train data
	this._train_data = [];

	// Keep track of locators seen
	this._seen_locators = [];

	// Lowpas filters per locator
	this.lowpass_filters = {};

	// Sample count per cycle
	this.sample_counts = {};

	// Keep track of cycle
	this.cycle = 1;
});

/**
 * Add data for a specific coordinate
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {String}   locator_id
 * @param    {Number}   value
 * @param    {Date}     date
 */
PData.setMethod(function setData(locator_id, value, date) {

	var gap = 1,
	    prev = this.values[locator_id],
	    lp_val,
	    strength,
	    i,
	    id;

	locator_id = String(locator_id);

	// If this id has been seen before, a new cycle starts
	if (this._seen_locators.indexOf(locator_id) > -1) {
		this.cycle++;

		// Add locator sample counts
		for (i = 0; i < this.position_calculator.locator_ids.length; i++) {
			id = this.position_calculator.locator_ids[i];

			if (this.sample_counts[id] == null) {
				this.sample_counts[id] = [];
			}

			if (this._seen_locators.indexOf(id) > -1) {
				this.sample_counts[id].push(1);
			} else {
				this.sample_counts[id].push(0);
			}

			// Remove a sample count when there are more then 10 elements
			if (this.sample_counts[id].length > 10) {
				this.sample_counts[id].shift();
			}
		}

		this._seen_locators.length = 0;
	}

	if (!this.lowpass_filters[locator_id]) {
		this.lowpass_filters[locator_id] = [];
	}

	// Add this value to the lowpass filters array
	this.lowpass_filters[locator_id].push(value);

	// If there are too many values, remove one
	if (this.lowpass_filters[locator_id].length > 5) {
		this.lowpass_filters[locator_id].shift();
	}

	// Calculate the value
	lp_val = Math.lowpass(this.lowpass_filters[locator_id], 0.5).last();

	// Store this lowpassed value, just for debugging sake
	this.last_lp_val = lp_val;

	this._seen_locators.push(locator_id);

	if (prev) {

		// Calculate how long it has been since a value was seen
		// for the current locator
		gap = (date - prev.date) / 1000;

		// Gap should never be higher than 1
		if (gap > 1) {
			gap = 1;
		}

		// Increase the strength by 1/3
		strength = prev.strength + 0.3;

		if (strength > 1) {
			strength = 1;
		}

	} else {

		// Give the first few samples the benefit of the doubt
		if (this.cycle < 2) {
			strength = 0.5;
		} else {
			strength = 0;
		}
	}

	value = Number.normalize([lp_val], this.position_calculator.input_scales[locator_id])[0];

	// Invert the number, so that 0 means far away and 1 means very close
	value = 1 - value;

	if (value > 1) {
		value = 1;
	}

	if (value < 0) {
		value = 0;
	}

	this.values[locator_id] = {
		last_used_cycle : 0,
		cycle           : this.cycle,
		value           : value,
		date            : date,
		gap             : gap,
		used            : 0,
		strength        : strength
	};
});

/**
 * Add train data for a specific coordinate
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {String}   locator_id
 * @param    {Number}   rssi
 * @param    {Date}     date
 */
PData.setMethod(function setTrainData(locator_id, rssi, date) {

	var result;

	this.setData(locator_id, rssi, date);

	result = this.getNormalizedInput();

	return result;
});

/**
 * Get normalized network input
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 */
PData.setMethod(function getNormalizedInput() {

	var sample,
	    present = 0,
	    input = new Array(this.position_calculator.locator_ids.length * 2),
	    count,
	    index,
	    freq,
	    now = Date.now(),
	    gap,
	    age,
	    id,
	    i;

	// Fill it with zeroes
	input.fill(0);

	// Go over all the data we have
	for (id in this.values) {
		count = this.position_calculator.locator_ids.indexOf(id);

		// Skip unknown locators?
		if (count < 0) {
			console.log('Locator id', id, 'is unknown');
			continue;
		}

		index = count * 2;
		sample = this.values[id];

		if (this.sample_counts[id]) {
			freq = Math.mean(this.sample_counts[id]);
			present++;
		} else {
			freq = 0;
		}

		// Increase the use counter if it's a new cycle
		if (sample.last_used_cycle < this.cycle) {
			sample.last_used_cycle = this.cycle;
			sample.used++;
		}

		// How old is this value?
		input[index] = freq;

		// Only use this value if it isn't too old
		if (freq) {
			// What is the actual received value?
			input[index + 1] = sample.value;
		}
	}

	// Don't return an input array with empty zeroes, return null
	if (present < 1) {
		return null;
	}

	return input;
});