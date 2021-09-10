import { components } from "./components.js"
import {
	rgba,
	rndBtwn,
	scaleRotate,
	setFs,
	setSs,
	translateToAndDraw
} from "./Util.js"

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
			setFs(c, opts.fill)
			c.fill(path)
		}
		if (opts.stroke) {
			setSs(c, opts.stroke)
			c.stroke(path)
		}
		if (!opts.stroke && !opts.fill) {
			shadePath(
				c,
				path,
				rgb(path.color || component.color),
				lighten(path.color || component.color, 15),
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
			setFs(c, "rgba(255,55,55,0.8)")
			c.fillRect(x, y, thrust.tw, rndBtwn(0.1, 0.25))
			setFs(c, "rgba(255,255,55,0.8)")
			c.fillRect(x, y, thrust.tw, rndBtwn(0.1, 0.25))
		}
	}
}

export const renderHull = (shipOpts, c, opts) => {
	renderComponent(c, shipOpts.hull, [shipOpts.hull.path], opts)
	if (!opts.fill && !opts.stroke) {
		c.save()
		c.clip(shipOpts.hull.hitMaskPath)
		setFs(c, opts.fill || "rgba(0,0,0,0.7)")
		c.fill(shipOpts.hull.path)
		c.restore()

		let x = (shipOpts.hull.topW / 2) * shipOpts.hull.windowSize
		let lgr = c.createLinearGradient(-x, 0, x, 0)
		lgr.addColorStop(0, "rgba(50,250,250,1)")
		lgr.addColorStop(1, "rgba(50,150,150,1)")

		let lgr2 = "rgba(255,255,255,0.7)"
		// c.createLinearGradient(-x, 0, x, 0)
		// lgr2.addColorStop(0, "rgba(250,250,250,1)")
		// lgr2.addColorStop(1, "rgba(255,255,255,1)")
		c.save()
		c.scale(shipOpts.hull.windowSize, shipOpts.hull.windowSize)

		shadePath(c, shipOpts.hull.path, lgr, lgr2, opts.ang, opts.dis)
		c.restore()
	}
}

export const renderWings = (shipOpts, c, opts) => {
	renderComponent(
		c,
		shipOpts.wings,
		shipOpts.wings.list.map(wing => wing.path),
		opts
	)

	if (opts.boostLeft || opts.boostRight) {
		let x = 0
		let y = shipOpts.wings.maxY
		let drawThrust = () => {
			c.fillRect(x, y, 0.1, rndBtwn(0.2, 0.35))
		}

		let dr = () => {
			setFs(c, "rgba(255,55,55,0.8)")
			drawThrust()
			setFs(c, "rgba(255,255,55,0.8)")
			drawThrust()
		}
		if (opts.boostLeft) {
			x = (shipOpts.wings.maxW / 2) * 0.8 - 0.1
			dr()
		}
		if (opts.boostRight) {
			x = (-shipOpts.wings.maxW / 2) * 0.8
			dr()
		}
	}
}

export const renderWeapons = (c, shipOpts, opts) => {
	renderComponent(c, shipOpts.weapons, [shipOpts.weapons.path], opts)
}

function shadePath(c, path, color, shadeColor, shadeDirection, shadeOffset) {
	c.save()
	setFs(c, shadeColor)
	c.fill(path)
	c.clip(path)
	c.translate(
		Math.cos(shadeDirection) * shadeOffset,
		Math.sin(shadeDirection) * shadeOffset
	)
	setFs(c, color)
	c.fill(path)

	setSs(c, "rgba(255,255,255,0.4)")
	c.restore()
}
export function rgb(arr, a = 1) {
	return rgba(arr[0], arr[1], arr[2], a)
}
export function lighten(arr, amnt, a = 1) {
	return rgb(
		arr.map(num => Math.min(255, num + Math.floor(amnt))),
		a
	)
}
