import { getNewRng } from "./Rng.js"

export function getShipOpts(seed) {
	let rn = getNewRng(seed)
	return createRandomShip(rn)
}
export const getPaths = (c, x, y, size, opts, zoom, rot) => {}
export const renderShip = (
	c,
	x,
	y,
	size,
	opts,
	zoom,
	rot,
	sunAng,
	sunDis,
	isThrust,
	isThrustLeft,
	isThrustRight
) => {
	c.save()
	c.translate(x, y)
	c.scale(zoom * size, zoom * size)
	c.rotate(rot + Math.PI * 0.5)

	c.fillStyle = "rgba(250,50,50,1)"
	c.beginPath()
	c.fill(opts.weapons.path)
	c.closePath()
	// shadePath(
	// 	c,
	// 	opts.weapons.path,
	// 	"rgba(50,50,50,1)",
	// 	"rgba(120,120,120,1)",
	// 	sunAng,
	// 	sunDis * 0.1
	// )
	for (let i = 0; i < opts.weapons.amount; i++) {
		// c.fillRect(
		// 	opts.weapons.x + i * (opts.weapons.w + opts.weapons.margin),
		// 	opts.weapons.top,
		// 	opts.weapons.w,
		// 	opts.weapons.h
		// )
		// c.fillRect(
		// 	-opts.weapons.x -
		// 		opts.weapons.w -
		// 		i * (opts.weapons.w + opts.weapons.margin),
		// 	opts.weapons.top,
		// 	opts.weapons.w,
		// 	opts.weapons.h
		// )
		// c.fillRect(
		// 	-opts.weapons.x,
		// 	opts.weapons.top + opts.weapons.h / 2,
		// 	opts.weapons.x * 2,
		// 	0.25
		// )
	}

	// shadePath(
	// 	c,
	// 	opts.wings.path,
	// 	"rgba(50,50,50,1)",
	// 	"rgba(120,120,120,1)",
	// 	sunAng,
	// 	sunDis
	// )

	for (let i = 0; i < opts.wings.amount; i++) {
		let wing = opts.wings.list[i]
		shadePath(
			c,
			wing.path,
			"rgba(50,50,50,1)",
			"rgba(120,120,120,1)",
			sunAng,
			sunDis
		)
		c.save()
		c.clip(opts.wings.hitMaskPath)
		c.fillStyle = "rgba(0,0,0,0.7)"
		c.fill(wing.path)
		c.restore()
		// doRectPath(
		// 	c,
		// 	wing.topW,
		// 	wing.bottomW,
		// 	wing.h,
		// 	wing.offsetTop,
		// 	"rgba(50,50,50,1)",
		// 	"rgba(120,120,120,1)",
		// 	sunAng,
		// 	sunDis
		// )
	}

	shadePath(
		c,
		opts.hull.path,
		"rgba(50,50,50,1)",
		"rgba(120,120,120,1)",
		sunAng,
		sunDis
	)
	c.save()
	c.clip(opts.hull.hitMaskPath)
	c.fillStyle = "rgba(0,0,0,0.7)"
	c.fill(opts.hull.path)
	c.restore()
	// doTopRoundedRect(
	// 	c,
	// 	opts.hull.topW,
	// 	opts.hull.bottomW,
	// 	opts.hull.h,
	// 	0,
	// 	opts.hull.controlTop,
	// 	opts.hull.controlSide,
	// 	"rgba(50,50,50,1)",
	// 	"rgba(120,120,120,1)",
	// 	sunAng,
	// 	sunDis
	// )
	c.fillStyle = "green"
	// opts.hull.hits.forEach(hit => {
	// 	c.fillRect(hit[0], hit[1], 0.01, 0.01)
	// })

	let lgr = c.createLinearGradient(
		0 - (opts.hull.topW / 2) * opts.hull.windowSize,
		0,
		0 + (opts.hull.topW / 2) * opts.hull.windowSize,
		0
	)
	lgr.addColorStop(0, "rgba(50,250,250,1)")
	lgr.addColorStop(1, "rgba(50,150,150,1)")

	let lgr2 = c.createLinearGradient(
		0 - (opts.hull.topW / 2) * opts.hull.windowSize,
		0,
		0 + (opts.hull.topW / 2) * opts.hull.windowSize,
		0
	)
	lgr2.addColorStop(0, "rgba(50,250,250,1)")
	lgr2.addColorStop(1, "rgba(255,255,255,1)")
	doTopRoundedRect(
		c,
		opts.hull.topW * opts.hull.windowSize,
		opts.hull.bottomW * opts.hull.windowSize,
		opts.hull.h * opts.hull.windowSize * 0.5,
		-0,
		opts.hull.controlTop,
		opts.hull.controlSide * opts.hull.windowSize,
		lgr,
		lgr2,
		sunAng,
		sunDis
	)

	let stepW = opts.wings.maxW / (opts.thrust.amount + 1)
	for (let i = 1; i <= opts.thrust.amount; i++) {
		c.save()
		c.beginPath()
		c.rect(
			0 - opts.wings.maxW / 2 + i * stepW - opts.thrust.w / 2,
			0 + opts.thrust.top,
			opts.thrust.w,
			opts.thrust.h
		)

		c.fillStyle = "rgba(120,120,120,1)"
		c.fill()
		c.clip()
		c.translate((Math.cos(sunAng) * opts.thrust.w * sunDis) / 4, 0)
		c.fillStyle = "rgba(50,50,50,1)"
		c.fillRect(
			0 - opts.wings.maxW / 2 + i * stepW - opts.thrust.w / 2,
			0 + opts.thrust.top,
			opts.thrust.w,
			opts.thrust.h
		)
		c.closePath()

		c.restore()

		c.fillStyle = "rgba(255,55,55,0.8)"

		if (isThrust) {
			c.fillRect(
				0 - opts.wings.maxW / 2 + i * stepW - opts.thrust.w / 2,
				0 + opts.thrust.top + opts.thrust.h,
				opts.thrust.w,
				Math.random() * 0.15 + 0.1
			)
			c.fillStyle = "rgba(255,255,55,0.8)"

			c.fillRect(
				0 - opts.wings.maxW / 2 + i * stepW - opts.thrust.w / 2,
				0 + opts.thrust.top + opts.thrust.h,
				opts.thrust.w,
				Math.random() * 0.15 + 0.1
			)
		}
		if (isThrustLeft && i == 1) {
			let wd = Math.random() * 0.15 + 0.1
			c.fillRect(
				0 - opts.wings.maxW / 2 + i * stepW - opts.thrust.w / 2 - wd,
				0 + opts.thrust.top + opts.thrust.h / 2,
				wd,
				opts.thrust.h / 2
			)
			c.fillStyle = "rgba(255,255,55,0.8)"
			wd = Math.random() * 0.15 + 0.1
			c.fillRect(
				0 - opts.wings.maxW / 2 + i * stepW - opts.thrust.w / 2 - wd,
				0 + opts.thrust.top + opts.thrust.h / 2,
				wd,
				opts.thrust.h / 2
			)
		}
		if (isThrustRight && i == opts.thrust.amount) {
			let wd = Math.random() * 0.15 + 0.1
			c.fillRect(
				0 - opts.wings.maxW / 2 + i * stepW - opts.thrust.w / 2 + opts.thrust.w,
				0 + opts.thrust.top + opts.thrust.h / 2,
				wd,
				opts.thrust.h / 2
			)
			c.fillStyle = "rgba(255,255,55,0.8)"
			wd = Math.random() * 0.15 + 0.1
			c.fillRect(
				0 - opts.wings.maxW / 2 + i * stepW - opts.thrust.w / 2 + opts.thrust.w,
				0 + opts.thrust.top + opts.thrust.h / 2,
				wd,
				opts.thrust.h / 2
			)
		}
	}
	c.restore()
}

