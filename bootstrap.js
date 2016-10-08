var fs = require('fs');
var forkify = alchemy.use('forkify');
// This file gets executed first

alchemy.ready(function onReady() {

	var locators = [],
	    clean_calc,
	    calculator,
	    train_data;

	// clean_calc = new Classes.Elric.PositionCalculator();

	// clean_calc.prepare(function done(err, result) {
	// 	console.log('Locators:', err, result, calculator)

	// 	clean_calc.normalizeTrainData();
	// 	clean_calc.startTraining();

	// 	fs.writeFileSync(PATH_TEMP + '/poscalc8_' + Date.now() + '.dry.json', JSON.dry(clean_calc));
	// 	console.log('Stored calculator!');
	// });

	return;

	calculator = new Classes.Elric.LocationClassifier();

	console.log('New calculator:', calculator);

	calculator.prepare('57714d52b6ae2c6259df5072', function prepared() {
		var samples = calculator.normalizeTrainData();

		require('fs').writeFileSync(PATH_TEMP + '/train_data.json', JSON.stringify(samples, null, 2));
	});

	return;

	Model.get('Beacon').findById('57714d52b6ae2c6259df5072', function gotBeacon(err, beacon) {

		//console.log('Beacon:', err, beacon);

		beacon.getPositionClassifier(function gotClassifier(err, classifier) {

			Model.get('LocationTrain').findById('57f7a2a539f50668191bd082', function gotTrain(err, record) {

				if (err) {
					throw err;
				}

				classifier.instance.addTrainData(record);

				var result = classifier.instance.normalizeTrainData();

				console.log('Train data:', result);

				require('fs').writeFileSync(PATH_TEMP + '/validate.json', JSON.stringify(result, null, 2));

			});

			return;

			//console.log('Got classifier:', err, classifier);

			classifier.instance.prepare(beacon._id, function prepared(err) {

				var samples,
				    options,
				    sample,
				    result,
				    i;

				options = {
					rate       : 0.001,
					iterations : 4000,
					shuffle    : true
				};

				classifier.instance.startTraining(options, function finishedTraining(err) {

					var samples,
					    locator,
					    sample,
					    result,
					    dried,
					    name,
					    i;

					if (err) {
						return console.error('Failed training: ' + err, err);
					}

					console.log('Done training!');

					classifier.save(function saved(err) {
						console.log('Saved classifier?', err);

						setTimeout(function () {

							console.log('');
							console.log('Training again?');

							// Start training again!
							classifier.instance.startTraining(options, finishedTraining);
						}, 30000);
					});

					dried = JSON.dry(classifier.instance);
					fs.writeFileSync(PATH_TEMP + '/posclas0.dry.json', dried);
					fs.writeFileSync(PATH_TEMP + '/posclas1_' + Date.now() + '.dry.json', dried);

					// Get the newest samples
					samples = classifier.instance.training_samples.slice(5000);
					shuffle(samples);

					for (i = 10; i < samples.length; i++) {
						sample = samples[i];

						result = classifier.instance.activate(sample.input);
						console.log('Testing ' + sample.name + ' sample:', result, sample);

						if (i == 20) break;
					}
				});
			});
		});
	});

	return;

	// 0.46915 -> 0.463194 error
	calculator = JSON.undry(fs.readFileSync(PATH_TEMP + '/posclas0.dry.json'));

	console.log('Got classifier:', calculator);

	// queryTrainData
	calculator.prepare(function gotTrainData(err) {

		if (err) {
			throw err;
		}

		calculator.normalizeTrainData();

		samples = calculator.training_samples;
		shuffle(samples);

		for (i = 10; i < samples.length; i++) {
			sample = samples[i];

			result = calculator.activate(sample.input);
			console.log('Testing ' + sample.name + ' sample:', result, sample);

			if (i == 20) break;
		}

		console.log('Training classifier:', calculator);

		calculator.startTraining(function finishedTraining(err) {

			var samples,
			    locator,
			    sample,
			    result,
			    dried,
			    name,
			    i;

			if (err) {
				return console.error('Failed training: ' + err, err);
			}

			console.log('Done training!');

			dried = JSON.dry(calculator);
			fs.writeFileSync(PATH_TEMP + '/posclas0.dry.json', dried);
			fs.writeFileSync(PATH_TEMP + '/posclas1_' + Date.now() + '.dry.json', dried);

			samples = calculator.training_samples;
			shuffle(samples);

			for (i = 10; i < samples.length; i++) {
				sample = samples[i];

				result = calculator.activate(sample.input);
				console.log('Testing ' + sample.name + ' sample:', result, sample);

				if (i == 30) break;
			}
		});

		fs.writeFileSync(PATH_TEMP + '/train_location_samples.json', JSON.stringify(calculator.training_samples, null, 4));
	});
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
