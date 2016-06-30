module.exports = function TrilaterationHelpers(Hawkejs, Blast) {

	/**
	 * Calculate distance between 2 points
	 *
	 * @author   Jelle De Loecker   <jelle@develry.be>
	 * @since    0.1.0
	 * @version  0.1.0
	 */
	function calculateDistance(sx, sy, dx, dy) {
		return Math.sqrt(Math.pow(dx - sx, 2) + Math.pow(dy - sy, 2));
	}

	
	/**
	 * The circle class
	 *
	 * @author   Jelle De Loecker   <jelle@develry.be>
	 * @since    0.1.0
	 * @version  0.1.0
	 */
	var Circle = Function.inherits(function Circle(radius, x, y) {
		this.radius = radius;
		this.x = x;
		this.y = y;
	});

	/**
	 * Do these 2 circles intersect?
	 *
	 * @author   Jelle De Loecker   <jelle@develry.be>
	 * @since    0.1.0
	 * @version  0.1.0
	 *
	 * @param    {Circle}   other_circle
	 *
	 * @return   {Boolean}
	 */
	Circle.setMethod(function intersects(other_circle) {
		var distance = calculateDistance(this.x, this.y, other_circle.x, other_circle.y);
		return distance > this.radius + other_circle.radius;
	});

	/**
	 * Is the other circle inside this circle?
	 *
	 * @author   Jelle De Loecker   <jelle@develry.be>
	 * @since    0.1.0
	 * @version  0.1.0
	 *
	 * @param    {Circle}   other_circle
	 *
	 * @return   {Boolean}
	 */
	Circle.setMethod(function contains(other_circle) {
		var distance = calculateDistance(this.x, this.y, other_circle.x, other_circle.y);
		return distance < (this.radius - other_circle.radius);
	});

	/**
	 * Is this circle inside the other circle?
	 *
	 * @author   Jelle De Loecker   <jelle@develry.be>
	 * @since    0.1.0
	 * @version  0.1.0
	 *
	 * @param    {Circle}   other_circle
	 *
	 * @return   {Boolean}
	 */
	Circle.setMethod(function inside(other_circle) {
		return other_circle.contains(this);
	});

	/**
	 * Intersect 2 circles
	 *
	 * @author   Jelle De Loecker   <jelle@develry.be>
	 * @since    0.1.0
	 * @version  0.1.0
	 */
	Circle.setMethod(function intersect(other_circle) {

		var distance = calculateDistance(this.x, this.y, other_circle.x, other_circle.y),
		    px,
		    py,
		    a,
		    h;

		// These circles do not overlap
		if (distance > this.radius + other_circle.radius) {
			return [];
		}

		// One circle contains the other
		if (distance < Math.abs(this.radius - other_circle.radius)) {
			return [];
		}

		// Two circles are equal
		if (distance == 0 && this.radius == other_circle.radius) {
			return [];
		}

		// Find distances of dimensions from the first circle center
		a = (Math.pow(this.radius, 2) - Math.pow(other_circle.radius, 2) + Math.pow(distance, 2)) / (2 * distance);
		h = Math.sqrt(Math.pow(this.radius, 2) - Math.pow(a, 2));

		// Determine point on the line between centers perpendicular to intersects
		px = this.x + a * (other_circle.x - this.x) / distance;
		py = this.y + a * (other_circle.y - this.y) / distance;

		return [
			{
				x: px + h * (other_circle.y - this.y) / distance,
				y: py - h * (other_circle.x - this.x) / distance
			},
			{
				x: px - h * (other_circle.y - this.y) / distance,
				y: py + h * (other_circle.x - this.x) / distance
			}
		];
	});

	/**
	 * Trilaterate with other circles
	 *
	 * @author   Jelle De Loecker   <jelle@develry.be>
	 * @since    0.1.0
	 * @version  0.1.0
	 */
	Circle.setStatic(function trilaterate() {

		var intersects,
		    p_index,
		    extra_p,
		    circles,
		    offsets,
		    points,
		    circle,
		    i;

		// Found points
		points = [];

		if (Array.isArray(arguments[0])) {
			circles = arguments[0];
		} else {
			circles = [];
			for (i = 0; i < arguments.length; i++) {
				circles[i] = arguments[i];
			}
		}

		for (i = 0; i < circles.length; i++) {
			circle = circles[i];

			// Intersect the current circle with the next one,
			// or the first one if at the end
			intersects = circle.intersect(circles[(i + 1) % circles.length]);

			// Get an extra point
			extra_p = circles[(i + 2) % circles.length];

			// Calculate the offsets
			offsets = [
				Math.abs(calculateDistance(intersects[0].x, intersects[0].y, extra_p.x, extra_p.y) - extra_p.radius),
				Math.abs(calculateDistance(intersects[1].x, intersects[1].y, extra_p.x, extra_p.y) - extra_p.radius),
			];

			points.push([intersects[0], offsets[0]]);
			points.push([intersects[1], offsets[1]]);
		}

		console.log('Found points:', points);

		// Find the most precisely triangulated point
		p_index = 0;

		for (i = 0; i < points.length; i++) {
			if (points[i][1] < points[p_index][1]) {
				p_index = i;
			}
		}

		console.log('Found pindex:', p_index)

		return points[p_index][0];
	});

};