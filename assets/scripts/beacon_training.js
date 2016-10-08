/**
 * Create a floorplan
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
hawkejs.scene.on({type: 'set', name: 'chimera-cage', template: 'beacon/train'}, function setDoek(element, variables) {

	var selecting,
	    training,
	    selected,
	    $collect,
	    $train,
	    record,
	    beacon,
	    link,
	    plan;

	// Create new floorplan
	plan = new Floorplan('train-map');

	// Get the start-collecting button
	$collect = $('.btn-start-collecting');

	// Get the start-training button
	$train = $('.btn-start-training');

	// Get the beacon record
	record = variables.record[0].Beacon;

	console.log('Adding element types:', variables.element_types, variables)

	// Add all element types
	plan.addElementTypes(variables.element_types);

	// Add all rooms
	plan.addRooms(variables.rooms);

	// Enable the 'select' action
	plan.d.setAction('select');
	plan.mode = 'select';

	// DEBUG expose the plan
	window.train_floorplan = plan;

	// Listen to the mouseup event
	plan.d.on('mouseup', function clicked(canvas) {

		var node = canvas._selectedNode;

		// Don't change selection when selecting
		if (selecting) {
			return;
		}

		// Only allow clicks on location elements
		if (!node || node.elricType != 'location') {
			selected = null;
			return;
		}

		// Set this node as the selected one
		selected = node;

		$collect[0].innerText = 'Collect "' + selected.roomElement.name + '" samples';
	});

	// Start collecting samples on click
	$collect.on('click', function onClick(e) {

		var that = this,
		    client_count = 0,
		    packets = 0,
		    clients = {},
		    data;

		e.preventDefault();

		if (selecting) {

			// Allow the user to start selecting again
			this.innerText = 'Collect "' + selected.roomElement.name + '" samples';
			selecting = false;

			// Stop the selecting
			link.submit('stop');

			// Destroy the link
			link.destroy();

			// Nullify it, too
			link = null;

			// Stop selecting!
			return;
		}

		if (!selected) {
			return;
		}

		data = {
			beacon_id   : record._id,
			location_id : selected.roomElement._id,
			name        : selected.roomElement.name
		};

		// Create the train link
		link = alchemy.linkup('beaconcollect', data);

		// Listen for selecting data, just for information
		link.on('training_data', function gotData(packet) {

			var client_id = packet.client_id,
			    data = packet.data;

			if (clients[client_id] == null) {
				clients[client_id] = 0;
				client_count++;
			}

			clients[client_id]++;
			packets++;

			that.innerText = 'Stop collecting "' + selected.roomElement.name + '" samples (' + packets + ' from ' + client_count + ' clients)';
		});

		this.innerText = 'Stop collecting "' + selected.roomElement.name + '" samples';
		selecting = true;
		plan.d.setAction(false);
	});

	// Start training the network on click
	$train.on('click', function onClick(e) {

		var that = this,
		    data;

		e.preventDefault();

		if (training) {
			console.log('Already training');
			return;
		}

		data = {
			beacon_id : record._id
		};

		training = alchemy.linkup('beacontrain', data);

		// Listen for training updates
		training.on('update', function gotUpdate(packet) {

			console.log('Got train update:', packet);

		});
	});
});