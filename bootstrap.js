var fs = require('fs');
var forkify = alchemy.use('forkify');
// This file gets executed first

alchemy.ready(function onReady() {

	var locators = [],
	    clean_calc,
	    calculator,
	    train_data;

	// clean_calc = new alchemy.classes.PositionCalculator();

	// clean_calc.prepare(function done(err, result) {
	// 	console.log('Locators:', err, result, calculator)

	// 	clean_calc.normalizeTrainData();
	// 	clean_calc.startTraining();

	// 	fs.writeFileSync(PATH_TEMP + '/poscalc8_' + Date.now() + '.dry.json', JSON.dry(clean_calc));
	// 	console.log('Stored calculator!');
	// });

	calculator = new alchemy.classes.PositionCalculator();


	//calculator = JSON.undry(fs.readFileSync(PATH_TEMP + '/mposcalc0.dry.json'));

	// queryTrainData
	calculator.prepare(function gotTrainData(err) {

		if (err) {
			throw err;
		}

		// console.log('Bureau:', calculator.activate([1,0.8,0.21656769308560012,1,1,0.31972997326894703,1,1,0.0924894104720371,1,0.8,0.027899704463827397]));
		// console.log('Topright:', calculator.activate([1,1,0.21656769308560012,1,1,0.2638339552106685,1,0.8,0.4226545221219452,1,1,0.041822419769189045]));
		// console.log('Kitchen:', calculator.activate([1,1,0.3513162020131681,1,0.3,0.21656769308560012,1,0.8,0.7169745389831702,1,1,0.022308084370203866]));
		// console.log('Inkom:', calculator.activate([1,1,0.21656769308560012,1,0.8,0.23919790455536385,1,0.8,0.4226545221219452,1,1,0.1958026257141307]));
		// console.log('Badkamerm:', calculator.activate([1,0.8,0.31972997326894703,1,1,0.2638339552106685,1,1,0.06520192973463067,1,1,0.009765264641372883]));
		//return;

		calculator.normalizeTrainData();

		console.log('Training...');

		calculator.startTraining(function finishedTraining(err) {

			var samples,
			    locator,
			    sample,
			    result,
			    name,
			    i;

			if (err) {
				return console.error('Failed training: ' + err, err);
			}

			// var temp = {};
			// for (var id in calculator.locators) {
			// 	temp[id] = calculator.locators[id].train_samples;
			// }
			// fs.writeFileSync(PATH_TEMP + '/train_samples_unlog.json', JSON.stringify(temp, null, 4));

			console.log('Done training!');
			fs.writeFileSync(PATH_TEMP + '/mposcalc1_' + Date.now() + '.dry.json', JSON.dry(calculator));
			fs.writeFileSync(PATH_TEMP + '/mposcalc0.dry.json', JSON.dry(calculator));

			console.log('Calculator:', calculator);

			// Examples using RSSI input
			// console.log('Bureau:', calculator.activate([1,1,0.4878048780487805,1,1,0.5365853658536586,1,0.8,0.4146341463414634,1,1,0.2682926829268293]));
			// console.log('Topright:', calculator.activate([1,1,0.6585365853658537,1,1,0.6341463414634146,1,1,0.4146341463414634,1,1,0.21951219512195122]));
			// console.log('Kitchen:', calculator.activate([1,1,0.5365853658536586,1,1,0.5853658536585366,1,0.5,0.926829268292683,1,1,0.04878048780487805]));
			// console.log('Inkom:', calculator.activate([1,0.8,0.5853658536585366,1,0.8,0.6829268292682927,1,1,0.2926829268292683,1,0.8,0.4878048780487805]));
			// console.log('Badkamerm:', calculator.activate([1,1,0.7804878048780488,1,0.8,0.6585365853658537,1,0.5,0.34146341463414637,1,0.8,0.43902439024390244]));

			for (name in calculator.location_input) {
				samples = calculator.location_input[name];

				console.log('-- Testing Location ' + name + ' --');

				for (i = 10; i < samples.length; i++) {
					sample = samples[i];
					result = calculator.activate(sample.input);
					console.log(result)

					if (i == 15) break;
				}
			}
		});

		var temp = {};
		for (var id in calculator.locators) {
			temp[id] = calculator.locators[id].train_samples;
		}
		fs.writeFileSync(PATH_TEMP + '/train_samples_unlog.json', JSON.stringify(temp, null, 4));
	});

	// Normalize data
	//calculator.normalizeTrainData();

	

	return;


	Function.parallel(function getLocators(next) {

		var conditions = {
			name: 'bluetooth',
			enabled: true
		};

		Model.get('ClientCapability').find('list', {fields: ['client_id', ''], conditions: conditions}, function gotCapabilities(err, records) {

			var i;

			if (err) {
				return next(err);
			}

			for (i = 0; i < records.length; i++) {
				calculator.addLocator(''+records[i]);
			}

			return next();
		});
	}, function getData(next) {
		Model.get('BeaconTrain').find('all', {recursive: 0, document: false}, function gotAll(err, records) {

			if (err) {
				return next(err);
			}

			train_data = records;
			next();
		});
	}, function done(err) {

		var sample,
		    first,
		    input,
		    res,
		    pos,
		    i;

		if (err) {
			throw err;
		}

		var json = JSON.parse(fs.readFileSync(PATH_TEMP + '/poscalc5_1467013021758.json'));
		calculator.loadNetwork(json);

		pos = new alchemy.classes.PositionData(calculator);

		console.log('Loaded network!', calculator);

		// Prepare train data
		for (i = 0; i < train_data.length; i++) {
			calculator.addTrainData(train_data[i].BeaconTrain);
		}

		calculator.normalizeTrainData();

		console.log('Added training data, sample count:', calculator.train_data.length);
		//console.log(calculator.train_data);

		// Do the actual training
		var start = Date.now();
		var result = calculator.startTraining();
		console.log('Trained in', Date.now() - start, 'ms, result:', result);

		// 0.6605771047010834, 0.9276336807076039
		console.log('Wc:', calculator._network.activate(wc));

		// 0.5850767349953045, 0.9062201432740568
		console.log('Keuken:', calculator._network.activate(kitchen));

		// Was 0.9999997536134263, 0.0000012974900931272013
		console.log('Topright:', calculator._network.activate(topright));

		// 0.9879689900969797, 0.9998031124331854
		console.log('Desk:', calculator._network.activate(desk));
	});
});