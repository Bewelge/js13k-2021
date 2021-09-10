import { components, getComponentNames } from "./components.js"
import { openWindow } from "./mergeComponents.js"
import { getGalaxyName, getRaceName } from "./names.js"
import {
	BROKENCOMPS,
	BULLETSMOKES,
	BULLET_HITS,
	EXPLOSIONS,
	particles,
	TRAIL
} from "./particles.js"
import { drawEvenTriangle, hitExplosion, renderBg } from "./render.js"
import { getNewRng } from "./Rng.js"
import { getShipOpts } from "./ship.js"
import { renderShip, rgb } from "./ShipRender.js"
import {
	angle,
	anglePoints,
	compareAngles,
	createDialog,
	disAngOrigin,
	dist,
	distPoints,
	getButton,
	getInRange,
	posEquals,
	createDiv,
	subTitleDiv,
	titleDiv,
	turnTowards,
	createCnv,
	appendChildren,
	posMult,
	posPlusPos,
	posPlusAng,
	rndBtwn,
	setFont,
	setPos,
	translateToAndDraw,
	scaleRotate,
	disAng,
	line,
	pos,
	_posPlusAng,
	_posMult,
	fillCirc,
	strokeCirc,
	circs,
	posPlus,
	copyPos,
	setFs,
	setSs
} from "./Util.js"

var paused = true

const PIH = Math.PI / 2
const PI2 = Math.PI * 2

//REMOVE
var debug = true
document
	.getElementById("debug")
	.addEventListener("change", () => (debug = !debug))
//REMOVE

var w = window.innerWidth
var h = window.innerHeight
var cnv, cnv2, cnvH, c, ch

var screenPos = { x: 0, y: 0 }
let randomStartSeed = Math.floor(Math.random() * 99999)
console.log("Ship seed: " + randomStartSeed)
var zoom = 25
var quadrantSize = 3500
var mousePos = { x: 0, y: 0 }
var time = 0
var keysdown = {}
var mouseDown = false
var bullets = {}
var activeEnemies = new Set()
var enemyLock
var hoveredEnemy

const ZOOM_MAX = 6000
const ZOOM_MIN = 0.01
var zoomHandleGrabbed = false
var lastTime = window.performance.now()
var timeUntilNextTick = 0
var tickDur = 16
var conqueredQuadrants = {} //TODO
var hoveredGalaxy = null
var hoveredPlanet = null
var player = {}

var playerPathCounter = 0
var quadrantCache = {}
var discoveredGalaxies = {
	0: { "-1": true }
}
var galaxyOptsCache = {}
let seeds = {}
var playerPath = []
var enemyCache = {}
var bulletColors = {}
var blinkTick = 0

var playerQuadrant, playerGal
function getNewPlayer() {
	randomStartSeed = Math.floor(Math.random() * 99999)
	let rn = getNewRng(randomStartSeed)
	let rndStart = {
		x: Math.floor(rn() * 10000),
		y: Math.floor(rn() * 10000)
	}
	console.log("Home Planet: x: " + rndStart.x + ", y:" + rndStart.y)
	while (
		!hasQuadrantGalaxy(rndStart) ||
		!getGalaxyOpts(rndStart.x, rndStart.y).planets.length
	) {
		rndStart = {
			x: Math.floor(rn() * 10000),
			y: Math.floor(rn() * 10000)
		}
		console.log("Home Planet: x: " + rndStart.x + ", y:" + rndStart.y)
	}
	screenPos = getPlanetPos(
		getGalaxyOpts(rndStart.x, rndStart.y).planets[0],
		time
	)
	player.level = 0
	player = getEnemyOpts(rn, randomStartSeed)
	player.x = screenPos.x + 25
	player.y = screenPos.y + 25
	player.level = 1
	player.rot = -PIH
	player.mot = pos(0, 0)
	player.thrust = pos(0, 0)
	player.shipOpts = getShipOpts(randomStartSeed, player.level / 500)
}

export class Enemy {
	constructor(opts) {
		this.seed = opts.seed
		this.shipOpts = getShipOpts(opts.seed, player.level / 500)
		this.race = opts.race

		this.shotDis = opts.shotDis
		this.turnSpeed = opts.turnSpeed
		this.speed = opts.speed
		this.shotLife = opts.shotLife
		this.shotCd = 0
		this.dmg = opts.dmg / this.shipOpts.weapons.amount
		this.fireRate = opts.fireRate

		this.enemyDistance = opts.enemyDistance
		this.shotSpeed = opts.shotSpeed || 0.02

		this.galaxy = opts.galaxy

		this.size = opts.size
		let pos = this.findRandomAim()

		this.x = pos.x
		this.y = pos.y
		this.mot = { x: 0, y: 0 }
		this.rotAcc = 0
		this.rot = Math.random() * PI2
	}
	shoot() {
		// posPlusAng(this.mot, -this.rot, 0.05)
		createBullets(this)
	}
	update() {
		let disToPlayer = distPoints(this, player)

		if (this.shotCd > 0) {
			this.shotCd -= 1 * (this.shipOpts.weapons.isDead ? 0.5 : 1)
		}
		if (disToPlayer < this.enemyDistance) {
			if (disToPlayer < this.shotDis) {
				if (!this.shipOpts.weapons.isDead && this.shotCd <= 0) {
					this.shoot()
					this.shotCd = this.fireRate
				}
				this.boostRight = this.boostLeft = false
			}
			this.aim = player
			if (!enemyLock) enemyLock = this
			this.moveTo(player)
		} else {
			if (
				this.aim == player &&
				disToPlayer >
					this.enemyDistance *
						(posEquals(getShipQuadrant(this), getShipQuadrant(player))
							? 5
							: 2.5)
			) {
				this.aim = null
			}
			if (!this.aim || distPoints(this.aim, this) < 5) {
				this.aim = this.findRandomAim()
			}
			if (this.aim.x == this.x && this.aim.y == this.y) {
				this.aim.x++
			}
			this.moveTo(this.aim)
		}
		posMult(this.mot, 0.99)
		posPlusPos(this, this.mot)

		checkCollisions(this, false)

		let components = [
			this.shipOpts.hull,
			this.shipOpts.thrust,
			this.shipOpts.wings,
			this.shipOpts.weapons
		]
		components.forEach(component => {
			if (component.hp <= 0 && !component.isDead) {
				component.isDead = true

				if (component != this.shipOpts.weapons) {
					addBrokenComponent(this, component)
					addExplosion(this, 0.4)
				}
			}
		})

		if (this.shipOpts.hull.isDead) {
			this.isDead = true

			addExplosion(this)
			player.level += 1
		}
	}

