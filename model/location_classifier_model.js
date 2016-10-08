/**
 * The Location Classifier Model
 *
 * @constructor
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
var LocationClassifier = Model.extend(function LocationClassifierModel(options) {
	LocationClassifierModel.super.call(this, options);
});

/**
 * Constitute the class wide schema
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
LocationClassifier.constitute(function addFields() {

	// Each classifier belongs to a specific beacon
	this.belongsTo('Beacon');

	// The instance itself
	this.addField('instance', 'LocationClassifier');
});

/**
 * Start training this classifier
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
LocationClassifier.setDocumentMethod(function train(callback) {

	var that = this;

	if (!callback) {
		callback = Function.thrower;
	}

	if (this.instance == null) {
		this.instance = new Classes.Elric.LocationClassifier();
	}

	this.instance.prepare(this.beacon_id, function preparedClassifier(err) {

		if (err) {
			return callback(err);
		}

		that.instance.startTraining(function trained(err, result) {

			if (err) {
				return callback(err);
			}

			// Save the record
			that.save();

			callback(null, result);
		});
	});
});

/**
 * Get position
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
LocationClassifier.setDocumentMethod(function addLocatorData(client_id, rssi, date) {
	return this.instance.addLocatorData(client_id, Math.abs(rssi), date);
});