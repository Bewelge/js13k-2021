import { rgba } from "./Util.js"

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

	c.fillStyle = rgb(opts.weapons.color)
	if (!opts.weapons.isDead) {
		for (let i = 0; i < opts.weapons.amount; i++) {
			c.save()
			c.translate(
				-opts.weapons.x - i * (opts.weapons.w + opts.weapons.margin),
				opts.weapons.top
			)
			c.fill(opts.weapons.path)
			c.restore()
			c.save()
			c.translate(
				opts.weapons.x + i * (opts.weapons.w + opts.weapons.margin),
				opts.weapons.top
			)
			c.fill(opts.weapons.path)
			c.restore()
		}
	}

	if (!opts.wings.isDead) {
		for (let i = 0; i < opts.wings.amount; i++) {
			let wing = opts.wings.list[i]
			shadePath(
				c,
				wing.path,
				rgb(wing.color),
				lighten(wing.color, 15),
				sunAng,
				sunDis
			)
			c.save()
			c.clip(opts.wings.hitMaskPath)
			c.fillStyle = "rgba(0,0,0,0.7)"
			c.fill(wing.path)
			c.restore()
		}
	}
	if (!opts.hull.isDead) {
		shadePath(
			c,
			opts.hull.path,
			rgb(opts.hull.color),
			lighten(opts.hull.color, 15),
			sunAng,
			sunDis
		)
		c.save()
		c.clip(opts.hull.hitMaskPath)
		c.fillStyle = "rgba(0,0,0,0.7)"
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

		shadePath(c, opts.hull.path, lgr, lgr2, sunAng, sunDis)
		c.restore()
	}
	if (!opts.thrust.isDead) {
		let stepW = opts.thrust.w2 / (opts.thrust.amount + 1)
		shadePath(
			c,
			opts.thrust.path,
			rgb(opts.thrust.color),
			lighten(opts.thrust.color, 15),
			sunAng,
			sunDis
		)
		c.fillStyle = opts.thrust.color
		c.fill(opts.thrust.path2)
		for (let i = 1; i <= opts.thrust.amount; i++) {
			c.fillStyle = "rgba(255,55,55,0.8)"

			if (isThrust) {
				c.fillRect(
					-opts.thrust.w2 / 2 + i * stepW - opts.thrust.tw / 2,
					opts.thrust.top + opts.thrust.h1 + opts.thrust.h2,
					opts.thrust.tw,
					Math.random() * 0.15 + 0.1
				)
				c.fillStyle = "rgba(255,255,55,0.8)"

				c.fillRect(
					-opts.thrust.w2 / 2 + i * stepW - opts.thrust.tw / 2,
					opts.thrust.top + opts.thrust.h1 + opts.thrust.h2,
					opts.thrust.tw,
					Math.random() * 0.15 + 0.1
				)
			}
			// if (isThrustLeft && i == 1) {
			// 	let wd = Math.random() * 0.15 + 0.1
			// 	c.fillRect(
			// 		-opts.wings.maxW / 2 + i * stepW - opts.thrust.w / 2 - wd,
			// 		opts.thrust.top + opts.thrust.h / 2,
			// 		wd,
			// 		opts.thrust.h / 2
			// 	)
			// 	c.fillStyle = "rgba(255,255,55,0.8)"
			// 	wd = Math.random() * 0.15 + 0.1
			// 	c.fillRect(
			// 		-opts.wings.maxW / 2 + i * stepW - opts.thrust.w / 2 - wd,
			// 		opts.thrust.top + opts.thrust.h / 2,
			// 		wd,
			// 		opts.thrust.h / 2
			// 	)
			// }
			// if (isThrustRight && i == opts.thrust.amount) {
			// 	let wd = Math.random() * 0.15 + 0.1
			// 	c.fillRect(
			// 		-opts.wings.maxW / 2 + i * stepW - opts.thrust.w / 2 + opts.thrust.w,
			// 		opts.thrust.top + opts.thrust.h / 2,
			// 		wd,
			// 		opts.thrust.h / 2
			// 	)
			// 	c.fillStyle = "rgba(255,255,55,0.8)"
			// 	wd = Math.random() * 0.15 + 0.1
			// 	c.fillRect(
			// 		-opts.wings.maxW / 2 + i * stepW - opts.thrust.w / 2 + opts.thrust.w,
			// 		opts.thrust.top + opts.thrust.h / 2,
			// 		wd,
			// 		opts.thrust.h / 2
			// 	)
			// }
		}
	}
	c.restore()
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
	// c.stroke(path)
	c.restore()
}
export function rgb(arr) {
	return rgba(arr[0], arr[1], arr[2], 1)
}
export function lighten(arr, amnt) {
	return rgb(arr.map(num => Math.min(255, num + amnt)))
}