const createRandomShip = rn => {
	let hull = getHull(rn)

	let wings = getWings(hull, rn)

	let thrustAmount = Math.ceil(rn() * 5)
	let thrustW1 = hull.bottomW
	let thrustW2 = 1.5 * rn() * hull.bottomW
	let singleThrustW = (2.5 * rn() * thrustW2) / (thrustAmount + 2)
	let thrustTop = Math.max(hull.h / 2, wings.maxY)
	let thrustH1 = Math.ceil((1000 * rn() * 0.1) / thrustAmount) / 1000
	let thrustH2 = Math.ceil((1000 * rn() * 0.05) / thrustAmount) / 1000
	let thrust = {
		h1: thrustH1,
		h2: thrustH2,
		w1: thrustW2,
		w2: singleThrustW,
		top: thrustTop,
		amount: thrustAmount,
		path: getThrustPath(
			thrustAmount,
			top,
			singleThrustW,
			thrustW1,
			thrustH1,
			thrustW2,
			thrustH2
		)
	}

	let weapons = getWeapons(rn, wings)
	return {
		hull: hull,
		wings: wings,
		thrust: thrust,
		weapons: weapons
	}
}

function getWeapons(rn, wings) {
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
	let weapons = {
		w: weaponW,
		h: weaponH,
		x: weaponX,
		top: weaponTop,
		margin: weaponMargin,
		amount: weaponAmount,
		leftest,
		rightest,
		path: getWeaponPath(
			weaponAmount,
			weaponX,
			weaponTop,
			weaponW,
			weaponH,
			weaponMargin
		)
	}
	return weapons
}

