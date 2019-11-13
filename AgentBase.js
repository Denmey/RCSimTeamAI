const Msg = require('./msg');
const Flags = require('./Flags');
const SocketWrapper = require('./SocketWrapper');

const EPSILON = 0.001; // Epsilon for float point numbers comparison

let FieldRect = {
	l: -52.5,
	r: 52.5,
	b: -39,
	t: 39
}

// Changes c so D becomes non-negative
function uncertainSolveQuadratic(a, b, c) {
	let D = b**2 - 4*a*c;
	// Check if D is not a negative number
	if (D < 0) {
		c += 0.25 * D/a;
		D = b**2 - 4*a*c;
	}
	D = Math.sqrt(D);
	// D = D < 0 ? 0 : Math.sqrt(D);
	// console.log(b**2, -4*a*c);
	console.log("D:", D);
	return [(-b + D)/(2*a), (-b - D)/(2*a)]
}

function isCollinear(p1, p2, p3) {
	// mathworld.wolfram.com/Collinear.html
	let triangleArea = p1.x*(p2.y-p3.y) + p2.x*(p3.y-p1.y) + p3.x*(p1.y-p2.y);
	if (Math.abs(triangleArea) < EPSILON)
		return true;
	return false;
}

function isInField(x, y) {
	if (x >= FieldRect.l && x <= FieldRect.r && y >= FieldRect.b && y <= FieldRect.t) {
		return true;
	}
	return false;
}

class AgentBase {
	constructor(teamName, position = {x: 0, y: 0}, version = 7) {
		console.log(Flags['gl']);
		this.team = teamName;
		this.tick = 0;
		this.turn = 0;
		this.angle = 0;
		this.position = position; // Current known position
		this.side = null; // Team's field side
		this.memory = {};
		this.memory.seeing = [];
		// this.run = false; // ?
		this.action = null; // Current action
		this.socket = new SocketWrapper(this);
		this.socket.sendMsg(`(init ${teamName} (version ${version}))`);
	}

	initAgent(p) {
		this.side = p[0]; // Field side
		if (p[1]) this.id = p[1]; // Player id
		this.socket.sendMsg(
			`(move ${this.position.x} ${this.position.y})`
		);
	}

	processMsg(msg) {
		msg = msg.toString('utf8');
		let data = Msg.parseMsg(msg);

		if (!data) throw new Error("Parse error\n" + msg);
		if (data.cmd == 'error') {
			console.log("Error:", data);
			return;
		}
		if (data.cmd == "turn")
			console.log(data);
		if (data.cmd == "init") this.initAgent(data.p);
		else if (data.cmd == "sense_body") {
			// this.run(data);
		} else if (data.cmd == "see") {
			this.see(data);
		}
		// console.log(msg);
	}

	see(data) {
		console.log("--------------------See");
		// console.log("Seeing:", JSON.stringify(data.msg, null, 2));
		console.log("Tick:", data.p[0]);
		// this.memory.seeing = [];
		this.calcPlayerPosition(data);
		this.calcOtherPositions(data);
		console.log("Player position:", this.position);
		console.log("Visible objects:", this.memory.seeing);
		this.run(data);
	}

	run(sense) { // Function called on each sense_body msg (each 100ms)
		console.log("-----------------------------------");
		console.log("--------------------Sense");
		// console.log(JSON.stringify(sense.msg, null, 2));
		this.tick = sense.p[0];
		console.log("Tick:", this.tick);

		if (this.memory.seeing) {
			let ball = this.memory.seeing.ball;
			if (ball) {
				console.log("BallAngle:", ball.a);
				console.log("Ticks passed when ball was seen:", this.tick - ball.t);
			}
			if ((!ball) || (this.tick - ball.t) > 5) {
				let angleDelta = 30;
				for (let it of this.memory.seeing) {
					it.a -= angleDelta;
				}
				this.socket.sendMsg(`(turn ${angleDelta})`);
				// this.turn = (this.turn + 30) % 360 - 180;
			}
			else if (Math.abs(ball.a) > 3 && (this.tick - ball.t) < 3) {
				let angleDelta = ball.a;
				for (let it of this.memory.seeing) {
					it.a -= angleDelta;
				}
				this.socket.sendMsg(`(turn ${angleDelta})`);
			}
			else if ((this.tick-ball.t) < 5 && ball.d > 1.0) {
				let angleToBall = ball.a;
				let distanceToBall = ball.d;
				this.socket.sendMsg(`(dash 50 ${angleToBall})`)
			} else if (ball.d < 2.0 && (this.tick-ball.t) < 2) {
				let goalPos = Flags['gr'];
				let myPos = this.position;
				let ballPos = ball.p;
				let kickAbsDirection = Math.atan2(goalPos.y-myPos.y, goalPos.x-myPos.x)*57.3;;
				let kickAngle = kickAbsDirection - this.angle;
				this.socket.sendMsg(`(kick 50 ${kickAngle})`)
			}
		}
	}

