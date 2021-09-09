import { getNewRng } from "./Rng.js"
import { rndBtwn } from "./Util.js"

export function getShipOpts(seed, level) {
	let rn = getNewRng(seed)
	return createRandomShip(rn, level)
}

const createRandomShip = (rn, level) => {
	let col1 = getRandomShipColor(rn)
	let col2 = getRandomSecondaryColor(rn)

	let hp = Math.ceil(2 + rn() * level)
	let hull = getHull(rn, col1, hp)

	let wings = getWings(hull, rn, col1, col2, hp)

	let thrust = getThrust(rn, hull, col1, hp)

	let weapons = getWeapons(rn, wings, col2, hp)
	return {
		hull,
		wings,
		thrust,
		weapons
	}
}

function getThrust(rn, hull, color, hp) {
	let amount = Math.ceil(rn() * 5)
	let w1 = hull.bottomW
	let w2 = 2 * rn() * hull.bottomW
	let tw = (2.5 * rn() * w2) / (amount + 2)
	let top = hull.h / 2
	let h = Math.ceil(1000 * rn() * 2) / 1000
	let h1 = (0.5 + 0.5 * rn()) * h
	let h2 = h - h1
	let stepW = w2 / (amount + 1)
	let points = []
	for (let i = 1; i <= amount; i++) {
		points.push([-w2 / 2 + i * stepW - tw / 2, top + h1])
	}
	let thrust = {
		h,
		h1,
		h2,
		w1,
		w2,
		tw,
		top,
		amount,
		stepW,
		color,
		points,
		path: getThrustPath(top, w1, h1, w2),
		path2: getThrustPath2(points, tw, h2),
		hitMaskPath: new Path2D(),
		hp,
		maxHp: hp
	}
	return thrust
}

function getWeapons(rn, wings, color, hp) {
	let amount = Math.ceil(rn() * 3)
	let bulletColor = [
		Math.floor(155 + 100 * rn()),
		Math.floor(155 + 100 * rn()),
		Math.floor(155 + 100 * rn())
	]
	let w = 0.1 + rn() * 0.15
	let leftest = Math.max.apply(
		null,
		wings.list.map(wing => wing.bottomW)
	)
	let rightest = Math.min.apply(
		null,
		wings.list.map(wing => wing.bottomW)
	)
	let x = 0 - leftest / 2 + rn() * (leftest / 2 - amount * w)
	let margin = Math.max((0 - x - amount * w) / (amount + 1), 0)
	let h = wings.maxH * 1.2 * rn()
	let top = wings.maxY - wings.maxH

	let topW1 = (0.3 + rn() * 0.5) * w
	let topW2 = w
	let h1 = h * rn()
	let h2 = h - h1
	let ps = [
		[-topW1 / 2, 0],
		[-topW1 / 2, h1],
		[-topW2 / 2, h1],
		[-topW2 / 2, h1 + h2],
		[topW2 / 2, h1 + h2],
		[topW2 / 2, h1],
		[topW1 / 2, h1],
		[topW1 / 2, 0]
	]
	let path = new Path2D()
	path.rect(x, top, (w + margin) * amount * 2 + margin * 2, h)
	let isRound = rn() < 0.5

	return {
		topW1,
		topW2,
		h1,
		h2,
		w,
		h,
		x,
		top,
		margin,
		amount,
		leftest,
		rightest,
		color,
		bulletColor,
		isRound,
		singlePath: getWeaponPath(ps, isRound),
		hp,
		maxHp: hp,
		hitMaskPath: new Path2D(),
		path
	}
}

function getWings(hull, rn, color, col2, hp) {
	let maxW = hull.bottomW
	let maxH = hull.h
	let maxY = -hull.h / 2
	let minY = -hull.h / 2
	let amount = Math.ceil(rn() * 4)
	let list = []
	for (let i = 0; i < amount; i++) {
		let topW = rn() * 3 + Math.min(hull.bottomW, hull.topW)
		let bottomW = rn() * 4 + Math.min(hull.bottomW, hull.topW)
		let offsetTop = (rn() * hull.h) / 2
		let h0 = hull.h * (0.3 * rn())
		let h1 = h0 + (hull.h - h0) * (rn() * 0.2 + 0.1)
		let h2 = h1 + (hull.h - h1) * rn() * (0.5 + 0.3)
		let h3 = h2 + (hull.h - h2) * rn()

		let isRound = rn() < 0.5

		list.push({
			topW,
			bottomW,
			h0,
			h1,
			h2,
			h3,
			offsetTop,
			hitMaskPath: new Path2D(),
			color: rn() < 0.3 ? color : col2,
			isRound,
			path: getWingPath(topW, bottomW, h0, h1, h2, h3, -hull.h / 2, isRound)
		})

		if (minY > offsetTop - hull.h) {
			minY = offsetTop - hull.h
		}
		if (maxY < offsetTop + h3 - hull.h) {
			maxY = offsetTop + h3 - hull.h
			maxW = bottomW
			maxH = h3
		}
	}
	let path = new Path2D()
	list.forEach(wing => path.addPath(wing.path))

	return {
		maxW,
		maxY,
		minY,
		maxH,
		amount,
		list,
		path,
		color,
		hitMaskPath: new Path2D(),
		hp,
		maxHp: hp
	}
}

