/**
 * The Neural Network Train Command
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
var TrainCmd = Function.inherits('Alchemy.Command', function ElricTrainNetworkCommand() {
	ElricTrainNetworkCommand.super.call(this);
});

/**
 * Set the command configuration schema
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
TrainCmd.constitute(function setSchema() {

	// The classifier to train
	this.schema.belongsTo('LocationClassifier');

});

/**
 * Execute the scenario
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
TrainCmd.setMethod(function execute(options, callback) {

	var that = this,
	    count = 0,
	    id;

	id = setInterval(function doCount() {

		if (that.resume_requested) {
			that.report('resumed');
			that.resume_requested = false;
		}

		if (that.paused) {
			return;
		}

		if (that.pause_requested) {
			return that.report('paused');
		}

		if (that.need_stop) {
			clearInterval(id);
			that.report('stopped');
			return callback(null);
		}

		count++;

		that.report(count * 10);

		if (count > 6) {
			clearInterval(id);
			callback(null);
		}
	}, 2500);
});