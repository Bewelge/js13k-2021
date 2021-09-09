import { components } from "./components.js"
import { rgba, rndBtwn, scaleRotate, translateToAndDraw } from "./Util.js"

export const renderShip = (c, x, y, size, shipOpts, rot, opts) => {
	translateToAndDraw(c, x, y, () => {
		scaleRotate(c, size, rot + Math.PI * 0.5)

		if (!shipOpts.weapons.isDead || !opts.showDmg) {
			renderWeapons(c, shipOpts, opts)
		}
		if (!shipOpts.wings.isDead || !opts.showDmg) {
			renderWings(shipOpts, c, opts)
		}
		if (!shipOpts.hull.isDead || !opts.showDmg) {
			renderHull(shipOpts, c, opts)
		}
		if (!shipOpts.thrust.isDead || !opts.showDmg) {
			renderThrust(shipOpts, c, opts)
		}
	})
}

function renderComponent(c, component, drawPaths, opts) {
	drawPaths.forEach(path => {
		if (opts.fill) {
			c.fillStyle = opts.fill
			c.fill(path)
		}
		if (opts.stroke) {
			c.strokeStyle = opts.stroke
			c.stroke(path)
		}
		if (!opts.stroke && !opts.fill) {
			shadePath(
				c,
				path,
				rgb(component.color),
				lighten(component.color, 15),
				opts.ang,
				opts.dis
			)
		}
	})
}
export const renderThrust = (shipOpts, c, opts) => {
	renderComponent(
		c,
		shipOpts.thrust,
		[shipOpts.thrust.path, shipOpts.thrust.path2],
		opts
	)
	let thrust = shipOpts.thrust
	let stepW = thrust.w2 / (thrust.amount + 1)
	for (let i = 1; i <= thrust.amount; i++) {
		if (opts.boost) {
			let y = thrust.top + thrust.h1 + thrust.h2
			const x = -thrust.w2 / 2 + i * stepW - thrust.tw / 2
			c.fillStyle = "rgba(255,55,55,0.8)"
			c.fillRect(x, y, thrust.tw, rndBtwn(0.1, 0.25))
			c.fillStyle = "rgba(255,255,55,0.8)"
			c.fillRect(x, y, thrust.tw, rndBtwn(0.1, 0.25))
		}
	}
}

export const renderHull = (shipOpts, c, opts) => {
	renderComponent(c, shipOpts.hull, [shipOpts.hull.path], opts)
	if (!opts.fill && !opts.stroke) {
		c.save()
		c.clip(shipOpts.hull.hitMaskPath)
		c.fillStyle = opts.fill || "rgba(0,0,0,0.7)"
		c.fill(shipOpts.hull.path)
		c.restore()

		let x = (shipOpts.hull.topW / 2) * shipOpts.hull.windowSize
		let lgr = c.createLinearGradient(-x, 0, x, 0)
		lgr.addColorStop(0, "rgba(50,250,250,1)")
		lgr.addColorStop(1, "rgba(50,150,150,1)")

		let lgr2 = c.createLinearGradient(-x, 0, x, 0)
		lgr2.addColorStop(0, "rgba(250,250,250,1)")
		lgr2.addColorStop(1, "rgba(255,255,255,1)")
		c.save()
		c.scale(shipOpts.hull.windowSize, shipOpts.hull.windowSize)

		shadePath(c, shipOpts.hull.path, lgr, lgr2, opts.ang, opts.dis)
		c.restore()
	}
}

export const renderWings = (shipOpts, c, opts) => {
	for (let i = 0; i < shipOpts.wings.amount; i++) {
		let wing = shipOpts.wings.list[i]
		shadePath(
			c,
			wing.path,
			opts.fill || rgb(wing.color),
			opts.fill || lighten(wing.color, 15),
			opts.ng,
			opts.sunDis
		)
		if (opts.stroke) {
			c.stroke(wing.path)
		}
		if (opts.showDmg) {
			c.save()
			c.clip(shipOpts.wings.hitMaskPath)
			c.fillStyle = opts.fill || "rgba(0,0,0,0.7)"
			c.fill(wing.path)
			c.restore()
		}
	}

	if (opts.boostLeft || opts.boostRight) {
		let x = 0
		let y = 0
		let drawThrust = () => {
			c.fillRect(x, y, 0.1, rndBtwn(0.2, 0.35))
		}

		let dr = () => {
			c.fillStyle = "rgba(255,55,55,0.8)"
			drawThrust()
			c.fillStyle = "rgba(255,255,55,0.8)"
			drawThrust()
		}
		if (opts.boostLeft) {
			x = (shipOpts.wings.maxW / 2) * 0.8 - 0.1
			y = shipOpts.wings.maxY
			dr()
		}
		if (opts.boostRight) {
			x = (-shipOpts.wings.maxW / 2) * 0.8
			y = shipOpts.wings.maxY
			dr()
		}
	}
}

export const renderWeapons = (c, shipOpts, opts) => {
	c.fillStyle = rgb(shipOpts.weapons.color)

	for (let i = 0; i < shipOpts.weapons.amount; i++) {
		let drawAWeapon = () =>
			shadePath(
				c,
				shipOpts.weapons.singlePath,
				opts.fill || rgb(shipOpts.weapons.color),
				opts.fill || lighten(shipOpts.weapons.color, 15),
				opts.ang,
				opts.dis * 0.4
			)

		const weaponWidth = shipOpts.weapons.w + shipOpts.weapons.margin
		translateToAndDraw(
			c,
			-shipOpts.weapons.x - i * weaponWidth,
			shipOpts.weapons.top,
			drawAWeapon
		)
		translateToAndDraw(
			c,
			shipOpts.weapons.x + i * weaponWidth,
			shipOpts.weapons.top,
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