function getHull(rn, color, hp) {
	const topW = rndBtwn(0.5, 1.5, rn)
	const h = rndBtwn(0.5, 2.5, rn)
	let opts = {
		topW,
		bottomW: rndBtwn(0.5, 2, rn),
		h,
		controlTop: rn() * h,
		controlSide: (topW / 2) * rn(),
		windowSize: rndBtwn(0.2, 0.5, rn)
	}
	opts.path = getHullPath(opts)
	opts.hp = hp * 3
	opts.maxHp = hp * 3
	opts.hitMaskPath = new Path2D()
	opts.color = color
	return opts
}
function getMerged(a, b, tween) {
	return a * tween + b * (1 - tween)
}
function getMergedAttrs(comp1, comp2, attrs, tween) {
	let obj = {}
	attrs.forEach(attr => {
		obj[attr] = getMerged(comp1[attr], comp2[attr], tween)
	})
	obj.color = getMergedColor(comp1.color, comp2.color, tween)
	obj.hitMaskPath = new Path2D()
	obj.hp = obj.maxHp
	return obj
}
export function getMergedHull(hull1, hull2, tween) {
	let obj = getMergedAttrs(
		hull1,
		hull2,
		[
			"topW",
			"bottomW",
			"h",
			"controlTop",
			"controlSide",
			"windowSize",
			"maxHp"
		],
		tween
	)
	obj.path = getHullPath(obj)
	return obj
}
export function getMergedWings(hullH, wings1, wings2, tween) {
	let wingArr = []
	for (let i = 0; i < wings2.list.length; i++) {
		if (wings1.list[i] && wings2.list[i]) {
			let wing1 = wings1.list[i]
			let wing2 = wings2.list[i]
			let wing = getMergedAttrs(
				wing1,
				wing2,
				["topW", "bottomW", "h0", "h1", "h2", "h3"],
				tween
			)
			wing.offsetTop = getMerged(wing1.offsetTop, wing2.offsetTop, tween)
			wing.path = getWingPath(
				wing.topW,
				wing.bottomW,
				wing.h0,
				wing.h1,
				wing.h2,
				wing.h3,
				-hullH / 2,
				wing1.isRound ^ wing2.isRound
			)

			wingArr.push(wing)
		} else {
			wingArr.push(wings2.list[i])
		}
	}
	let wingPath = new Path2D()
	wingArr.forEach(wing => wingPath.addPath(wing.path))
	let wings = getMergedAttrs(
		wings1,
		wings2,
		["maxW", "maxY", "minY", "maxH", "maxHp"],
		tween
	)
	wings.amount = wings2.amount
	wings.list = wingArr
	wings.path = wingPath
	return wings
}

