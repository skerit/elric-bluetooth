/**
 * Create a floorplan
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
hawkejs.scene.on({type: 'set', name: 'chimera-cage', template: 'beacon/train'}, function setDoek(element, variables) {

	var plan = new Floorplan('train-map'),
	    training = false,
	    record = variables.record[0].Beacon,
	    beacon,
	    link;

	plan.addElementTypes(variables.element_types);
	plan.addRooms(variables.rooms);

	beacon = plan.addElements([{
		dx: 0,
		dy: 0,
		element_type: 'beacon',
		height: 1,
		name: 'beacon'
	}])[0];

	// Enable changeSize status, so we can move the beacon
	plan.d._selectedNode = beacon;
	plan.selected = beacon;
	plan.d.setAction('changeSize');

	window.train_floorplan = plan;

	$('.btn-start-training').on('click', function onClick(e) {

		var that = this,
		    client_count = 0,
		    packets = 0,
		    clients = {},
		    data;

		e.preventDefault();

		if (training) {

			// Allow the user to start training again
			this.innerText = 'Start training';
			training = false;

			// Make sure the beacon is selected
			plan.selected = beacon;
			plan.d._selectedNode = beacon;

			// Change the state of the canvas,
			// so the beacon can be dragged again
			plan.d.setAction('changeSize');

			// Stop the training
			link.submit('stop');

			// Destroy the link
			link.destroy();

			// Nullify it, too
			link = null;

			// Stop training!
			return;
		}

		data = {
			beacon_id : record._id,
			x         : beacon.position.mapX,
			y         : beacon.position.mapY,
			z         : 0
		};

		// Create the train link
		link = alchemy.linkup('beacontrain', data);

		// Listen for training data, just for information
		link.on('training_data', function gotData(packet) {

			var client_id = packet.client_id,
			    data = packet.data;

			if (clients[client_id] == null) {
				clients[client_id] = 0;
				client_count++;
			}

			clients[client_id]++;
			packets++;

			that.innerText = 'Stop training (' + packets + ' samples from ' + client_count + ' clients)';

			console.log('Got client data:', client_id, data);
		});

		this.innerText = 'Stop training';
		training = true;
		plan.d.setAction(false);
	});
});