	findRandomAim() {
		if (this.galaxy.planets) {
			let pos = getPlanetPos(
				this.galaxy.planets[
					Math.floor(Math.random() * this.galaxy.planets.length)
				],
				time
			)
			posPlusAng(pos, rndBtwn(0, PI2), rndBtwn(0, 40))
			return pos
		}
		return pos(
			this.galaxy.pos.x + rndBtwn(-1, 1) * this.galaxy.size,
			this.galaxy.pos.y + rndBtwn(-1, 1) * this.galaxy.size
		)
	}
	render() {
		let onsc = getOnScreenPos(this.x, this.y)
		let size = this.size * zoom * 6
		let thislock = enemyLock == this
		if (distPoints(mousePos, onsc) < size * 1 || thislock) {
			if (hoveredEnemy == null) {
				if (!thislock) {
					hoveredEnemy = this
				}
				setFs(c, "green")
				c.textBaseline = "top"
				setFont(c, 14)

				let x = onsc.x - 60
				let y = onsc.y - 40 - size / 2
				c.fillText(this.race + " Ship", x, y - 20)
				setFont(c, 14)
				getComponentNames().forEach((component, i) => {
					let yy = y + 13 * i
					c.fillText(components[component].name, x, yy)
					c.fillRect(
						onsc.x,
						yy + 5,
						(60 * this.shipOpts[component].hp) / this.shipOpts[component].maxHp,
						5
					)
				})
			}
		}
		c.lineWidth = thislock ? 3 : 2
		setSs(c, "rgba(200,50,50,0.3)")
		c.strokeRect(onsc.x - size / 2, onsc.y - size / 2, size, size)
		if (!isPosOnScreen(onsc, zoom)) {
			let x = getInRange(onsc.x, 0, w)
			let y = getInRange(onsc.y, 0, h)
			setFs(c, "rgba(200,50,50,0.7)")
			c.lineWidth = 3
			c.beginPath()
			drawEvenTriangle(c, x, y, 18, angle(onsc.x, onsc.y, x, y))
			c.closePath()
			c.fill()
		} else {
			renderAShip(this, this.boost, this.boostLeft, this.boostRight, true)
		}

		//DELETE
		if (debug) {
			setSs(c, "rgba(255,255,255,0.5)")
			let ons = getOnScreenPos(this.x, this.y)
			c.lineWidth = 0.5
			c.beginPath()
			c.arc(ons.x, ons.y, this.enemyDistance * zoom, 0, 8)
			c.closePath()
			c.stroke()
			setSs(c, "rgba(255,0,0,0.5)")
			c.beginPath()
			c.arc(ons.x, ons.y, this.shotDis * zoom, 0, 8)
			c.closePath()
			c.stroke()

			if (this.aim) {
				let onsAim = getOnScreenPos(this.aim.x, this.aim.y)
				line(c, ons, onsAim, "white")
				line(c, ons, _posPlusAng(ons, this.rot, 10), "white")

				c.fillRect(onsAim.x, onsAim.y, 5, 5)
			}
		}
		//DELETE
	}
	moveTo(pos) {
		let ang = anglePoints(pos, this)
		if (compareAngles(ang, this.rot) < this.turnSpeed * 2) {
			this.rot = ang
		} else {
			let rotation =
				-this.turnSpeed *
				0.05 *
				turnTowards(ang, this.rot + Math.PI, this.turnSpeed)
			rotation > 0
				? (this.boostLeft = true)
				: rotation < 0
				? (this.boostRight = true)
				: null
			this.rotAcc += rotation * (this.shipOpts.wings.isDead ? 0.1 : 1)
		}
		this.rot += this.rotAcc

		this.rotAcc *= 0.9 + (this.shipOpts.wings.isDead ? 0.09 : 0)

		let dis = distPoints(this, pos)

		let speed =
			Math.min(1, dis / this.shotDis) *
			this.speed *
			(this.shipOpts.thrust.isDead ? 0.1 : 1)
		posPlusAng(this.mot, this.rot, speed)

		this.boost = true
	}
}
function killall() {
	activeEnemies.forEach(enemy =>
		Object.values(enemy.shipOpts).forEach(comp => (comp.hp = 0))
	)
}
function addExplosion(ship, rad = 1) {
	for (let i = 0; i < 25; i++) {
		let z = zoom * 0.05
		window.setTimeout(() => {
			particles.add(EXPLOSIONS, [
				36,
				rndBtwn(-z, z),
				rndBtwn(-z, z),
				ship,
				Math.random() < 0.5
					? [255, rndBtwn(50, 255), rndBtwn(50, 100)]
					: getBulletColor(ship.seed),
				rndBtwn(1, 3) * rad
			])
		}, i * 15)
	}
}
window.onload = () => {
	cnv = document.getElementById("c")
	cnv2 = document.getElementById("b")
	cnvH = document.getElementById("h")
	c = cnv.getContext("2d")
	ch = cnvH.getContext("2d")

	let resizeTimer = null
	window.addEventListener("resize", () => {
		clearTimeout(resizeTimer)
		resizeTimer = window.setTimeout(resize)
	})
	resize()

	window.addEventListener("keydown", ev => {
		keysdown[ev.code] = true
		if (debug && ev.code == "KeyK") {
			killall()
		}
		if (debug && ev.code == "KeyL") {
			player.fireRate = 1
		}
		if (debug && ev.code == "KeyM") {
			player.shotSpeed = 2
			player.shotDis++
			player.shotLife = player.shotDis / player.shotSpeed
		}
		if (debug && ev.code == "KeyN") {
			player.speed += 0.001
			console.log(player.speed)
		}
	})
	window.addEventListener("keyup", ev => (keysdown[ev.code] = false))
	window.addEventListener("mousedown", ev => {
		mouseDown = true
		mousePos = { x: ev.clientX, y: ev.clientY }
		if (hoveredEnemy) {
			enemyLock = hoveredEnemy
		}
		if (hoveredGalaxy && debug) {
			if (hoveredPlanet) {
				let planetPos = getPlanetPos(hoveredPlanet, time)
				let galAngle = anglePoints(planetPos, player)
				let dis = distPoints(planetPos, player)
				player.x -= Math.cos(galAngle) * (dis - hoveredPlanet.rad)
				player.y -= Math.sin(galAngle) * (dis - hoveredPlanet.rad)
			} else if (
				zoom < 0.5 &&
				!posEquals(hoveredGalaxy, getShipQuadrant(player))
			) {
				let galAngle = anglePoints(hoveredGalaxy.pos, player)
				let dis = distPoints(hoveredGalaxy.pos, player)
				player.x -= Math.cos(galAngle) * (dis - hoveredGalaxy.size)
				player.y -= Math.sin(galAngle) * (dis - hoveredGalaxy.size)
			}
		}
	})
	window.addEventListener("mouseup", ev => {
		mouseDown = false
		zoomHandleGrabbed = false
	})

	let zoomHandle = document.getElementById("zoomHandle")
	let zoomBar = document.getElementById("zoomBar")

	let setZoomHandleFromZoom = () => {
		zoomHandle.style.top =
			zoomBar.clientHeight -
			getInRange(
				(zoom / (Math.log10(ZOOM_MAX) - Math.log10(ZOOM_MIN))) *
					zoomBar.clientHeight,
				0,
				zoomBar.clientHeight
			) +
			"px"
	}
	setZoomHandleFromZoom()

	zoomHandle.addEventListener("mousedown", ev => {
		ev.preventDefault()
		zoomHandleGrabbed = ev.clientY - zoomHandle.getBoundingClientRect().top
	})

	let getZoomFromEv = ev => {
		let rect = zoomBar.getBoundingClientRect()
		let relY = Math.max(
			0.1,
			Math.min(zoomBar.clientHeight, ev.clientY - rect.top - zoomHandleGrabbed)
		)
		zoomHandle.style.top =
			Math.min(zoomBar.clientHeight, Math.max(0, relY)) + "px"
		return getInRange(
			(Math.max(0.1, zoomBar.clientHeight - relY) / zoomBar.clientHeight) *
				(Math.log10(ZOOM_MAX) - Math.log10(ZOOM_MIN)),
			ZOOM_MIN,
			ZOOM_MAX
		)
	}
	zoomBar.addEventListener("mousedown", ev => {
		zoomHandleGrabbed = 0

		zoom = getZoomFromEv(ev)

		zoomHandleGrabbed = true
	})

	window.addEventListener("mousemove", ev => {
		if (zoomHandleGrabbed) {
			zoom = getZoomFromEv(ev)
		}

		if (mouseDown) {
			screenPos.x += (mousePos.x - ev.clientX) / zoom
			screenPos.y += (mousePos.y - ev.clientY) / zoom
		}
		mousePos.x = ev.clientX
		mousePos.y = ev.clientY
	})

	let delay = false
	window.addEventListener("wheel", event => {
		if (delay) {
			return
		}
		delay = true
		enemyLock = null

		//Because Firefox does not set .wheelDelta
		let wheelDelta = event.wheelDelta ? event.wheelDelta : -1 * event.deltaY

		let evDel =
			((wheelDelta + 1) / (Math.abs(wheelDelta) + 1)) *
			Math.min(Math.abs(wheelDelta))

		var wheel = evDel / Math.abs(evDel)

		zoom = Math.min(
			ZOOM_MAX,
			Math.max(ZOOM_MIN, zoom * (wheel < 0 ? 0.95 : 1.05))
		)

		delay = false

		setZoomHandleFromZoom()
	})

	initParticles()

	startScreen()
	update()
}

