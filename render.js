import { rgb } from "./ShipRender.js"

export const renderBg = (w, h) => {
	let cnv2 = document.getElementById("b")
	cnv2.style.margin = 0
	document.body.margin = 0
	cnv2.width = w
	cnv2.height = h
	let c2 = cnv2.getContext("2d")
	for (let i = 0; i < 1000; i++) {
		c2.fillStyle = rgb(
			[125, 155 + Math.random() * 100, 155 + Math.random() * 100],
			0.4
		)
		star(c2, Math.random() * w, Math.random() * h, Math.random() * 2)
	}
}

var time = 0
export const hitExplosion = (c, pos, rad) => {
	time++
	for (let i = 0; i < 1; i++) {
		c.fillStyle =
			"rgba(" +
			255 +
			"," +
			Math.floor((Math.abs((time % 14) - 7) / 7) * 100 + 150) +
			"," +
			Math.floor((Math.abs((time % 34) - 17) / 17) * 55 + 100) +
			"," +
			(0.3 + 0.5 * Math.random()) +
			")"
		c.beginPath()
		c.ellipse(
			pos.x,
			pos.y,
			0.3 + rad * 1.2 * Math.random(),
			0.3 + rad * 0.9 * Math.random(),
			((time * 0.01) % 1.248) * Math.PI * 2,
			0,
			Math.PI * 2,
			0
		)
		c.fill()
		c.closePath()
	}
}
function drawExplosion(c, rn, pos, rad) {
	for (let i = 0; i < 20 * zoom; i++) {
		c.fillStyle =
			"rgba(" +
			255 +
			"," +
			Math.floor(time * rn() * 255) +
			"," +
			Math.floor(time * rn() * 155) +
			"," +
			0.5 / i +
			")"
		c.beginPath()
		c.ellipse(
			pos.x,
			pos.y,
			rad * 1.5 * zoom * rn(),
			rad * 1.2 * zoom * rn(),
			((time * 0.01) % 1.248) * Math.PI * 2,
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
