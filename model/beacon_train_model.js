/**
 * The Beacon Train Data Model
 *
 * @constructor
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
var BeaconTrain = Model.extend(function BeaconTrainModel(options) {
	BeaconTrainModel.super.call(this, options);
});

/**
 * Constitute the class wide schema
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
BeaconTrain.constitute(function addFields() {

	// Each set of train data belongs to a specific beacon
	this.belongsTo('Beacon');

	// The name of this trained position
	this.addField('name', 'String');

	// The beacon position
	this.addField('x', 'Number');
	this.addField('y', 'Number');
	this.addField('z', 'Number');

	// The actual train data
	this.addField('data', 'Object');
});