function initParticles() {
	particles.createNew(
		TRAIL,
		() => setFs(c, "rgba(255,255,255,0.3)"),
		el => {
			let dis = (60 - el[4]) / 3000
			el[1] -= Math.cos(el[3]) * dis
			el[2] -= Math.sin(el[3]) * dis
			el[4] *= 0.999
			let onsc = getOnScreenPos(el[1], el[2])
			let siz = ((0.3 * el[4]) / 150) * (0.2 + 0.8 * Math.random()) * zoom

			circs(
				c,
				Array.apply(null, Array(Math.ceil(Math.random() * 5))).map(el => [
					onsc.x + rndBtwn(-siz, siz),
					onsc.y + rndBtwn(-siz, siz),
					siz
				]),
				"rgba(255,255,255,0.3)"
			)
		},
		() => {},
		250
	)

	let hitexpl = (el, rad, progr) => {
		let disAng = disAngOrigin(el[1], el[2])
		let poss = _posPlusAng(
			pos(0, 0),
			disAng.angle + PIH + el[3].rot,
			disAng.dis
		)

		hitExplosion(
			progr,
			c,
			getOnScreenPos(el[3].x + poss.x, el[3].y + poss.y),
			rad,
			el[4]
		)
	}
	particles.createNew(
		BULLET_HITS,
		() => {},
		el => hitexpl(el, getInRange(zoom, 3, 9), el[0] / 10),
		() => {},
		250
	)
	particles.createNew(
		EXPLOSIONS,
		() => {},
		el => hitexpl(el, el[3].size * el[5] * zoom, Math.abs(el[0] - 18) / 18),
		() => {},
		250
	)
	particles.createNew(
		BULLETSMOKES,
		() => {},
		el => {
			let onsc = getOnScreenPos(el[1], el[2])
			let siz = rndBtwn(zoom * 0.1, zoom * 0.2)
			circs(
				c,
				Array.apply(null, Array(Math.ceil(Math.random() * 5))).map(el => [
					onsc.x + rndBtwn(-siz, siz),
					onsc.y + rndBtwn(-siz, siz),
					siz
				]),
				"rgba(255,255,255,0.3)"
			)
		},
		() => {},
		250
	)

	particles.createNew(
		BROKENCOMPS,
		() => {},
		el => {
			let pos = el[1]
			let mot = el[2]

			let onsc = getOnScreenPos(pos.x, pos.y)
			translateToAndDraw(c, onsc.x, onsc.y, () => {
				scaleRotate(c, zoom * el[4], el[3] + PIH)
				setFs(c, rgb(el[5].color))
				c.fill(el[5].path)
			})

			posPlusPos(pos, mot)
			el[3] += 0.04
			el[4] *= 0.99
		},
		() => {},
		250
	)
}

function resize() {
	w = window.innerWidth
	h = window.innerHeight
	cnv.width = w
	cnv.height = h
	cnv2.width = w
	cnv2.height = h
	cnvH.width = w
	cnvH.height = h
	renderBg(w, h)
}

function getQuadrantsToDraw() {
	let xStart = Math.floor((screenPos.x - w / 2 / zoom) / quadrantSize)
	let xEnd = Math.floor((screenPos.x + w / 2 / zoom) / quadrantSize)
	let yStart = Math.floor((screenPos.y - h / 2 / zoom) / quadrantSize)
	let yEnd = Math.floor((screenPos.y + h / 2 / zoom) / quadrantSize)
	return {
		xStart,
		xEnd,
		yStart,
		yEnd
	}
}

function update() {
	if (!paused) {
		let newTime = window.performance.now()
		timeUntilNextTick += newTime - lastTime
		lastTime = newTime
		while (timeUntilNextTick > tickDur) {
			timeUntilNextTick -= tickDur
		}
		time += 1
		tick()
		render()
	}
	window.requestAnimationFrame(update)
}
function tick() {
	updatePlayer()
	for (let i = 0; i < 1; i++) {
		updateBullets()
	}

	if (player.shotCd > 0) {
		player.shotCd -= 1 * (player.shipOpts.weapons.isDead ? 0.5 : 1)
	}
	if (mouseDown && !player.isDead) {
		if (player.shotCd <= 0) {
			player.shotCd = player.fireRate

			createBullets(player)
		}
	}
	for (let i = playerQuadrant.x - 1; i <= playerQuadrant.x + 1; i++) {
		for (let j = playerQuadrant.y - 1; j <= playerQuadrant.y + 1; j++) {
			if (playerGal && distPoints(playerGal.pos, player) < quadrantSize)
				getEnemies(i, j).forEach(enemy => {
					if (
						distPoints(enemy, player) < 1000 ||
						quadrantEquals(enemy, player)
					) {
						activeEnemies.add(enemy)
					}
				})
		}
	}

	activeEnemies.forEach(enemy => enemy.update())
	activeEnemies.forEach(enemy => {
		if (
			distPoints(enemy, player) > 1000 &&
			enemy.aim != player &&
			!quadrantEquals(enemy, player) &&
			posEquals(getShipQuadrant(enemy), enemy.galaxy)
		) {
			activeEnemies.delete(enemy)
		}
	})

	activeEnemies.forEach(enemy => {
		if (enemy.isDead) {
			let arr = getEnemies(enemy.galaxy.x, enemy.galaxy.y)
			arr.splice(arr.indexOf(enemy), 1)

			activeEnemies.delete(enemy)
			if (arr.length == 0) {
				window.setTimeout(() => {
					paused = true
					openWindow(player, enemy, function () {
						player.level += 3
						console.log("unpasue")
						lastTime = window.performance.now()
						paused = false
					})
				}, 500)
			}
		}
	})
}