export const getMergedWeapons = (weapons1, weapons2, tween) => {
	let weapons = getMergedAttrs(
		weapons1,
		weapons2,
		["w", "x", "top", "margin", "h", "topW1", "topW2", "h1", "h2", "maxHp"],
		tween
	)

	let ps = [
		[-weapons.topW1 / 2, 0],
		[-weapons.topW1 / 2, weapons.h1],
		[-weapons.topW2 / 2, weapons.h1],
		[-weapons.topW2 / 2, weapons.h1 + weapons.h2],
		[weapons.topW2 / 2, weapons.h1 + weapons.h2],
		[weapons.topW2 / 2, weapons.h1],
		[weapons.topW1 / 2, weapons.h1],
		[weapons.topW1 / 2, 0]
	]
	weapons.amount = weapons2.amount

	weapons.path = new Path2D()
	weapons.path.rect(
		weapons.x,
		weapons.top,
		(weapons.w + weapons.margin) * weapons.amount * 2 + weapons.margin * 2,
		weapons.h
	)

	weapons.isRound = weapons1.isRound ^ weapons2.isRound
	weapons.leftest = Math.min(weapons1.leftest, weapons2.leftest)
	weapons.rightest = Math.max(weapons1.rightest, weapons2.rightest)
	weapons.singlePath = getWeaponPath(ps, weapons.isRound)
	weapons.bulletColor = getMergedColor(
		weapons1.bulletColor,
		weapons2.bulletColor,
		tween
	)
	return weapons
}
export const getMergedThrust = (hull, thrust1, thrust2, tween) => {
	let thrust = getMergedAttrs(
		thrust1,
		thrust2,
		["h", "w1", "w2", "h1", "h2", "tw", "maxHp"],
		tween
	)
	thrust.amount = thrust2.amount
	thrust.top = getMerged(thrust1.top, hull.h / 2, tween)
	thrust.stepW = thrust.w2 / (thrust.amount + 1)
	thrust.points = []
	for (let i = 1; i <= thrust.amount; i++) {
		thrust.points.push([
			-thrust.w2 / 2 + i * thrust.stepW - thrust.tw / 2,
			thrust.top + thrust.h1
		])
	}
	thrust.path = getThrustPath(thrust.top, thrust.w1, thrust.h1, thrust.w2)
	thrust.path2 = getThrustPath2(thrust.points, thrust.tw, thrust.h2)

	return thrust
}
function getMergedColor(col1, col2, tween) {
	return [
		col1[0] * tween + (1 - tween) * col2[0],
		col1[1] * tween + (1 - tween) * col2[1],
		col1[2] * tween + (1 - tween) * col2[2]
	]
}
function getHullPath(opts) {
	let path = new Path2D()
	path.moveTo(-opts.topW / 2, -opts.h / 2)
	let t2 = opts.topW / 2
	let h2 = opts.h / 2
	path.bezierCurveTo(
		-t2 + opts.controlSide,
		-h2 - opts.controlTop,
		t2 - opts.controlSide,
		-h2 - opts.controlTop,
		t2,
		-h2
	)
	path.lineTo(opts.bottomW / 2, h2)
	path.lineTo(-opts.bottomW / 2, h2)
	path.lineTo(-opts.topW / 2, -h2)
	return path
}
function getThrustPath(y, w1, h1, w2) {
	let path = new Path2D()
	path.moveTo(-w1 / 2, y)
	path.lineTo(w1 / 2, y)
	path.lineTo(w2 / 2, y + h1)
	path.lineTo(-w2 / 2, y + h1)
	path.lineTo(-w1 / 2, y)

	return path
}
function getThrustPath2(ps, tw, h2) {
	let path = new Path2D()

	ps.forEach(p => {
		path.rect(p[0], p[1], tw, h2)
	})

	return path
}
function getWeaponPath(ps, isRound) {
	let path = new Path2D()

	if (isRound) {
		path.moveTo(ps[0][0], ps[0][1])
		let i = 1
		for (i = 1; i < ps.length - 2; i++) {
			let xc = (ps[i][0] + ps[i + 1][0]) / 2
			let yc = (ps[i][1] + ps[i + 1][1]) / 2

			path.quadraticCurveTo(ps[i][0], ps[i][1], xc, yc)
		}
		path.quadraticCurveTo(ps[i][0], ps[i][1], ps[i + 1][0], ps[i + 1][1])
	} else {
		path.moveTo(ps[0][0], ps[0][1])
		for (let i = 1; i < ps.length; i++) {
			path.lineTo(ps[i][0], ps[i][1])
		}
	}
	path.lineTo(ps[0][0], ps[0][1])
	return path
}
function getWingPath(w1, w2, h1, h2, h3, h4, y, isRound) {
	let path = new Path2D()
	let ps = [
		[0, y + h1],
		[-w1 / 2, y + h2],
		[-w2 / 2, y + h3],
		[0, y + h4],
		[w2 / 2, y + h3],
		[w1 / 2, y + h2],
		[0, y + h1]
	]
	if (isRound) {
		path.moveTo(ps[0][0], ps[0][1])
		let i = 1
		for (i = 1; i < ps.length - 2; i++) {
			let xc = (ps[i][0] + ps[i + 1][0]) / 2
			let yc = (ps[i][1] + ps[i + 1][1]) / 2

			path.quadraticCurveTo(ps[i][0], ps[i][1], xc, yc)
		}
		path.quadraticCurveTo(ps[i][0], ps[i][1], ps[i + 1][0], ps[i + 1][1])
	} else {
		path.moveTo(ps[0][0], ps[0][1])
		for (let i = 1; i < ps.length; i++) {
			path.lineTo(ps[i][0], ps[i][1])
		}
	}
	return path
}

function getRandomShipColor(rn) {
	return [
		Math.floor(55 + rn() * 50),
		Math.floor(55 + rn() * 50),
		Math.floor(55 + rn() * 50)
	]
}
function getRandomSecondaryColor(rn) {
	let rnd = Math.floor(rn() * 155)
	return [rnd, rnd, rnd]
}
