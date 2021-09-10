function drawRoundRect(ctx, x, y, width, height, radius, isRounded) {
	// radius = radius * 2 < ( Math.min( height, width ) ) ? radius : ( Math.min( height, width ) ) / 2
	if (typeof radius === "undefined") {
		radius = 0
	}
	if (typeof radius === "number") {
		radius = Math.min(radius, Math.min(width / 2, height / 2))
		radius = {
			tl: radius,
			tr: radius,
			br: radius,
			bl: radius
		}
	} else {
		var defaultRadius = {
			tl: 0,
			tr: 0,
			br: 0,
			bl: 0
		}
		for (var side in defaultRadius) {
			radius[side] = radius[side] || defaultRadius[side]
		}
	}

	ctx.beginPath()
	if (!isRounded) {
		ctx.moveTo(x + radius.tl, y)
		ctx.lineTo(x + width - radius.tr, y)
		ctx.lineTo(x + width, y + radius.tr)
		ctx.lineTo(x + width, y + height - radius.br)
		ctx.lineTo(x + width - radius.br, y + height)
		ctx.lineTo(x + radius.bl, y + height)
		ctx.lineTo(x, y + height - radius.bl)
		ctx.lineTo(x, y + radius.tl)
		ctx.lineTo(x + radius.tl, y)
	} else {
		ctx.moveTo(x + radius.tl, y)
		ctx.lineTo(x + width - radius.tr, y)
		ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr)
		ctx.lineTo(x + width, y + height - radius.br)
		ctx.quadraticCurveTo(
			x + width,
			y + height,
			x + width - radius.br,
			y + height
		)
		ctx.lineTo(x + radius.bl, y + height)
		ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl)
		ctx.lineTo(x, y + radius.tl)
		ctx.quadraticCurveTo(x, y, x + radius.tl, y)
	}
	ctx.closePath()
}

function roundToDecimals(value, decimalDigits) {
	let rounder = Math.pow(10, decimalDigits)
	return Math.floor(value * rounder) / rounder
}
function nFormatter(num, digits) {
	var si = [
			{
				value: 1e100,
				symbol: "It's Enough"
			},
			{
				value: 1e93,
				symbol: "Tg"
			},
			{
				value: 1e90,
				symbol: "NVt"
			},
			{
				value: 1e87,
				symbol: "OVt"
			},
			{
				value: 1e84,
				symbol: "SVt"
			},
			{
				value: 1e81,
				symbol: "sVt"
			},
			{
				value: 1e78,
				symbol: "QVt"
			},
			{
				value: 1e75,
				symbol: "qVt"
			},
			{
				value: 1e72,
				symbol: "TVt"
			},
			{
				value: 1e69,
				symbol: "DVt"
			},
			{
				value: 1e66,
				symbol: "UVt"
			},
			{
				value: 1e63,
				symbol: "Vt"
			},
			{
				value: 1e60,
				symbol: "ND"
			},
			{
				value: 1e57,
				symbol: "OD"
			},
			{
				value: 1e54,
				symbol: "SD"
			},
			{
				value: 1e51,
				symbol: "sD"
			},
			{
				value: 1e48,
				symbol: "QD"
			},
			{
				value: 1e45,
				symbol: "qD"
			},
			{
				value: 1e42,
				symbol: "TD"
			},
			{
				value: 1e39,
				symbol: "DD"
			},
			{
				value: 1e36,
				symbol: "UD"
			},
			{
				value: 1e33,
				symbol: "D"
			},
			{
				value: 1e30,
				symbol: "N"
			},
			{
				value: 1e27,
				symbol: "O"
			},
			{
				value: 1e24,
				symbol: "S"
			},
			{
				value: 1e21,
				symbol: "s"
			},
			{
				value: 1e18,
				symbol: "Q"
			},
			{
				value: 1e15,
				symbol: "q"
			},
			{
				value: 1e12,
				symbol: "T"
			},
			{
				value: 1e9,
				symbol: "B"
			},
			{
				value: 1e6,
				symbol: "M"
			},
			{
				value: 1e3,
				symbol: "k"
			}
		],
		i
	if (num < 0) {
		return "-" + nFormatter(-1 * num, digits)
	}
	for (i = 0; i < si.length; i++) {
		if (num >= si[i].value) {
			if (i == 0) {
				return "It's Enough..."
			}
			if (!digits) {
				return Math.floor(num / si[i].value) + si[i].symbol
			}
			return (
				Math.floor((Math.pow(10, digits) * num) / si[i].value) /
					Math.pow(10, digits) +
				si[i].symbol
			)
			//(num / si[i].value).toFixed(digits).replace(/\.?0+$/, "") + si[i].symbol;
		}
	}
	return num
}

function distPoints(point1, point2) {
	try {
		return dist(point1.x, point1.y, point2.x, point2.y)
	} catch (e) {
		console.log(point1, point2)
		console.log(e)
	}
}
function dist(x1, y1, x2, y2) {
	return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
}
function anglePoints(point1, point2) {
	return angle(point1.x, point1.y, point2.x, point2.y)
}
function angle(p1x, p1y, p2x, p2y) {
	return Math.atan2(p2y - p1y, p2x - p1x)
}
function compareAngles(a, b) {
	return Math.abs(
		((a + Math.PI * 2) % (Math.PI * 2)) - ((b + Math.PI * 2) % (Math.PI * 2))
	)
}
function turnTowards(angl, angl2, turnSpeed) {
	angl = angl % (Math.PI * 2)
	angl2 = angl2 % (Math.PI * 2)
	// angl -= Math.PI
	if (angl < 0) {
		angl += Math.PI * 2
	}
	if (angl2 < 0) {
		angl2 += Math.PI * 2
	}
	if (Math.abs(angl2 - angl) > turnSpeed) {
		if (findSideToTurn(angl, angl2) > 0) {
			return 1
		} else {
			return -1
		}
	}
	return 0
}
function findSideToTurn(ang1, ang2) {
	let dif = ang1 - ang2
	if (dif < 0) {
		dif += Math.PI * 2
	}
	if (dif > Math.PI) {
		return 1
	} else {
		return -1
	}
}
/**
 * Requires p to have .min and .max attributes set.
 *
 * @param {object} p
 * @returns range between p.min and p.max
 */