function render() {
	c.clearRect(0, 0, w, h)

	if (enemyLock && !enemyLock.isDead) {
		let enemyOnsc = getOnScreenPos(enemyLock.x, enemyLock.y)
		let dis = dist(w / 2, h / 2, enemyOnsc.x, enemyOnsc.y)
		let scrRad = Math.min(w, h - 300) / 2
		if (dis > scrRad * 1.5) {
			console.log(1)
			zoom = Math.min(
				ZOOM_MAX,
				Math.max(ZOOM_MIN, Math.max(zoom - 0.02, zoom * 0.99))
			)
		} else if (dis < scrRad * 0.5) {
			console.log(2)
			zoom = Math.min(
				ZOOM_MAX,
				Math.max(ZOOM_MIN, Math.min(zoom + 0.02, zoom * 1.01))
			)
		}
	}

	let quadrants = getQuadrantsToDraw(screenPos)
	hoveredGalaxy = null
	hoveredPlanet = null

	screenPos = { x: player.x, y: player.y }

	for (let i = quadrants.xStart; i <= quadrants.xEnd; i++) {
		for (let j = quadrants.yStart; j <= quadrants.yEnd; j++) {
			drawQuadrant(i, j)
		}
	}
	particles.render([BROKENCOMPS, TRAIL])

	hoveredEnemy = null
	activeEnemies.forEach(enemy => enemy.render())

	drawBullets()
	drawPlayer()

	particles.render([BULLET_HITS, EXPLOSIONS, BULLETSMOKES])

	drawHUD()
}
function createBullets(ship) {
	let weaponsOpts = ship.shipOpts.weapons
	for (let i = 0; i < weaponsOpts.amount; i++) {
		let weapOffsetX = weaponsOpts.x + +i * (weaponsOpts.w + weaponsOpts.margin)

		let disang = disAngOrigin(
			ship.size * weapOffsetX,
			ship.size * weaponsOpts.top
		)

		let bulletNShipSpd = posPlusPos(
			posPlusAng(pos(0, 0), ship.rot, ship.shotSpeed),
			ship.mot
		)
		let newSpd = disAngOrigin(bulletNShipSpd.x, bulletNShipSpd.y).dis
		addBullet(
			ship.seed,
			ship.x + Math.cos(ship.rot + PIH + disang.angle) * disang.dis,
			ship.y + Math.sin(ship.rot + PIH + disang.angle) * disang.dis,
			ship.rot,
			newSpd,
			ship.dmg,
			ship.shotLife,
			weaponsOpts.bulletColor
		)
		disang = disAngOrigin(ship.size * -weapOffsetX, ship.size * weaponsOpts.top)

		addBullet(
			ship.seed,
			ship.x + Math.cos(ship.rot + PIH + disang.angle) * disang.dis,
			ship.y + Math.sin(ship.rot + PIH + disang.angle) * disang.dis,
			ship.rot,
			newSpd,
			ship.dmg,
			ship.shotLife,
			weaponsOpts.bulletColor
		)
	}
}
function addBullet(seed, x, y, dir, spd, dmg, shotLife, color) {
	if (!bullets.hasOwnProperty(seed)) {
		bullets[seed] = []
	}
	bullets[seed].push([x, y, dir, spd, dmg, shotLife, color])
}
function updateBullets() {
	Object.values(bullets).forEach(bulletsOfSeed => {
		for (let i = bulletsOfSeed.length - 1; i >= 0; i--) {
			let bullet = bulletsOfSeed[i]

			bullet[0] += Math.cos(bullet[2]) * bullet[3]
			bullet[1] += Math.sin(bullet[2]) * bullet[3]

			if (
				--bullet[5] <= 0 ||
				bullet[0] < screenPos.x - (3 * w) / zoom ||
				bullet[1] < screenPos.y - (3 * h) / zoom ||
				bullet[0] > screenPos.x + (3 * w) / zoom ||
				bullet[1] > screenPos.y + (3 * h) / zoom
			) {
				bulletsOfSeed.splice(i, 1)
				continue
			}
		}
	})
}
function drawBullets() {
	c.lineWidth = 0.5
	Object.entries(bullets).forEach(entry => {
		let seed = entry[0]
		let bulletsOfSeed = entry[1]
		circs(
			c,
			bulletsOfSeed.map(arr => [
				getOnScreenX(arr[0]),
				getOnScreenY(arr[1]),
				Math.max(1.5, 0.1 * zoom) * (arr[5] < 50 ? arr[5] / 50 : 1)
			]),
			bulletsOfSeed.length ? rgb(getBulletColor(seed)) : "black",
			"black"
		)
	})
}

function drawQuadrant(x, y) {
	c.lineWidth = 0.1

	if (hasQuadrantGalaxy({ x, y })) {
		let opts = getGalaxyOpts(x, y)
		let rn = getNewRng(opts.seed)
		let pos = getOnScreenPos(opts.pos.x, opts.pos.y)
		let isHovered = distPoints(pos, mousePos) < opts.size * zoom
		isHovered ? (hoveredGalaxy = opts) : null
		if (zoom < 0.5) {
			if (isHovered) {
				setSs("green")
				setFs(c, "green")
				c.lineWidth = 0.5
				let tx = opts.name
				setFont(c, 16)
				const siz = opts.size * zoom * 2
				c.strokeRect(pos.x - siz / 2, pos.y - siz / 2, siz, siz)
				c.fillText(
					tx,
					pos.x - c.measureText(tx).width / 2,
					pos.y - siz / 2 - 18
				)
			}
		}

		//Draw stars

		let rad = opts.starRad * zoom

		let starX = pos.x
		let starY = pos.y
		// if (getPlayerSpeed() > 250000) {
		// 	let rem = Math.max(0, 299792 - getPlayerSpeed()) / 50000
		// 	starX = w / 2 - rem * (w / 4) * Math.cos(Math.abs(pos.x))
		// 	starY = h / 2 - rem * (h / 4) * Math.cos(Math.abs(pos.y))

		// 	let c2 = cnv2.getContext("2d")
		// 	c2.fillStyle =
		// 	"rgba(125," +
		// 	(155 + Math.random() * 100) +
		// 	"," +
		// 	(155 + Math.random() * 100) +
		// 	",0.4)"
		// 	star(c2, Math.random() * w, Math.random() * h, Math.random() * 2)
		// 	c2.fill()
		// }

		fillCirc(c, starX, starY, rad - 10 * zoom, opts.col(zoom, 1))

		for (let i = 0; i < Math.min(60, Math.max(5, 30 * Math.log(zoom))); i++) {
			setFs(
				c,
				rgb(
					[
						255,
						rndBtwn(100 + 1 / zoom, 255, rn),
						rndBtwn(50 + 1 / zoom, 255, rn),
						rn
					],
					0.09 / getInRange(zoom, 0.1, 5)
				)
			)

			c.beginPath()
			c.ellipse(
				starX,
				starY,
				rad * (0.8 + 0.4 * rn() * Math.abs(((rn() * i * 0.01) % 1) - 0.5)),
				rad * (0.8 + 0.4 * rn() * Math.abs(((rn() * i * 0.01 + 0.5) % 2) - 1)),
				rn() * PI2 + Math.abs(((rn() * i * 0.01 + 0.5) % 2) - 1),
				0,
				PI2,
				0
			)
			c.fill()
			c.closePath()
		}

		drawPlanets(opts)
	}
}

function quadrantEquals(ship1, ship2) {
	return posEquals(getShipQuadrant(ship1), getShipQuadrant(ship2))
}
function getShipQuadrant(ship) {
	return {
		x: Math.floor(ship.x / quadrantSize),
		y: Math.floor(ship.y / quadrantSize)
	}
}

function drawPlanets(opts) {
	setSs(c, "white")
	c.lineWidth = 0.1

	opts.planets
		.filter(planet => planet.rad * zoom > 1)
		.forEach(planet => drawPlanet(planet, opts))
}

