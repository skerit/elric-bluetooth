/**
 * The Location Element Type
 *
 * @constructor
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
var Location = Function.inherits('Elric.ElementType', function LocationElementType() {});

// A location is a single point
Location.setProperty('dimensions', 0);

Location.setProperty('colour_original', '#001099');
Location.setProperty('colour_hover', '#0090DD');
Location.setProperty('colour_select', '#00D0FF');