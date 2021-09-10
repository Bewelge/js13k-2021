import { lighten, rgb } from "./ShipRender.js"
import { rndBtwn, setFs } from "./Util.js"

export const renderBg = (w, h) => {
	let cnv2 = document.getElementById("b")
	cnv2.style.margin = 0
	document.body.margin = 0
	cnv2.width = w
	cnv2.height = h
	let c2 = cnv2.getContext("2d")
	for (let i = 0; i < 1000; i++) {
		setFs(
			c2,
			rgb([125, 155 + Math.random() * 100, 155 + Math.random() * 100], 0.4)
		)
		star(c2, Math.random() * w, Math.random() * h, Math.random() * 2)
	}
}

var timer = 1
export const hitExplosion = (progress, c, pos, rad, col) => {
	timer += 0.1
	for (let i = 0; i < 3; i++) {
		setFs(c, lighten(col, rndBtwn(0, 50), rndBtwn(0, 1 - progress)))

		c.beginPath()
		c.ellipse(
			pos.x,
			pos.y,
			rad * progress * Math.random(),
			rad * progress * Math.random(),
			((timer * 0.01) % 1.248) * Math.PI * 2,
			0,
			Math.PI * 2,
			0
		)
		c.fill()
		c.closePath()
	}
}

export const star = (ct, x, y, rad) => {
	let rndAng = Math.random() * Math.PI * 2
	ct.lineWidth = rad * 0.5
	ct.beginPath()
	drawEvenTriangle(ct, x, y, rad, rndAng)

	drawEvenTriangle(ct, x, y, rad, rndAng + Math.PI)
	ct.fill()
	ct.closePath()
}
export const drawEvenTriangle = (ct, x, y, rad, turn) => {
	let ang1 = (Math.PI * 2) / 3
	ct.moveTo(x + Math.cos(turn) * rad, y + Math.sin(turn) * rad)
	ct.lineTo(x + Math.cos(turn + ang1) * rad, y + Math.sin(turn + ang1) * rad)
	ct.lineTo(
		x + Math.cos(turn + ang1 * 2) * rad,
		y + Math.sin(turn + ang1 * 2) * rad
	)
}