function drawPlayer() {
	let x = player.x
	let y = player.y

	playerPathCounter++
	if (playerPathCounter > 10) {
		playerPathCounter = 0
		playerPath.push([x, y])
		if (playerPath.length > 500) {
			playerPath.splice(0, 1)
		}
	}
	if (player.isDead) return

	if (zoom < 5) {
		let onsc = getOnScreenPos(x, y)

		c.lineWidth = 1
		line(c, onsc, _posPlusAng(onsc, player.rot, 30), "rgb(50,150,50,0.8)")
		c.beginPath()
		setSs(c, "rgba(255,255,255,0.3)")
		if (playerPath.length) {
			let ons = getOnScreenPos(playerPath[0][0], playerPath[0][1])
			c.moveTo(ons.x, ons.y)
			playerPath.forEach(pos => {
				ons = getOnScreenPos(pos[0], pos[1])
				c.lineTo(ons.x, ons.y)
			})
			c.lineTo(onsc.x, onsc.y)
			c.stroke()
			c.closePath()
		}
	}
	let arrowUp = keysdown["ArrowUp"] || keysdown["KeyW"]
	if (arrowUp) {
		player.shipOpts.thrust.points
			.filter(el => Math.random() < 0.6)
			.forEach(p => {
				let offset = p[0] + player.shipOpts.thrust.tw * Math.random()
				let drawPos = posPlusAng(
					_posPlusAng(player, player.rot - PIH, -offset),
					player.rot,
					-p[1] - player.shipOpts.thrust.h2
				)
				particles.add(TRAIL, [
					rndBtwn(5, 50),
					drawPos.x,
					drawPos.y,
					player.rot + rndBtwn(-0.1, 0.1),
					rndBtwn(40, 60)
				])
			})
	}
	renderAShip(player, arrowUp, player.boostLeft, player.boostRight, false)

	if (zoom > 5000) {
		setFont(c, (((h / 2) * zoom) / 5000) * player.size)
		c.textBaseline = "top"
		setFs(c, "black")
		c.fillText("👨‍🚀", w / 2 - c.measureText("👨‍🚀").width / 2, h / 2)
		c.font = "12px Arial"
	}
}
function renderAShip(ship, boost, boostLeft, boostRight, showDmg) {
	let quadrantX = Math.floor(ship.x / quadrantSize)
	let quadrantY = Math.floor(ship.y / quadrantSize)
	let shipSystem = getGalaxyOpts(quadrantX, quadrantY)
	let hasGalaxy = hasQuadrantGalaxy({ x: quadrantX, y: quadrantY })
	let sunDis = hasGalaxy
		? shipSystem.size - distPoints(ship, shipSystem.pos)
		: 0
	let size = 1

	ship.size = size
	let shadeOffset = hasGalaxy ? (sunDis / shipSystem.size) * 0.25 : 0
	let onsc = getOnScreenPos(ship.x, ship.y)
	renderShip(c, onsc.x, onsc.y, size * zoom, ship.shipOpts, ship.rot, {
		ang: hasGalaxy ? anglePoints(shipSystem.pos, ship) : -1 - ship.rot - PIH,
		dis: shadeOffset,
		showDmg,
		boost,
		boostLeft,
		boostRight
	})
}
function gameOver() {
	let dialog = createDialog()

	let continueBut = getButton("Continue anyway", () => {
		reset()

		document.body.removeChild(dialog)
	})

	let newGameBut = getButton("Start another game", () => {
		quadrantCache = {}
		galaxyOptsCache = {}
		enemyCache = {}
		getNewPlayer()
		document.body.removeChild(dialog)
		paused = false
	})
	appendChildren(dialog, [
		titleDiv("Oh no. You died."),
		continueBut,
		newGameBut
	])
	window.setTimeout(() => (dialog.style.height = "100%"), 50)
}

function reset() {
	Object.values(player.shipOpts).forEach(comp => {
		comp.hp = comp.maxHp
		comp.isDead = false
	})
	player.isDead = false
	let playerGal = getShipQuadrant(player)
	if (hasQuadrantGalaxy(playerGal)) {
		let gal = getGalaxyOpts(playerGal.x, playerGal.y)
		setPos(player, gal.pos.x - gal.size, gal.pos.y - gal.size)
	} else {
		setPos(player, playerGal.x * quadrantSize, playerGal.y * quadrantSize)
	}
	posMult(player.mot, 0)
	paused = false
}
function chooseRace() {
	getNewPlayer()

	let dialog = createDialog()

	let shipCnv = createCnv(300, 300)

	let isClosed = false
	let ct = shipCnv.getContext("2d")
	let tk = () => {
		ct.save()
		ct.clearRect(0, 0, 300, 300)
		ct.translate(150, 150)
		ct.scale(40, 40)
		renderShip(ct, 0, 0, 1, player.shipOpts, -PIH, {
			ang: angle(
				mousePos.x,
				mousePos.y,
				w / 2,
				shipCnv.getBoundingClientRect().top + 150
			),
			dis: 0.2,
			boost: true,
			boostLeft: true,
			boostRight: true
		})
		ct.restore()
		if (!isClosed) {
			window.requestAnimationFrame(tk)
		}
	}
	tk()

	let raceName = subTitleDiv(player.race)
	appendChildren(dialog, [
		createDiv(""),
		titleDiv("Choose a race"),
		raceName,
		shipCnv,
		getButton("New Race", () => {
			getNewPlayer()
			raceName.innerHTML = player.race
		}),
		createDiv(""),
		createDiv(""),
		getButton("Confirm", () => {
			isClosed = true
			document.body.removeChild(dialog)
			paused = false
		}),
		createDiv(""),
		createDiv(""),
		createDiv("")
	])

	dialog.style.height = "100%"
}
function startScreen() {
	let dialog = createDialog()

	appendChildren(dialog, [
		createDiv(""),
		titleDiv("Space"),
		subTitleDiv(
			"Mouse to aim. </br> WASD or Arrow keys to thrust. </br> Click to shoot. </br> Scroll to Zoom "
		),
		getButton("Start game", () => {
			getNewPlayer()
			document.body.removeChild(dialog)

			chooseRace()
		}),
		createDiv("")
	])

	dialog.style.height = "100%"
}
function updatePlayer() {
	console.log(player)
	playerQuadrant = getShipQuadrant(player)
	playerGal = Object.values(player.shipOpts).forEach(component => {
		if (!component.isDead && component.hp <= 0) {
			component.isDead = true
			if (component == player.shipOpts.hull) {
				Object.values(player.shipOpts)
					.filter(el => el != player.shipOpts.weapons)
					.forEach(component => addBrokenComponent(player, component))
				player.isDead = true
				addExplosion(player)
				window.setTimeout(() => {
					paused = true
					gameOver()
				}, 2500)
				return
			}
		}
	})

	let shipOpts = player.shipOpts
	if (hasQuadrantGalaxy(playerQuadrant)) {
		playerGal = getGalaxyOpts(playerQuadrant.x, playerQuadrant.y)

		updatePlayerGrav(playerGal)
		player.isOnPlanet = false
		player.isRepairing = false
		playerGal.planets.forEach(planet => {
			if (distPoints(player, getPlanetPos(planet, time)) < planet.rad) {
				Object.values(shipOpts).forEach(component => {
					player.isOnPlanet = true
					component.hp = Math.min(
						component.maxHp,
						component.hp + component.maxHp / 1000
					)
					if (component.hp == component.maxHp) {
						component.isDead = false
					} else {
						player.isRepairing = true
					}
				})
			}
		})
	} else {
		playerGal = null
	}
	let speed = player.speed * (shipOpts.thrust.isDead ? 0.25 : 1)
	let turnSpeed = player.turnSpeed * (shipOpts.wings.isDead ? 0.5 : 1)
	if (keysdown["ArrowUp"] || keysdown["KeyW"]) {
		posPlusAng(player.thrust, player.rot, speed)
	}
	if (keysdown["ArrowDown"] || keysdown["KeyS"]) {
		posPlusAng(player.thrust, player.rot, -speed)
	}

	let turn = -turnTowards(
		angle(w / 2, h / 2, mousePos.x, mousePos.y),
		player.rot,
		turnSpeed * (shipOpts.wings.isDead ? 0.1 : 1)
	)
	player.boostLeft = Math.max(0, turn < 0 ? 10 : player.boostLeft - 1)

	player.boostRight = Math.max(0, turn > 0 ? 10 : player.boostRight - 1)

	if (
		compareAngles(angle(w / 2, h / 2, mousePos.x, mousePos.y), player.rot) <
		turnSpeed
	) {
		player.rot = angle(w / 2, h / 2, mousePos.x, mousePos.y)
	} else {
		player.rot += turn * turnSpeed
	}

	if (keysdown["ArrowLeft"] || keysdown["KeyA"]) {
		posPlusAng(player.thrust, player.rot + PIH, -speed)
	}
	if (keysdown["ArrowRight"] || keysdown["KeyD"]) {
		posPlusAng(player.thrust, player.rot + PIH, speed)
	}

	posPlusPos(player.mot, player.thrust)

	if (getPlayerSpeed() > 299792) {
		let factor = getPlayerSpeed() / 299792
		posMult(player.mot, 1 / factor)
	}

	posPlusPos(player, player.mot)

	posMult(player.thrust, 0)

	checkCollisions(player, true)
}

