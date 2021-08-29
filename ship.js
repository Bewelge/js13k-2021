import { getNewRng } from "./Rng.js"
import { rgba } from "./Util.js"

export function getShipOpts(seed) {
	let rn = getNewRng(seed)
	return createRandomShip(rn)
}

const createRandomShip = rn => {
	let col1 = getRandomShipColor(rn)
	let col2 = getRandomSecondaryColor(rn)

	let hull = getHull(rn, col1)

	let wings = getWings(hull, rn, col1, col2)

	let thrust = getThrust(rn, hull, col1)

	let weapons = getWeapons(rn, wings, col2)
	return {
		hull: hull,
		wings: wings,
		thrust: thrust,
		weapons: weapons
	}
}

function getThrust(rn, hull, col1) {
	let thrustAmount = Math.ceil(rn() * 5)
	let thrustW1 = hull.bottomW
	let thrustW2 = 2 * rn() * hull.bottomW
	let singleThrustW = (2.5 * rn() * thrustW2) / (thrustAmount + 2)
	let thrustTop = hull.h / 2
	let thrustH = Math.ceil(1000 * rn() * 2) / 1000
	let thrustH1 = (0.5 + 0.5 * Math.random()) * thrustH
	let thrustH2 = thrustH - thrustH1
	let stepW = thrustW2 / (thrustAmount + 1)
	let ps = []
	for (let i = 1; i <= thrustAmount; i++) {
		ps.push([
			-thrustW2 / 2 + i * stepW - singleThrustW / 2,
			thrustTop + thrustH1
		])
	}
	let thrust = {
		h: thrustH,
		h1: thrustH1,
		h2: thrustH2,
		w2: thrustW2,
		tw: singleThrustW,
		top: thrustTop,
		amount: thrustAmount,
		stepW: stepW,
		color: col1,
		points: ps,
		path: getThrustPath(thrustTop, thrustW1, thrustH1, thrustW2),
		path2: getThrustPath2(ps, singleThrustW, thrustH2),
		hitMaskPath: new Path2D(),
		hp: 100
	}
	return thrust
}

function getWeapons(rn, wings, col2) {
	let weaponAmount = Math.ceil(rn() * 3)
	let weaponW = 0.1 + rn() * 0.15
	let leftest = Math.max.apply(
		null,
		wings.list.map(wing => wing.bottomW)
	)
	let rightest = Math.min.apply(
		null,
		wings.list.map(wing => wing.bottomW)
	)
	let weaponX = 0 - leftest / 2 + rn() * (leftest / 2 - weaponAmount * weaponW)
	let weaponMargin = Math.max(
		(0 - weaponX - weaponAmount * weaponW) / (weaponAmount + 1),
		0
	)
	let weaponH = wings.maxH * 1.2 * rn()
	let weaponTop = 0 + wings.maxY - wings.maxH - weaponH / 3

	let weaponTopW1 = (0.3 + Math.random() * 0.5) * weaponW
	let weaponTopW2 = weaponW
	let weaponH1 = weaponH * Math.random()
	let weaponH2 = weaponH - weaponH1
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
	let colPath = new Path2D()
	colPath.rect(
		weaponX,
		weaponTop,
		(weaponW + weaponMargin) * weaponAmount * 2 + weaponMargin * 2,
		weaponH
	)

	let weapons = {
		w: weaponW,
		h: weaponH,
		x: weaponX,
		top: weaponTop,
		margin: weaponMargin,
		amount: weaponAmount,
		leftest,
		rightest,
		color: col2,
		path: getWeaponPath(ps, rn() < 0.5),
		hp: 100,
		hitMaskPath: new Path2D(),
		colPath
	}
	return weapons
}

function getWings(hull, rn, col1, col2) {
	let wingMaxBottomW = hull.bottomW
	let maxWingH = hull.h
	let maxWingY = hull.h / 2
	let wingAmount = Math.ceil(rn() * 4)
	let wingArr = []
	for (let i = 0; i < wingAmount; i++) {
		let wingTopW = rn() * 3 + Math.min(hull.bottomW, hull.topW)
		let wingBottomW = rn() * 4 + Math.min(hull.bottomW, hull.topW)
		let wingOffsetTop = (rn() * hull.h) / 2
		let wingH0 = hull.h * (0.3 * rn())
		let wingH1 = wingH0 + (hull.h - wingH0) * (rn() * 0.2 + 0.1)
		let wingH2 = wingH1 + (hull.h - wingH1) * rn() * (0.5 + 0.3)
		let wingH3 = wingH2 + (hull.h - wingH2) * rn()

		wingArr.push({
			topW: wingTopW,
			bottomW: wingBottomW,
			h0: wingH0,
			h1: wingH1,
			h2: wingH2,
			h3: wingH3,
			offsetTop: wingOffsetTop,
			hp: 100,
			hitMaskPath: new Path2D(),
			color: rn() < 0.3 ? col1 : col2,
			path: getWingPath(
				wingTopW,
				wingBottomW,
				wingH0,
				wingH1,
				wingH2,
				wingH3,
				-hull.h / 2,
				rn() < 0.5
			)
		})
	}
	let wingPath = new Path2D()
	wingArr.forEach(wing => wingPath.addPath(wing.path))

	let wings = {
		maxW: wingMaxBottomW,
		maxY: maxWingY,
		maxH: maxWingH,
		amount: wingAmount,
		list: wingArr,
		path: wingPath,
		color: col1,
		hitMaskPath: new Path2D(),
		hp: 100
	}
	return wings
}

function getHull(rn, col) {
	let hullTopW = rn() * 1 + 0.5
	let hullBottomW = rn() * 1.5 + 0.5
	let hullH = rn() * 2 + 0.5
	let hullControlTop = hullH * rn()
	let hullControlSide = (hullTopW / 2) * rn()
	let hullPath = getHullPath(
		hullTopW,
		hullBottomW,
		hullH,
		0,
		hullControlTop,
		hullControlSide
	)
	let hitMaskPath = new Path2D()
	let windowSize = rn() * 0.3 + 0.2
	let hull = {
		topW: hullTopW,
		bottomW: hullBottomW,
		h: hullH,
		controlTop: hullControlTop,
		controlSide: hullControlSide,
		windowSize: windowSize,
		path: hullPath,
		hitMaskPath: hitMaskPath,
		color: col,
		hits: [],
		hp: 100
	}
	return hull
}

function getHullPath(topW, bottomW, h, y, controlTop, controlSide) {
	let path = new Path2D()
	path.moveTo(-topW / 2, y - h / 2)
	path.bezierCurveTo(
		-topW / 2 + controlSide,
		y - h / 2 - controlTop,
		topW / 2 - controlSide,
		y - h / 2 - controlTop,
		topW / 2,
		y - h / 2
	)
	path.lineTo(bottomW / 2, y + h / 2)
	path.lineTo(-bottomW / 2, y + h / 2)
	path.lineTo(-topW / 2, y - h / 2)
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
