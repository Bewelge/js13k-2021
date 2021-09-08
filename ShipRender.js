import { rgba, scaleRotate, translateToAndDraw } from "./Util.js"

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
	drawDmg,
	isThrust,
	isThrustLeft,
	isThrustRight,
	overwriteFill
) => {
	translateToAndDraw(c, x, y, () => {
		scaleRotate(c, zoom * size, rot + Math.PI * 0.5)

		if (!opts.weapons.isDead || !drawDmg) {
			renderWeapons(c, opts, sunAng, sunDis, overwriteFill)
		}
		if (!opts.wings.isDead || !drawDmg) {
			renderWings(
				opts,
				c,
				sunAng,
				sunDis,
				isThrustLeft,
				isThrustRight,
				overwriteFill
			)
		}
		if (!opts.hull.isDead || !drawDmg) {
			renderHull(opts, c, sunAng, sunDis, overwriteFill)
		}
		if (!opts.thrust.isDead || !drawDmg) {
			renderThrust(opts, c, sunAng, sunDis, isThrust, overwriteFill)
		}
	})
}
export const renderThrust = (
	opts,
	c,
	sunAng,
	sunDis,
	isThrust,
	overwriteFill
) => {
	let stepW = opts.thrust.w2 / (opts.thrust.amount + 1)
	shadePath(
		c,
		opts.thrust.path,
		overwriteFill || rgb(opts.thrust.color),
		overwriteFill || lighten(opts.thrust.color, 15),
		sunAng,
		sunDis
	)
	c.fillStyle = overwriteFill || rgb(opts.thrust.color)
	shadePath(
		c,
		opts.thrust.path2,
		overwriteFill || rgb(opts.thrust.color),
		overwriteFill || lighten(opts.thrust.color, 15),
		sunAng,
		sunDis * 0.3
	)
	// c.fill(opts.thrust.path2)
	for (let i = 1; i <= opts.thrust.amount; i++) {
		c.fillStyle = "rgba(255,55,55,0.8)"

		if (isThrust) {
			c.fillRect(
				-opts.thrust.w2 / 2 + i * stepW - opts.thrust.tw / 2,
				opts.thrust.top + opts.thrust.h1 + opts.thrust.h2,
				opts.thrust.tw,
				Math.random() * 0.15 + 0.1
			)
			c.fillStyle = overwriteFill || "rgba(255,255,55,0.8)"

			c.fillRect(
				-opts.thrust.w2 / 2 + i * stepW - opts.thrust.tw / 2,
				opts.thrust.top + opts.thrust.h1 + opts.thrust.h2,
				opts.thrust.tw,
				Math.random() * 0.15 + 0.1
			)
		}
	}
}

export const renderHull = (opts, c, sunAng, sunDis, overwriteFill) => {
	shadePath(
		c,
		opts.hull.path,
		overwriteFill || rgb(opts.hull.color),
		overwriteFill || lighten(opts.hull.color, 15),
		sunAng,
		sunDis
	)
	c.save()
	c.clip(opts.hull.hitMaskPath)
	c.fillStyle = overwriteFill || "rgba(0,0,0,0.7)"
	c.fill(opts.hull.path)
	c.restore()

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
	c.save()
	c.scale(opts.hull.windowSize, opts.hull.windowSize)

	shadePath(
		c,
		opts.hull.path,
		overwriteFill || lgr,
		overwriteFill || lgr2,
		sunAng,
		sunDis
	)
	c.restore()
}

export const renderWings = (
	opts,
	c,
	sunAng,
	sunDis,
	isThrustLeft,
	isThrustRight,
	overwriteFill
) => {
	for (let i = 0; i < opts.wings.amount; i++) {
		let wing = opts.wings.list[i]
		shadePath(
			c,
			wing.path,
			overwriteFill || rgb(wing.color),
			overwriteFill || lighten(wing.color, 15),
			sunAng,
			sunDis
		)
		c.save()
		c.clip(opts.wings.hitMaskPath)
		c.fillStyle = overwriteFill || "rgba(0,0,0,0.7)"
		c.fill(wing.path)
		c.restore()
	}

	if (isThrustLeft || isThrustRight) {
		let x = 0
		let y = 0
		let drawThrust = () => {
			c.fillRect(x, y, 0.1, Math.random() * 0.15 + 0.2)
		}

		let dr = () => {
			c.fillStyle = "rgba(255,55,55,0.8)"
			drawThrust()
			c.fillStyle = "rgba(255,255,55,0.8)"
			drawThrust()
		}
		if (isThrustLeft) {
			x = (opts.wings.maxW / 2) * 0.8 - 0.1
			y = opts.wings.maxY
			dr()
		}
		if (isThrustRight) {
			x = (-opts.wings.maxW / 2) * 0.8
			y = opts.wings.maxY
			dr()
		}
	}
}

export const renderWeapons = (c, opts, sunAng, sunDis, overwriteFill) => {
	c.fillStyle = rgb(opts.weapons.color)

	for (let i = 0; i < opts.weapons.amount; i++) {
		let drawAWeapon = () =>
			shadePath(
				c,
				opts.weapons.path,
				overwriteFill || rgb(opts.weapons.color),
				overwriteFill || lighten(opts.weapons.color, 15),
				sunAng,
				sunDis * 0.4
			)

		translateToAndDraw(
			c,
			-opts.weapons.x - i * (opts.weapons.w + opts.weapons.margin),
			opts.weapons.top,
			drawAWeapon
		)
		translateToAndDraw(
			c,
			opts.weapons.x + i * (opts.weapons.w + opts.weapons.margin),
			opts.weapons.top,
			drawAWeapon
		)
	}
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

	c.strokeStyle = "rgba(255,255,255,0.4)"
	c.restore()
}
export function rgb(arr, a = 1) {
	return rgba(arr[0], arr[1], arr[2], a)
}
export function lighten(arr, amnt) {
	return rgb(arr.map(num => Math.min(255, num + amnt)))
}