function checkCollisions(ship, ignoreBroken) {
	Object.entries(bullets)
		.filter(entry => entry[0] != ship.seed)
		.forEach(entry => {
			let seed = entry[0]
			let bulletsOfSeed = entry[1]
			for (let i = bulletsOfSeed.length - 1; i >= 0; i--) {
				let bullet = bulletsOfSeed[i]
				let da = disAng(bullet[0], bullet[1], ship.x, ship.y)
				let x = Math.cos(da.angle - ship.rot + PIH) * da.dis
				let y = Math.sin(da.angle - ship.rot + PIH) * da.dis

				Object.keys(components).forEach(key => {
					let comp = ship.shipOpts[key]
					if (
						(!comp.isDead || ignoreBroken) &&
						c.isPointInPath(comp.cpath ? comp.cpath : comp.path, x, y)
					) {
						bulletsOfSeed.splice(i, 1)
						comp.hitMaskPath.moveTo(x, y)
						comp.hitMaskPath.arc(x, y, rndBtwn(0.02, 0.1), 0, 8)
						comp.hp = Math.max(0, comp.hp - bullet[4])
						comp.isHit = 15
						particles.add(BULLET_HITS, [
							rndBtwn(10, 20),
							x,
							y,
							ship,
							getBulletColor(seed)
						])
						particles.add(BULLETSMOKES, [
							rndBtwn(5, 30),
							bullet[0] + rndBtwn(-1, 1),
							bullet[1] + rndBtwn(-1, 1)
						])
						return
					}
				})
			}
		})
}

function addBrokenComponent(ship, component) {
	particles.add(BROKENCOMPS, [
		250,
		copyPos(ship),
		copyPos(ship.mot),
		ship.rot + PIH,
		ship.size,
		component
	])
}

function updatePlayerGrav(opts) {
	opts.planets.forEach(planet => {
		let pos = getPlanetPos(planet, time)
		let nextPos = getPlanetPos(planet, time + 1)
		let dis = distPoints(player, pos)
		if (dis < planet.rad * 10) {
			let ang = anglePoints(player, pos)
			player.mot.x +=
				(Math.cos(ang) * 0.1 * planet.rad + 0.5 * (nextPos.x - pos.x)) /
				Math.max(planet.rad, dis) ** 2
			player.mot.y +=
				(Math.sin(ang) * 0.1 * planet.rad + 0.5 * (nextPos.y - pos.y)) /
				Math.max(planet.rad, dis) ** 2

			if (debug) {
				setSs(c, "yellow")
				c.lineWidth = 0.5
				let on = getOnScreenPos(player.x, player.y)
				c.beginPath()
				c.moveTo(on.x, on.y)
				c.lineTo(
					on.x +
						((Math.cos(ang) * 10 * planet.rad) /
							Math.max(planet.rad, dis) ** 2) *
							1000,
					on.y +
						((Math.sin(ang) * 10 * planet.rad) /
							Math.max(planet.rad, dis) ** 2) *
							1000
				)
				c.stroke()
				c.closePath()
			}
		}
	})
	let sunAng = anglePoints(player, opts.pos)
	let sunDis = distPoints(opts.pos, player)
	player.mot.x +=
		(Math.cos(sunAng) * 0.1 * opts.starRad) /
		Math.max(opts.starRad, sunDis) ** 2
	player.mot.y +=
		(Math.sin(sunAng) * 0.1 * opts.starRad) /
		Math.max(opts.starRad, sunDis) ** 2

	if (debug) {
		setSs(c, "yellow")
		c.lineWidth = 0.5
		let on = getOnScreenPos(player.x, player.y)
		c.beginPath()
		c.moveTo(on.x, on.y)
		c.lineTo(
			on.x +
				((Math.cos(sunAng) * 20 * opts.starRad) /
					Math.max(opts.starRad, sunDis) ** 2) *
					1000,
			on.y +
				((Math.sin(sunAng) * 20 * opts.starRad) /
					Math.max(opts.starRad, sunDis) ** 2) *
					1000
		)
		c.stroke()
		c.closePath()
	}
}
function drawPlanet(planet) {
	let planetPos = getPlanetPos(planet, time)
	let onScreenPos = getOnScreenPos(planetPos.x, planetPos.y)
	if (distPoints(onScreenPos, mousePos) < planet.rad * zoom) {
		console.log("hovered")
		hoveredPlanet = planet
	}
	let ang = planet.startAng + time * planet.spd
	c.save()

	fillCirc(c, onScreenPos.x, onScreenPos.y, planet.rad * zoom, planet.col)

	c.clip()
	c.beginPath()

	let fs = "rgba(255,255,255,0.5)"
	let offP = _posPlusAng(onScreenPos, ang, -planet.rad * zoom * 1.7)
	if (zoom > 0.05) {
		fs = c.createRadialGradient(
			offP.x,
			offP.y,
			0,
			offP.x,
			offP.y,
			planet.rad * zoom * 3
		)
		fs.addColorStop(0, rgb([255, 255, 255], 0.5))
		fs.addColorStop(1, rgb([0, 0, 0], 0))
	}
	fillCirc(c, offP.x, offP.y, planet.rad * zoom * 2, fs)
	let drShad = (ship, showDmg) => {
		let ons = getOnScreenPos(ship.x, ship.y)
		let dis = distPoints(ship, planetPos)
		if (dis < planet.rad * 5) {
			let p = _posPlusAng(ons, ang, Math.sqrt(dis * zoom * 150 + 150))
			setFs(c, planet.col)
			renderShip(c, p.x, p.y, 0.95 * zoom, ship.shipOpts, ship.rot, {
				fill: planet.col,
				showDmg
			})
		}
	}
	drShad(player, false)
	activeEnemies.forEach(enemy => drShad(enemy, true))

	c.restore()
}

function getStarCol(zoomRad, a, rn1, rn2) {
	let col = Math.min(255, -zoomRad * 5 + 10 + Math.floor(rn1 * 200))
	let col2 = Math.min(255, -zoomRad * 5 + 10 + Math.floor(rn2 * 200))
	setFs(c, rgb([Math.max(col, Math.min(zoomRad * 50, 255)), col, col2], a))
}

function getPlanetColor(rn) {
	return rgb(
		[
			Math.min(255, Math.floor(rn() * 75)),
			Math.min(255, Math.floor(rn() * 75)),
			Math.min(255, Math.floor(rn() * 75))
		],
		1
	)
}

function hasQuadrantGalaxy(pos) {
	if (!quadrantCache.hasOwnProperty(pos.x)) {
		quadrantCache[pos.x] = {}
	}
	if (!quadrantCache[pos.x].hasOwnProperty(pos.y)) {
		quadrantCache[pos.x][pos.y] =
			getNewRng(
				"" + ((Math.abs(pos.x * 10 + 345) * Math.abs(pos.y * 3 + 213)) % 1234)
			)() > 0.9
	}
	return quadrantCache[pos.x][pos.y]
}