	calcPlayerPositionFor2Points(f) {
		// throw new Error('Not implemented yet');

		let f1 = f[0],
		    f2 = f[1];
		let alpha1, beta1;
		let a, b, c;
		let x, y, angle;
		let dx21 = (f2.x-f1.x), dy21 = (f2.y-f1.y);

		console.log("DX and DY:", dx21, dy21);

		if (Math.abs(dx21) < EPSILON) {
			y = f2.y**2 - f1.y**2 + f1.d**2 - f2.d**2;
			y /= 2*dy21;
		} else if (Math.abs(dy21) < EPSILON) {
			x = f2.x**2 - f1.x**2 + f1.d**2 - f2.d**2;
			x /= 2*dx21;
		}

		if (Math.abs(dx21) > EPSILON) {
			console.log("###1");
			// If dx21 > 0 and (dy21 = 0 or |dy21| > 0)
			// x = alpha1*y + beta156
			alpha1 = -dy21/dx21;
			beta1  = ((f2.y**2)-(f1.y**2)
			         +(f2.x**2)-(f1.x**2)
			         +(f1.d**2)-(f2.d**2))/(2*dx21);

			a = 1 + alpha1**2;
			b = -2*(f1.y + alpha1*(f1.x-beta1));
			c = (f1.x - beta1)**2 + f1.y**2 - f1.d**2;

			y = uncertainSolveQuadratic(a,b,c);
			x = [alpha1*y[0]+beta1, alpha1*y[1]+beta1];
		} else if (Math.abs(dy21) > EPSILON) {
			console.log("###2");
			// y = alpha1*x + beta1
			alpha1 = -dx21/dy21;
			beta1  = ((f2.y**2)-(f1.y**2)
			         +(f2.x**2)-(f1.x**2)
			         +(f1.d**2)-(f2.d**2))/(2*dy21);

			a = 1 + alpha1**2;
			b = -2*(f1.x + alpha1*(f1.y-beta1));
			c = (f1.y - beta1)**2 + f1.x**2 - f1.d**2;

			x = uncertainSolveQuadratic(a,b,c);
			y = [alpha1*x[0]+beta1, alpha1*x[1]+beta1]
		} else {
			// Shouldn't be executed but just in case
			console.log("Points:", f);
			throw new Error("Two points are too close to each other")
		}

		if (isInField(x[0], y[0]) && isInField(x[1], y[1])) {
			console.log("Both positions are in field:", x, y);
			throw new Error("Both positions are in field");
		} else	if (isInField(x[0], y[0])) {
			[x, y] = [x[0], y[0]];
		} else if (isInField(x[1], y[1])) {
			[x, y] = [x[1], y[1]];
		} else {
			throw new Error("Both positions aren't in field:", x, y)
		}

		if (isNaN(x) || isNaN(y)) {
			console.log("Flags:", f);
			console.log("Coords:", x, y);
			throw new Error("Couldn't find positions.")
		}

		angle = Math.atan2(f1.y - y, f1.x - x)*57.3 - f1.a;

		return [x, y, angle];
	}

	calcPlayerPositionFor3Points(f) {
		let f1 = f[0],
		    f2 = f[1],
		    f3 = f[2];
		let alpha1, alpha2, beta1, beta2;
		let a, b, c;
		let x, y, angle;

		if (Math.abs(f3.x-f1.x) < EPSILON)
			[f2, f3] = [f3, f2];

		let dx21 = (f2.x-f1.x), dy21 = (f2.y-f1.y);

		if (Math.abs(dx21) < EPSILON) {
			y = f2.y**2 - f1.y**2 + f1.d**2 - f2.d**2;
			y /= 2*dy21;
		} else if (Math.abs(dy21) < EPSILON) {
			x = f2.x**2 - f1.x**2 + f1.d**2 - f2.d**2;
			x /= 2*dx21;
		}

		if (dx21 && dy21) { // If dx and dy aren't 0
			alpha1 = (f1.y - f2.y)/dx21;
			beta1  = ((f2.y**2)-(f1.y**2)
			             +(f2.x**2)-(f1.x**2)
			             +(f1.d**2)-(f2.d**2))/(2*dx21);
			let dx31 = (f3.x-f1.x);
			alpha2 = (f1.y - f3.y)/dx31;
			beta2  = ((f3.y**2)-(f1.y**2)
			             +(f3.x**2)-(f1.x**2)
			             +(f1.d**2)-(f3.d**2))/(2*dx31);

			y = (beta1-beta2)/(alpha2-alpha1),
			x = (alpha1 * y) + beta1;
		} else if (!dy21) { // If y2-y1 is 0
			a = 1;
			b = -2*f1.y;
			c = - (f1.d**2 - f1.x**2 + 2*x*f1.x - x**2 - f1.y**2);
			y = uncertainSolveQuadratic(a, b, c);
			if (Math.abs(y[1]-y[0]) < EPSILON) {
				// One solution
				y = y[0];
			} else {
				// Choose based on distances to third point.
				// They can't be equal, because third point was chosed so
				//   it's not collinear with other two
				let d1 = Math.abs(f3.d**2 - (x - f3.x)**2 - (y[0] - f3.y)**2);
				let d2 = Math.abs(f3.d**2 - (x - f3.x)**2 - (y[1] - f3.y)**2);
				if (d1 < d2) {
					y = y[0];
				} else {
					y = y[1];
				}
			}
		} else { // If x2==x1
			a = 1;
			b = -2*f1.x;
			c = - (f1.d**2 - f1.x**2 - f1.y**2 + 2*y*f1.y-y**2);
			x = uncertainSolveQuadratic(a, b, c);
			if (Math.abs(x[0]-x[1]) < EPSILON) {
				// One solution
				x = x[0];
			} else {
				let d1 = Math.abs(f3.d**2 - (x[0] - f3.x)**2 - (y - f3.y)**2);
				let d2 = Math.abs(f3.d**2 - (x[1] - f3.x)**2 - (y - f3.y)**2);
				if (d1 < d2) {
					x = x[0];
				} else {
					x = x[1];
				}
			}
		}

		angle = Math.atan2(f1.y - y, f1.x - x)*57.3 - f1.a;
		if (isNaN(x) || isNaN(y) || isNaN(angle)) {
			console.log('Alphas and betas:', alpha1, beta1, alpha2, beta2);
			console.log("ABC:",a,b,c);
			console.log("Position:", x, y);
			console.log("Angle:", x, y);
			console.log(f);
			throw new Error("Couldn't calculate position or angle");
		}

		return [x, y, angle];
	}