function getWings(hull, rn) {
	let wingMaxBottomW = hull.bottomW
	let maxWingH = hull.h
	let maxWingY = hull.h / 2
	let wingAmount = Math.ceil(rn() * 4)
	let wingArr = []
	for (let i = 0; i < wingAmount; i++) {
		let wingTopW = rn() * 1 + Math.min(hull.bottomW, hull.topW)
		let wingBottomW = rn() * 2 + Math.min(hull.bottomW, hull.topW)
		let wingOffsetTop = (rn() * hull.h) / 2
		let wingH0 = hull.h * (0.3 * rn())
		let wingH1 = wingH0 + (hull.h - wingH0) * (rn() * 0.2 + 0.1)
		let wingH2 = wingH1 + (hull.h - wingH1) * rn() * (0.5 + 0.3)
		let wingH3 = wingH2 + (hull.h - wingH2) * rn()
		// doRectPath(c,wingTopW,wingBottomW,wingH,wingOffsetTop,"rgba(50,50,50,1)","rgba(20,20,20,1)",sunAng,3)
		wingArr.push({
			topW: wingTopW,
			bottomW: wingBottomW,
			h0: wingH0,
			h1: wingH1,
			h2: wingH2,
			h3: wingH3,
			offsetTop: wingOffsetTop,
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

		// if (maxWingY < wingH / 2 + wingOffsetTop) {
		// 	maxWingH = wingH
		// 	wingMaxBottomW = Math.max(wingMaxBottomW, wingBottomW)
		// 	maxWingY = Math.max(maxWingY, wingH / 2 + wingOffsetTop)
		// }
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
		hitMaskPath: new Path2D()
	}
	return wings
}

function getHull(rn) {
	let hullTopW = rn() * 1 + 0.5
	let hullBottomW = rn() * 1.5 + 0.5
	let hullH = rn() * 2 + 0.5
	let hullControlTop = hullH * rn()
	let hullControlSide = (hullTopW / 2) * rn()
	let hullPath = getTopRoundedRectPath(
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
		hits: [],
		hp: 100
	}
	return hull
}

function doRectPath(
	c,
	topW,
	bottomW,
	h,
	y,
	color,
	shadeColor,
	shadeDirection,
	shadeOffset
) {
	c.save()
	c.fillStyle = color
	let path = new Path2D()

	path.moveTo(0 - topW / 2, y + 0 - h / 2)
	path.lineTo(0 + topW / 2, y + 0 - h / 2)
	path.lineTo(0 + bottomW / 2, y + 0 + h / 2)
	path.lineTo(0 - bottomW / 2, y + 0 + h / 2)
	c.fillStyle = shadeColor
	c.fill(path)
	c.clip(path)
	c.translate(
		Math.cos(shadeDirection) * shadeOffset,
		Math.sin(shadeDirection) * shadeOffset
	)
	c.fillStyle = color
	c.fill(path)

	c.restore()
}

function doTopRoundedRect(
	c,
	topW,
	bottomW,
	h,
	y,
	controlTop,
	controlSide,
	color,
	shadeColor,
	shadeDirection,
	shadeOffset
) {
	c.save()
	let path = new Path2D()
	path.moveTo(0 - topW / 2, y + 0 - h / 2)
	path.bezierCurveTo(
		0 - topW / 2 + controlSide,
		y + 0 - h / 2 - controlTop,
		0 + topW / 2 - controlSide,
		y + 0 - h / 2 - controlTop,
		0 + topW / 2,
		y + 0 - h / 2
	)
	path.lineTo(0 + bottomW / 2, y + 0 + h / 2)
	path.lineTo(0 - bottomW / 2, y + 0 + h / 2)
	c.fillStyle = shadeColor
	c.fill(path)
	c.clip(path)
	c.translate(
		Math.cos(shadeDirection) * shadeOffset,
		Math.sin(shadeDirection) * shadeOffset
	)
	c.fillStyle = color
	c.fill(path)

	c.restore()
}
function getTopRoundedRectPath(topW, bottomW, h, y, controlTop, controlSide) {
	let path = new Path2D()
	path.moveTo(0 - topW / 2, y + 0 - h / 2)
	path.bezierCurveTo(
		0 - topW / 2 + controlSide,
		y + 0 - h / 2 - controlTop,
		0 + topW / 2 - controlSide,
		y + 0 - h / 2 - controlTop,
		0 + topW / 2,
		y + 0 - h / 2
	)
	path.lineTo(0 + bottomW / 2, y + 0 + h / 2)
	path.lineTo(0 - bottomW / 2, y + 0 + h / 2)
	return path
}
function getThrustPath(amount, tw, y, w1, h1, w2, h2) {
	let path = new Path2D()
	let stepW = w2 / (amount + 1)
	path.moveTo(-w1 / 2, y)
	path.lineTo(w1 / 2, y)
	path.lineTo(w2 / 2, y + h1)
	path.lineTo(-w2 / 2, y + h1)
	path.lineTo(-w1 / 2, y)

	for (let i = 1; i <= amount; i++) {
		let path2 = new Path2D()
		path2.rect(w2 / 2 + i * stepW - tw / 2, y + h1, tw, h2)
		path.addPath(path2)
	}
	return path
}
function getWeaponPath(amount, x, y, w, h, mw) {
	let path = new Path2D()

	for (let i = 0; i < amount; i++) {
		path.rect(x + i * (w + mw), y, w, h)
		path.rect(-x - w - i * (w + mw), y, w, h)
	}
	path.rect(-x, y + h / 2, x * 2, 0.25)
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
function shadePath(c, path, color, shadeColor, shadeDirection, shadeOffset) {
	c.save()
	c.fillStyle = shadeColor
	c.fill(path)
	c.clip(path)
	c.translate(
		Math.cos(shadeDirection) * shadeOffset,
		Math.sin(shadeDirection) * shadeOffset
	)
	c.fillStyle = color
	c.fill(path)

	c.restore()
}