function getGalaxyOpts(x, y) {
	if (!hasQuadrantGalaxy({ x, y })) {
		return {}
	}
	if (!galaxyOptsCache.hasOwnProperty(x)) {
		galaxyOptsCache[x] = {}
	}
	if (!galaxyOptsCache[x].hasOwnProperty(y)) {
		let a = x > y ? -2 * x - 1 : 2 * x
		let b = x > y ? -2 * y - 1 : 2 * y
		let seed = (a + b) * (a + b + 1) * 0.5 + b
		let rn = getNewRng(seed)

		if (!seeds.hasOwnProperty(seed)) {
			seeds[seed] = [x, y]
		} else {
			console.log([x, y], seed)
		}
		let starRad = 60 + 60 * rn()
		let offsetX =
			(Math.sign(rn() - rn()) * 0.1 + (rn() - rn()) * 0.2) * quadrantSize
		let offsetY =
			(Math.sign(rn() - rn()) * 0.1 + (rn() - rn()) * 0.2) * quadrantSize

		let starPos = {
			x: x * quadrantSize + quadrantSize / 2 + offsetX,
			y: y * quadrantSize + quadrantSize / 2 + offsetY
		}
		let maxRadOfGalaxy =
			(quadrantSize / 2 - Math.max(Math.abs(offsetX), Math.abs(offsetY))) *
				0.95 -
			20

		let planetAmount = 2 + Math.floor(rn() * 9)
		let planets = []
		let curDis = 2 * starRad

		for (let i = 0; i < planetAmount && curDis < maxRadOfGalaxy; i++) {
			let rad = 15 + 15 * rn()
			let dist = Math.max(
				rad * 2 + rad * rn(),
				((maxRadOfGalaxy - curDis - rad * 2) / (planetAmount - i)) * rn()
			)
			let planet = {
				rad: rad,
				dist: curDis + dist,
				spd: rn() * 0.0012 + 0.0005,
				spd2: rn() * 0.002 + 0.001,
				startAng: rn() * PI2,
				starPos,
				col: getPlanetColor(rn),
				star: [x, y],
				index: i
			}
			curDis += dist + rad
			planets.push(planet)
		}
		let rn1 = rn()
		let rn2 = rn()
		let col = (zoom, a) => getStarCol(starRad * zoom, 1, rn1, rn2)
		let name = getGalaxyName(rn)
		galaxyOptsCache[x][y] = {
			pos: starPos,
			planets,
			starRad,
			size: curDis,
			col,
			name,
			seed,
			x,
			y
		}
	}
	return galaxyOptsCache[x][y]
}

function getEnemies(x, y) {
	if (
		(conqueredQuadrants[x] && conqueredQuadrants[x][y]) ||
		!hasQuadrantGalaxy({ x, y })
	) {
		return []
	}
	if (!enemyCache.hasOwnProperty(x)) {
		enemyCache[x] = {}
	}
	if (!enemyCache[x].hasOwnProperty(y)) {
		console.log("Actived Enemies in " + x + "," + y)
		enemyCache[x][y] = []

		let galaxy = getGalaxyOpts(x, y)
		let seed = galaxy.seed
		let rn = getNewRng(seed)
		let shipAmount = Math.ceil(3 + (rn() * 12 * player.level) / 500)
		let enemyOpts = getEnemyOpts(rn, seed)
		console.log(enemyOpts)
		console.log("enemyStats: " + enemyOpts)
		console.log(enemyOpts)
		enemyOpts.galaxy = galaxy
		for (let i = 0; i < shipAmount; i++) {
			enemyCache[x][y].push(new Enemy(enemyOpts))
		}
	}

	return enemyCache[x][y]
}

function getEnemyOpts(rn, seed) {
	let rnds = [0.5, 0.6, 0.6, 1, 1, 1.1, 1.1, 1.2].sort((a, b) =>
		rndBtwn(-1, 1, rn)
	)
	let rnn = () => rnds.shift() + rndBtwn(-0.1, 0.1, rn)
	let lvl = Math.min(500, player.level) / 500
	const shotDis = rndBtwn(9, 9 + lvl * 500, rnn)
	const shotSpeed = 0.1 + 1.9 * lvl * rnn()
	let spd = 0.003 + ((0.017 * player.level) / 500) * rnn()
	return {
		seed,
		shotDis,
		turnSpeed: 0.05 + lvl * 0.04 * rnn(),
		speed: spd,
		enemyDistance: Math.max(75, shotDis * (1 + rnn())),
		dmg: Math.ceil(1 + lvl * 800 * rnn()),
		fireRate: Math.min(
			30,
			30 - Math.ceil((Math.log(1 + lvl * 500) / Math.log(501)) * 28 * rnn())
		),
		shotSpeed,
		size: 1 + rnn(),
		shotLife: shotDis / shotSpeed,
		shotCd: 0,
		race: getRaceName(rn)
	}
}
export function getPlanetPos(planet, time) {
	let ang = planet.startAng + time * planet.spd
	return {
		x: planet.starPos.x + Math.cos(ang) * planet.dist,
		y: planet.starPos.y + Math.sin(ang) * planet.dist
	}
}

function getOnScreenPos(x, y) {
	return {
		x: getOnScreenX(x),
		y: getOnScreenY(y)
	}
}
function getOnScreenX(x) {
	return w / 2 - screenPos.x * zoom + x * zoom
}
function getOnScreenY(y) {
	return h / 2 - screenPos.y * zoom + y * zoom
}

function getBulletColor(seed) {
	if (!bulletColors.hasOwnProperty(seed)) {
		let rn = getNewRng(seed)
		bulletColors[seed] = [
			Math.floor(155 + 100 * rn()),
			Math.floor(155 + 100 * rn()),
			Math.floor(155 + 100 * rn())
		]
	}
	return bulletColors[seed]
}

const drawHUD = () => {
	ch.font = "24px Arial"
	ch.clearRect(0, 0, w, h)
	drawSpeedAndDirection()

	if (playerGal && playerGal.planets) {
		drawRadar()
	} else {
		drawInterstellarRadar()
	}

	drawHudShip()

	drawComponentHp()

	if (debug) {
		let stats = {
			speed: player.speed,
			turnSpeed: player.turnSpeed,
			dmg: player.dmg,
			fireRate: player.fireRate,
			shotSpeed: player.shotSpeed,
			shotDis: player.shotDis,
			shotLife: player.shotLife,
			zoom: zoom
		}
		ch.fillText("Player Stats", 20, 400)
		Object.entries(stats).forEach((entry, i) => {
			ch.fillText(entry[0] + ": " + entry[1], 20, 430 + i * 30)
		})

		ch.fillText("playerLock:" + enemyLock, 20, 700)
	}
}
function drawComponentHp() {
	let y = 50
	let x = 275
	setSs(ch, "green")
	ch.lineWidth = 1
	ch.textBaseline = "top"
	setFont(ch, 18)
	ch.fontWeight = 800
	getComponentNames().forEach(component => {
		setFs(ch, "green")
		ch.fillText(components[component].name, x, y)
		ch.strokeRect(x, y + 20, 100, 10)
		setFs(ch, getComponentColor(player.shipOpts[component]))
		ch.fillRect(
			x,
			y + 20,
			(100 * player.shipOpts[component].hp) / player.shipOpts[component].maxHp,
			10
		)
		y += 55
	})

	setFs(ch, getComponentColor(player.shipOpts.hull))
	ch.strokeRect(50, 35, 200, 12)
	ch.fillRect(
		50,
		35,
		(200 * player.shipOpts.hull.hp) / player.shipOpts.hull.maxHp,
		12
	)

	y -= 55
	setFs(
		ch,
		"rgba(200,200,50," +
			(0.5 + (0.5 - (0.5 * player.shotCd) / player.fireRate)) +
			")"
	)
	ch.strokeRect(x, y + 30, 100, 4)
	ch.fillRect(x, y + 30, 100 - (100 * player.shotCd) / player.fireRate, 4)
}

