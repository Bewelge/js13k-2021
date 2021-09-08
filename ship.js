import { getNewRng } from "./Rng.js"

export function getShipOpts(seed, level) {
	let rn = getNewRng(seed)
	return createRandomShip(rn, level)
}

const createRandomShip = (rn, level) => {
	let col1 = getRandomShipColor(rn)
	let col2 = getRandomSecondaryColor(rn)

	let hp = Math.ceil(2 + 1000 * rn() * level)
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
	let colPath = new Path2D()
	colPath.rect(x, top, (w + margin) * amount * 2 + margin * 2, h)
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
		path: getWeaponPath(ps, isRound),
		hp,
		maxHp: hp,
		hitMaskPath: new Path2D(),
		colPath
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

	let wings = {
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
	return wings
}

function getHull(rn, color, hp) {
	let topW = rn() * 1 + 0.5
	let bottomW = rn() * 1.5 + 0.5
	let h = rn() * 2 + 0.5
	let controlTop = h * rn()
	let controlSide = (topW / 2) * rn()
	let path = getHullPath({ topW, bottomW, h, controlTop, controlSide })
	let windowSize = rn() * 0.3 + 0.2
	return {
		topW,
		bottomW,
		h,
		controlTop,
		controlSide,
		windowSize,
		path,
		hitMaskPath: new Path2D(),
		color: color,
		hits: [],
		hp: hp * 3,
		maxHp: hp * 3
	}
}
function getMerged(a, b, tween) {
	return a * tween + b * (1 - tween)
}
function getMergedAttrs(comp1, comp2, attrs, tween) {
	let obj = {}
	attrs.forEach(attr => {
		obj[attr] = getMerged(comp1[attr], comp2[attr], tween)
	})
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
	obj.hitMaskPath = new Path2D()
	obj.color = getMergedColor(hull1.color, hull2.color, tween)
	obj.hp = obj.maxHp
	obj.hits = []
	return obj
}
export function getMergedWings(hullH, wings1, wings2, tween) {
	let wingArr = []
	for (let i = 0; i < wings2.list.length; i++) {
		if (wings1.list[i] && wings2.list[i]) {
			let wing1 = wings1.list[i]
			let wing2 = wings2.list[i]
			const topW = getMerged(wing1.topW, wing2.topW, tween)
			const bottomW = getMerged(wing1.bottomW, wing2.bottomW, tween)
			const h0 = getMerged(wing1.h0, wing2.h0, tween)
			const h1 = getMerged(wing1.h1, wing2.h1, tween)
			const h2 = getMerged(wing1.h2, wing2.h2, tween)
			const h3 = getMerged(wing1.h3, wing2.h3, tween)
			let wing = {
				topW: topW,
				bottomW: bottomW,
				h0: h0,
				h1: h1,
				h2: h2,
				h3: h3,
				offsetTop: getMerged(wing1.offsetTop, wing2.offsetTop, tween),
				hitMaskPath: new Path2D(),
				color: getMergedColor(wing1.color, wing2.color, tween),
				path: getWingPath(
					topW,
					bottomW,
					h0,
					h1,
					h2,
					h3,
					-hullH / 2,
					wing1.isRound ^ wing2.isRound
				)
			}
			wingArr.push(wing)
		} else {
			wingArr.push(wings2.list[i])
		}
	}
	let wingPath = new Path2D()
	wingArr.forEach(wing => wingPath.addPath(wing.path))
	return {
		maxW: getMerged(wings1.maxW, wings2.maxW, tween),
		maxY: getMerged(wings1.maxY, wings2.maxY, tween),
		minY: getMerged(wings1.minY, wings2.minY, tween),
		maxH: getMerged(wings1.maxH, wings2.maxH, tween),
		amount: wings2.amount,
		list: wingArr,
		path: wingPath,
		color: getMergedColor(wings1.color, wings2.color, tween),
		hitMaskPath: new Path2D(),
		maxHp: getMerged(wings1.maxHp, wings2.maxHp, tween),
		hp: getMerged(wings1.maxHp, wings2.maxHp, tween)
	}
}

export const getMergedWeapons = (weapons1, weapons2, tween) => {
	const weaponW = getMerged(weapons1.w, weapons2.w, tween)
	const weaponX = getMerged(weapons1.x, weapons2.x, tween)
	let colPath = new Path2D()
	const weaponTop = getMerged(weapons1.top, weapons2.top, tween)
	const margin = getMerged(weapons1.margin, weapons2.margin, tween)
	const amount = weapons2.amount
	const h = getMerged(weapons1.h, weapons2.h, tween)
	colPath.rect(
		weaponX,
		weaponTop,
		(weaponW + margin) * amount * 2 + margin * 2,
		h
	)
	const weaponTopW1 = getMerged(weapons1.topW1, weapons2.topW1, tween)
	const weaponTopW2 = getMerged(weapons1.topW2, weapons2.topW2, tween)
	const weaponH1 = getMerged(weapons1.h1, weapons2.h1, tween)
	const weaponH2 = getMerged(weapons1.h2, weapons2.h2, tween)
	let ps = [
		[-weaponTopW1 / 2, 0],
		[-weaponTopW1 / 2, weaponH1],
		[-weaponTopW2 / 2, weaponH1],
		[-weaponTopW2 / 2, weaponH1 + weaponH2],
		[weaponTopW2 / 2, weaponH1 + weaponH2],
		[weaponTopW2 / 2, weaponH1],
		[weaponTopW1 / 2, weaponH1],
		[weaponTopW1 / 2, 0]
	]
	let isRound = weapons1.isRound ^ weapons2.isRound
	return {
		topW1: weaponTopW1,
		topW2: weaponTopW2,
		h1: weaponH1,
		h2: weaponH2,
		w: weaponW,
		h: h,
		x: weaponX,
		top: weaponTop,
		margin: margin,
		amount: amount,
		leftest: Math.min(weapons1.leftest, weapons2.leftest),
		rightest: Math.max(weapons1.rightest, weapons2.rightest),
		color: getMergedColor(weapons1.color, weapons2.color, tween),
		bulletColor: getMergedColor(
			weapons1.bulletColor,
			weapons2.bulletColor,
			tween
		),
		isRound,
		path: getWeaponPath(ps, isRound),
		maxHp: getMerged(weapons1.maxHp, weapons2.maxHp, tween),
		hp: getMerged(weapons1.maxHp, weapons2.maxHp, tween),
		hitMaskPath: new Path2D(),
		colPath
	}
}
export const getMergedThrust = (hull, thrust1, thrust2, tween) => {
	const amount = thrust2.amount
	const w1 = getMerged(thrust1.w1, hull.bottomW, tween)
	const w2 = getMerged(thrust1.w2, thrust2.w2, tween)
	const h1 = getMerged(thrust1.h1, thrust2.h1, tween)
	const h2 = getMerged(thrust1.h2, thrust2.h2, tween)
	const tw = getMerged(thrust1.tw, thrust2.tw, tween)
	const top = getMerged(thrust1.top, hull.h / 2, tween)
	const stepW = w2 / (amount + 1)
	let ps = []
	for (let i = 1; i <= amount; i++) {
		ps.push([-w2 / 2 + i * stepW - tw / 2, top + h1])
	}
	return {
		h: getMerged(thrust1.h, thrust2.h, tween),
		h1: h1,
		h2: h2,
		w1: w1,
		w2: w2,
		tw: tw,
		top: top,
		amount: amount,
		stepW: stepW,
		color: getMergedColor(thrust1.color, thrust2.color, tween),
		points: ps,
		path: getThrustPath(top, w1, h1, w2),
		path2: getThrustPath2(ps, tw, h2),
		hitMaskPath: new Path2D(),
		maxHp: getMerged(thrust1.maxHp, thrust2.maxHp, tween),
		hp: getMerged(thrust1.maxHp, thrust2.maxHp, tween)
	}
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
	path.bezierCurveTo(
		-opts.topW / 2 + opts.controlSide,
		-opts.h / 2 - opts.controlTop,
		opts.topW / 2 - opts.controlSide,
		-opts.h / 2 - opts.controlTop,
		opts.topW / 2,
		-opts.h / 2
	)
	path.lineTo(opts.bottomW / 2, +opts.h / 2)
	path.lineTo(-opts.bottomW / 2, +opts.h / 2)
	path.lineTo(-opts.topW / 2, -opts.h / 2)
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
	// ps.forEach(pat => path.quadraticCurveTo())
	// path.moveTo(0, y - h / 2)

	// path.bezierCurveTo(
	// 	-topW / 2 + controlSide,
	// 	y - h / 2 - controlBottom,
	// 	topW / 2 - controlSide,
	// 	y - h / 2 - controlBottom,
	// 	topW / 2,
	// 	y - h / 2
	// )
	// path.lineTo(0 + bottomW / 2, y + 0 + h / 2)
	// path.lineTo(0 - bottomW / 2, y + 0 + h / 2)
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
