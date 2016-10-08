/**
 * The Location Train Data Model
 *
 * @constructor
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
var LocationTrain = Model.extend(function LocationTrainModel(options) {
	LocationTrainModel.super.call(this, options);
});

/**
 * Constitute the class wide schema
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
LocationTrain.constitute(function addFields() {

	// Each set of train data belongs to a specific beacon
	this.belongsTo('Beacon');

	// The name of this trained position
	this.addField('name', 'String');
	this.addField('location_id', 'String');

	// The actual train data
	this.addField('data', 'Object');
});