function drawHudShip() {
	setSs(ch, "green")
	setFs(ch, "black")

	ch.strokeRect(25, 25, 400, 300)
	ch.fillRect(25, 25, 400, 300)

	translateToAndDraw(ch, 150, 175, () => {
		ch.lineWidth = 0.03
		renderShip(ch, 0, 0, 40, player.shipOpts, player.rot, {
			fill: "black",
			stroke: "green"
		})
	})
}
function drawInterstellarRadar() {
	blinkTick++
	let x = w - 330
	let y = 25
	setFs(ch, "black")
	ch.fillRect(x, y, 300, 300)
	setFs(ch, "green")
	ch.strokeRect(x, y, 300, 300)

	ch.save()
	ch.rect(x, y, 300, 300)
	ch.clip()
	ch.lineWidth = 0.2
	ch.beginPath()
	for (let i = 0; i < 8; i++) {
		ch.moveTo(x, Math.floor(y + (i * 300) / 8))
		ch.lineTo(x + 300, Math.floor(y + (i * 300) / 8))

		ch.moveTo(Math.floor(x + (i * 300) / 8), y)
		ch.lineTo(Math.floor(x + (i * 300) / 8), y + 300)
	}
	ch.stroke()
	ch.closePath()

	let size = 4
	let currentGal = getShipQuadrant(player)
	let sizQuotient = (quadrantSize * size * 2) / 300
	let getRadarX = theX => x + 150 + (theX - player.x) / sizQuotient
	let getRadarY = theY => y + 150 + (theY - player.y) / sizQuotient

	for (let qx = currentGal.x - size; qx < currentGal.x + size; qx++) {
		for (let qy = currentGal.y - size; qy < currentGal.y + size; qy++) {
			if (hasQuadrantGalaxy({ x: qx, y: qy })) {
				let opts = getGalaxyOpts(qx, qy)
				fillCirc(
					ch,
					getRadarX(opts.pos.x),
					getRadarY(opts.pos.y),
					opts.starRad / ((quadrantSize * size) / 300),
					"green"
				)
			}
		}
	}
	setFont(ch, 12)
	for (let qx = currentGal.x - size; qx < currentGal.x + size; qx++) {
		for (let qy = currentGal.y - size; qy < currentGal.y + size; qy++) {
			if (hasQuadrantGalaxy({ x: qx, y: qy })) {
				let opts = getGalaxyOpts(qx, qy)
				let tx = opts.name
				let wd = ch.measureText(tx).width
				ch.fillText(
					tx,
					getRadarX(opts.pos.x) - wd / 2,
					getRadarY(opts.pos.y) + 5
				)
			}
		}
	}

	fillCirc(
		ch,
		x + 150,
		y + 150,
		2 + (3 * Math.abs((blinkTick % 200) - 100)) / 100,
		"yellow"
	)

	ch.restore()
}
function drawRadar() {
	blinkTick++
	let x = w - 330
	let y = 25
	ch.save()
	setFs(ch, "black")

	ch.beginPath()
	ch.rect(x, y, 300, 300)
	ch.clip()
	ch.fill()
	ch.closePath()
	setFs(ch, "green")
	ch.strokeRect(x, y, 300, 300)

	ch.lineWidth = 0.4
	ch.beginPath()
	for (let i = 0; i < 6; i++) {
		ch.moveTo(x, y + (i * 300) / 6)
		ch.lineTo(x + 300, y + (i * 300) / 6)

		ch.moveTo(x + (i * 300) / 6, y)
		ch.lineTo(x + (i * 300) / 6, y + 300)
	}
	ch.stroke()
	ch.closePath()

	let scale = (playerGal.size * 1.2) / 150
	let getRadarX = theX => x + 150 + (theX - playerGal.pos.x) / scale
	let getRadarY = theY => y + 150 + (theY - playerGal.pos.y) / scale

	fillCirc(ch, x + 150, y + 150, playerGal.starRad / scale, "green")

	playerGal.planets.forEach(planet => {
		let pos = getPlanetPos(planet, time)
		fillCirc(
			ch,
			getRadarX(pos.x),
			getRadarY(pos.y),
			Math.max(3, planet.rad / scale),
			"green"
		)
	})
	ch.closePath()
	ch.fill()
	let drawRadarDot = (ship, ticker, col) => {
		fillCirc(
			ch,
			Math.max(x, Math.min(x + 300, getRadarX(ship.x))),
			Math.max(y, Math.min(y + 300, getRadarY(ship.y))),
			ticker,
			col
		)
	}
	let enemies = getEnemies(playerGal.x, playerGal.y)
	enemies.forEach(enemy => {
		drawRadarDot(
			enemy,
			2 + (3 * Math.abs((Math.abs(blinkTick - 100) % 200) - 100)) / 100,
			"red"
		)
	})

	drawRadarDot(
		player,
		2 + (3 * Math.abs((blinkTick % 200) - 100)) / 100,
		"yellow"
	)
	let px = getRadarX(player.x)
	let py = getRadarY(player.y)

	setSs(ch, "yellow")
	ch.globalAlpha = 0.5
	ch.lineWidth = 0.5
	ch.beginPath()
	if (playerPath.length) {
		let onsX = getRadarX(playerPath[0][0])
		let onsY = getRadarY(playerPath[0][1])

		ch.moveTo(onsX, onsY)
		playerPath.forEach(pos => {
			onsX = getRadarX(pos[0])
			onsY = getRadarY(pos[1])
			ch.lineTo(onsX, onsY)
		})
		ch.lineTo(px, py)
		ch.stroke()
		ch.closePath()
	}
	ch.globalAlpha = 1

	let tx = playerGal.name || " "
	let wd = ch.measureText(tx).width

	setFs(ch, "green")
	ch.fillText(tx, w - 175 - wd / 2, 30)

	tx = "Hostile Ships: " + enemies.length
	wd = ch.measureText(tx).width
	if (enemies) {
		ch.fillText(tx, w - 175 - wd / 2, 300)
	}
	ch.restore()
}
function drawSpeedAndDirection() {
	setFs(ch, "green")
	let playerSpeed = getPlayerSpeed()
	setFont(ch, 17)
	let tx = "Current Speed: " + playerSpeed + "km/s"

	let wd = ch.measureText(tx).width
	ch.fillText(tx, w / 2 - wd / 2, 280)

	let dis = Math.min(45, 50 * dist(0, 0, player.mot.x, player.mot.y))
	let ang = angle(0, 0, player.mot.x, player.mot.y)

	ch.lineWidth = 2
	fillCirc(ch, w / 2, 175, 90, "black")
	strokeCirc(ch, w / 2, 175, 90, "green")

	ch.lineWidth = 2
	ch.beginPath()
	ch.moveTo(w / 2, 175)
	ch.lineTo(w / 2 + Math.cos(ang) * dis, 175 + Math.sin(ang) * dis)
	drawEvenTriangle(
		ch,
		w / 2 + Math.cos(ang) * (dis + 7.5),
		175 + Math.sin(ang) * (dis + 7.5),
		10,
		ang
	)

	ch.closePath()
	ch.stroke()
	ch.restore()
}

function getPlayerSpeed() {
	return Math.floor(1000 * dist(0, 0, player.mot.x, player.mot.y)) / 10
}

function getComponentColor(component) {
	if (component.isDead) {
		return "grey"
	} else if (component.isHit) {
		component.isHit--
		return "red"
	} else {
		return rgb(
			[
				128 - (128 * component.hp) / component.maxHp,
				0 + (128 * component.hp) / component.maxHp,
				0
			],
			1
		)
	}
}

function isPosOnScreen(pos, marg) {
	return pos.x > -marg && pos.x < w + marg && pos.y > -marg && pos.y < h + marg
}
