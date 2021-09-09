import { formatNum } from "./mergeComponents.js"
import {
	getMergedHull,
	getMergedThrust,
	getMergedWeapons,
	getMergedWings
} from "./ship.js"
import {
	renderHull,
	renderThrust,
	renderWeapons,
	renderWings
} from "./ShipRender.js"
import { translateToAndDraw } from "./Util.js"

export const getComponents = () => {}
export const getComponentNames = () => {
	let obj = {}
	Object.keys(components).forEach(key => (obj[key] = components[key].name))
	console.log(obj)
	return obj
}
class Component {
	constructor(statMap) {
		Object.entries(statMap).forEach(statEntry => {
			this[statEntry[0]] = statEntry[1]
		})
		this.statDivs = {}
		this.statVals = {}
		this.statChangeDivs = {}
	}
}
export const components = {
	weapons: {
		name: "Weapons",

		stats: {
			HP: ship => ship.shipOpts.weapons.maxHp,
			"Fire Rate": ship => ship.fireRate,
			Damage: ship => ship.dmg,
			"Shot Speed": ship => ship.shotSpeed,
			Range: ship => ship.shotLife * ship.shotSpeed
		},
		formatters: {
			"Fire Rate": val => formatNum(60 / val, 3),
			"Shot Speed": val => formatNum(100 * val, 1)
		},
		suffixes: {
			"Fire Rate": "/s",
			"Shot Speed": "km/s"
		},

		render: (c, opts) => {
			translateToAndDraw(c, 0, ((1 / (40 / 5)) * 40) / 5, () =>
				renderWeapons(c, opts, 0.5, 0.5)
			)
		},
		getMerged: (curOpts, opts1, opts2, tween) =>
			getMergedWeapons(opts1.weapons, opts2.weapons, tween)
	},
	hull: {
		name: "Hull",
		stats: {
			HP: ship => ship.shipOpts.hull.maxHp
		},
		render: (c, opts) => renderHull(opts, c, 0.5, 0.5),
		getMerged: (curOpts, opts1, opts2, tween) =>
			getMergedHull(opts1.hull, opts2.hull, tween)
	},
	wings: {
		name: "Wings",
		formatters: {
			"Turn Speed": val => formatNum(100 * val, 3)
		},
		stats: {
			HP: ship => ship.shipOpts.wings.maxHp,

			"Turn Speed": ship => ship.turnSpeed
		},
		render: (c, opts) => renderWings(opts, c, 0.5, 0.5),
		getMerged: (curOpts, opts1, opts2, tween) =>
			getMergedWings(curOpts.hull.h, opts1.wings, opts2.wings, tween)
	},
	thrust: {
		name: "Thrust",
		formatters: {
			"Thrust Speed": val => formatNum(1000 * val, 3)
		},
		stats: {
			HP: ship => ship.shipOpts.wings.maxHp,
			"Thrust Speed": ship => ship.speed
		},
		render: (c, opts) =>
			translateToAndDraw(c, 0, -((1 / (40 / 5)) * 40) / 4, () =>
				renderThrust(opts, c, 0.5, 0.5, true)
			),
		getMerged: (curOpts, opts1, opts2, tween) =>
			getMergedThrust(curOpts.hull, opts1.thrust, opts2.thrust, tween)
	}
}