	// Returns agent's position and body angle or false if couldn't find them
	calcPlayerPosition(data) {
		let flags = [];

		// Take first 2 visible flags and third that is not collinear with first two
		for (let i = 1; i < data.p.length; ++i) {
			// If not a flag, skip
			if (data.p[i].cmd.p[0] != 'f')
				continue;

			let flagName = "";
			for (let j = 0; j < data.p[i].cmd.p.length; ++j)
				flagName += data.p[i].cmd.p[j];

			let flag = {
				pos: Flags[flagName],
				dist: data.p[i].p[0],
				angle: data.p[i].p[1]
			}
			if (flags.length == 2 && isCollinear(flags[0].pos, flags[1].pos, flag.pos)) {
				// Skip if collinear
				continue;
			}
			flags.push(flag);
			if (flags.length == 3)
				break;
		}

		if (flags.length != 3) {
			console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
			console.log("ERROR: not enough visible flags");
			console.log(flags);
		}

		// Add player radius: (TODO: Is this being needed?)
		// And invert y in known flag coords
		const playerSize = 0.3;
		let f = []
		if (flags[0])
			f.push({x: flags[0].pos.x, y: -flags[0].pos.y, d: flags[0].dist + playerSize, a: flags[0].angle});
		if (flags[1])
			f.push({x: flags[1].pos.x, y: -flags[1].pos.y, d: flags[1].dist + playerSize, a: flags[1].angle});
		if (flags[2])
			f.push({x: flags[2].pos.x, y: -flags[2].pos.y, d: flags[2].dist + playerSize, a: flags[2].angle});

		console.log("Flags:", f);


		let x, y, angle;

		if (f.length == 1) {
			throw new Error("Only one flag is visible, can't determine position")
		} else if (f.length == 2) {
			[x, y, angle] = this.calcPlayerPositionFor2Points(f);
		} else if (f.length == 3) {
			[x, y, angle] = this.calcPlayerPositionFor3Points(f);
		}

		console.log("POSITION:", x, y);
		console.log("Goal position:", Flags['gr']);
		console.log("ANGLE:", angle);
		console.log("Flags:", flags);
		if (isNaN(x) || isNaN(y) || isNaN(angle)) {
			throw new Error("Couldn't calculate position or angle");
		}

		this.position.x = x;
		this.position.y = y;
		this.angle = angle;
		return [x, y, angle];
	}

	calcOtherPositions(data) {
		for (let i = 1; i < data.p.length; ++i) {
			let fChar = data.p[i].cmd.p[0];
			// Skip flags, goals and lines
			if (fChar == 'f' || fChar == 'g' || fChar == 'l')
				continue;
			let dist = data.p[i].p[0];
			let angle = data.p[i].p[1];
			let pos = {
				x: this.position.x + dist * Math.cos((angle+this.angle)*0.0056*Math.PI),
				y: this.position.y + dist * Math.sin((angle+this.angle)*0.0056*Math.PI)
			};
			let name;
			if (fChar == 'b') {
				name = "ball";
			} else {
				console.log("Can't process", fChar, "in seeing");
			}
			this.memory.seeing[name ? name : fChar] = {
				p: pos, // Position of an object
				d: dist, // Distance to the object
				a: angle, // Angle to the object
				t: this.tick // Tick when it was seen
			};
		}
	}





}

module.exports = AgentBase;