function getRange(p) {
	return p.max - p.min
}

function getURLParams() {
	const queryString = window.location.search
	return new URLSearchParams(decodeURIComponent(queryString))
}

function escapeHtml(unsafe) {
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;")
}

function rgba(r, g, b, a) {
	return "rgba(" + r + "," + g + "," + b + "," + a + ")"
}
function posEquals(p1, p2) {
	return p1.x == p2.x && p1.y == p2.y
}
function getInRange(num, min, max) {
	return Math.min(max, Math.max(min, num))
}

function disAngOrigin(x, y) {
	return {
		angle: angle(0, 0, x, y),
		dis: dist(0, 0, x, y)
	}
}
function disAng(x0, y0, x1, y2) {
	return {
		angle: angle(x0, y0, x1, y2),
		dis: dist(x0, y0, x1, y2)
	}
}
function translateToAndDraw(c, x, y, draw) {
	c.save()
	c.translate(x, y)
	draw()
	c.restore()
}
export const fillCirc = (c, x, y, rad, col) => {
	circ(c, x, y, rad)
	setFs(c, col)
	c.fill()
}
export const strokeCirc = (c, x, y, rad, col) => {
	circ(c, x, y, rad)
	setSs(c, col)
	c.stroke()
}
export const circs = (c, arr, fill, stroke) => {
	c.beginPath()
	arr.forEach(circ => {
		c.moveTo(circ[0], circ[1])
		c.arc(circ[0], circ[1], circ[2], 0, 9)
	})
	c.closePath()
	if (stroke) {
		setSs(c, stroke)
		c.stroke()
	}
	if (fill) {
		setFs(c, fill)
		c.fill()
	}
}
export const circ = (c, x, y, rad) => {
	c.beginPath()
	c.arc(x, y, rad, 0, 8)
	c.closePath()
}
export const line = (c, pos0, pos1, col) => {
	if (col) {
		setSs(c, "white")
	}
	c.beginPath()
	c.moveTo(pos0.x, pos0.y)
	c.lineTo(pos1.x, pos1.y)
	c.stroke()
	c.closePath()
}
export const createDiv = className => {
	let d = document.createElement("div")
	d.className = className
	return d
}

export const createDialog = () => {
	let dialog = createDiv("dialog")
	document.body.appendChild(dialog)
	return dialog
}
export const titleDiv = txt => {
	let d = createDiv("title")
	d.innerHTML = txt
	return d
}
export const subTitleDiv = txt => {
	let d = createDiv("subTitle")
	d.innerHTML = txt
	return d
}
export const getButton = (txt, onclick) => {
	let b = document.createElement("button")
	b.onclick = onclick
	b.innerHTML = txt
	return b
}

export const createCnv = (w, h) => {
	let c = document.createElement("canvas")
	c.width = w
	c.height = h
	return c
}

export const scaleRotate = (c, sc, rot) => {
	c.scale(sc, sc)
	c.rotate(rot)
}
export const rndBtwn = (min = 0, max = 1, rn = Math.random) => {
	return min + (max - min) * rn()
}
export const appendChildren = (parent, children) => {
	children.forEach(child => parent.appendChild(child))
}

export const pos = (x, y) => {
	return { x, y }
}
export const copyPos = pos => {
	return {
		x: pos.x,
		y: pos.y
	}
}
export const setFs = (c, fs) => {
	c.fillStyle = fs
}
export const setSs = (c, ss) => {
	c.strokeStyle = ss
}
export const setPos = (pos, x, y) => {
	pos.x = x
	pos.y = y
}
export const posPlusPos = (pos, pos0) => {
	pos.x += pos0.x
	pos.y += pos0.y
	return pos
}
export const posPlus = (pos, plus) => {
	pos.x += plus
	pos.y += plus
	return pos
}
export const _posMult = (pos, mult) => {
	return { x: pos.x * mult, y: pos.y * mult }
}
export const posMult = (pos, mult) => {
	pos.x *= mult
	pos.y *= mult
	return pos
}
export const posPlusAng = (pos, ang, dis) => {
	pos.x += Math.cos(ang) * dis
	pos.y += Math.sin(ang) * dis
	return pos
}
export const _posPlusAng = (pos, ang, dis) => {
	return {
		x: pos.x + Math.cos(ang) * dis,
		y: pos.y + Math.sin(ang) * dis
	}
}
export const setFont = (c, size) => {
	c.font = size + "px Gill Sans MT"
}
export const doXTimes = (doThat, xTimes) => {
	for (let xTimes = 0; xTimes < x; xTimes++) {
		doThat()
	}
}
export const txtAt = (c, txt, x, y) => {}
export {
	drawRoundRect,
	roundToDecimals,
	nFormatter,
	distPoints,
	dist,
	anglePoints,
	angle,
	compareAngles,
	turnTowards,
	findSideToTurn,
	getRange,
	getURLParams,
	escapeHtml,
	rgba,
	posEquals,
	getInRange,
	disAngOrigin,
	disAng,
	translateToAndDraw
}
