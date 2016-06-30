/**
 * The Beacon Element Type
 *
 * @constructor
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
var Beacon = Function.inherits('Elric.ElementType', function BeaconElementType() {});

// A beacon is a single point
Beacon.setProperty('dimensions', 0);

Beacon.setProperty('colour_original', '#00DD00');
Beacon.setProperty('colour_hover', '#00EE00');
Beacon.setProperty('colour_select', '#00FF00');