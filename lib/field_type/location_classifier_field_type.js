/**
 * The FieldType class
 *
 * @constructor
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
var LocationClassifierFieldType = FieldType.extend(function LocationClassifierFieldType(schema, name, options) {
	LocationClassifierFieldType.super.call(this, schema, name, options);
});

/**
 * Set the datatype name
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
LocationClassifierFieldType.setProperty('datatype', 'location_classifier');

/**
 * Convert the data in order to save it in the database
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Object}      value        Value of field, an object in this case
 * @param    {Object}      data         The data object containing `value`
 * @param    {Datasource}  datasource   The destination datasource
 */
LocationClassifierFieldType.setMethod(function _toDatasource(value, data, datasource, callback) {

	var result;

	if (value) {
		result = value.toJSON();
	} else {
		result = null;
	}

	callback(null, result);
});

/**
 * Get some more subschema data
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Mixed}      value
 * @param    {Function}   callback
 */
LocationClassifierFieldType.setMethod(function _toApp(query, options, value, callback) {

	var instance;

	if (!value) {
		instance = new Classes.Elric.LocationClassifier();
	} else {
		instance = Classes.Elric.LocationClassifier.unDry(value);
	}

	callback(null, instance);
});