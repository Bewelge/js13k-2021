import { components, getComponentNames } from "./components.js"
import { openWindow } from "./mergeComponents.js"
import { getGalaxyName, getRaceName } from "./names.js"
import { Particles } from "./particles.js"
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
	posPlus,
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
	_posMult
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
var bulletHitsSmoke = []
var quadrantCache = {}
var discoveredGalaxies = {
	0: { "-1": true }
}
var galaxyOptsCache = {}
let seeds = {}
var starImg
var playerPath = []
var enemyCache = {}
var bulletColors = {}
var blinkTick = 0

var trailSmoke
var bulletHits
var bulletSmokes, brokenComponents
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

	player = {
		seed: randomStartSeed,
		race: getRaceName(rn),
		boostLeft: false,
		boostRight: false,
		x: screenPos.x + 25,
		y: screenPos.y + 25,
		level: 5,
		rot: -PIH,
		planet: null,
		thrust: {
			x: 0,
			y: 0
		},
		rotThrust: 0,
		mot: {
			x: 0,
			y: 0
		},
		acc: 0.1,
		speed: 0.003,
		turnSpeed: 0.05,
		turnStability: 0.95,
		fireRate: 1, // 60,
		dmg: 1,
		shotCd: 0,
		shotLife: 20 / 0.01,
		shotSpeed: 0.1, //0.01,
		shotDis: 30,

		shipOpts: getShipOpts(randomStartSeed, 5 / 500)
	}
}

export class Enemy {
	constructor(opts) {
		this.seed = opts.seed
		this.shipOpts = getShipOpts(this.seed, player.level / 500)
		this.race = getRaceName(getNewRng(opts.seed))

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
		posPlusAng(this.mot, -this.rot, 0.05)
		createBullets(
			this.seed,
			this.shipOpts.weapons,
			this,
			this.size,
			this.rot,
			this.shotSpeed,
			this.dmg,
			this.shotLife
		)
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

				addBrokenComponent(this, component)
			}
		})

		if (this.shipOpts.hull.isDead) {
			this.isDead = true
			player.level += 0.2
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
		if (distPoints(mousePos, onsc) < zoom * this.size * 10) {
			if (hoveredEnemy == null) {
				hoveredEnemy = this
				c.fillStyle = "green"
				c.strokeStyle = "rgba(200,50,50,0.5)"
				c.textBaseline = "top"
				setFont(c, 14)

				let size = this.size * zoom * 6
				let x = onsc.x - 60
				let y = onsc.y - 40 - size
				c.fillText(this.race + " Ship", x, y - 20)
				setFont(c, 14)
				Object.entries(components).forEach((entry, i) => {
					let yy = y + 13 * i
					c.fillText(entry[1].name, x, yy)
					c.fillRect(
						onsc.x,
						yy,
						(60 * this.shipOpts[entry[0]].hp) / this.shipOpts[entry[0]].maxHp,
						5
					)
				})
				c.fillStyle = "rgba(200,50,50,0.3)"
				c.strokeRect(onsc.x - size / 2, onsc.y - size / 2, size, size)
			}
		}
		if (!isPosOnScreen(onsc, zoom)) {
			let x = getInRange(onsc.x, 0, w)
			let y = getInRange(onsc.y, 0, h)
			c.strokeStyle = "rgba(200,50,50,0.7)"
			c.lineWidth = 2
			c.beginPath()
			drawEvenTriangle(c, x, y, 15, angle(onsc.x, onsc.y, x, y))
			c.closePath()
			c.stroke()
		} else {
			renderAShip(this, this.boost, this.boostLeft, this.boostRight, true)
		}

		//DELETE
		if (debug) {
			c.strokeStyle = "rgba(255,255,255,0.5)"
			let ons = getOnScreenPos(this.x, this.y)
			c.lineWidth = 0.5
			c.beginPath()
			c.arc(ons.x, ons.y, this.enemyDistance * zoom, 0, 8)
			c.closePath()
			c.stroke()
			c.strokeStyle = "rgba(255,0,0,0.5)"
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
			0.25 *
			Math.min(1, dis / this.enemyDistance) *
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
		keysdown[ev.key] = true
		if (debug && ev.key == "k") {
			killall()
		}
	})
	window.addEventListener("keyup", ev => {
		keysdown[ev.key] = false
	})
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
			Math.max(ZOOM_MIN, zoom * (wheel < 0 ? 0.97 : 1.03))
		)

		delay = false

		setZoomHandleFromZoom()
	})

	initParticles()

	startScreen()
	update()
}

function initParticles() {
	trailSmoke = new Particles(
		() => {
			c.fillStyle = "rgba(255,255,255,0.3)"
		},
		el => {
			el[1] -= ((Math.cos(el[3]) / 50) * (60 - el[4])) / 60
			el[2] -= ((Math.sin(el[3]) / 50) * (60 - el[4])) / 60
			el[4] *= 0.999
			let onsc = getOnScreenPos(el[1], el[2])
			let siz = ((0.3 * el[4]) / 75) * (0.2 + 0.8 * Math.random()) * zoom

			c.beginPath()

			let z = Math.min(30, zoom)
			for (let i = 0; i < Math.random() * 5; i++) {
				let x = onsc.x + rndBtwn(-siz, siz)
				let y = onsc.y + rndBtwn(-siz, siz)
				c.moveTo(x, y) // 0, 8)
				c.arc(x, y, siz, 0, PI2) // 0, 8)
			}

			c.fill()
			c.closePath()
		},
		() => {},
		250
	)

	bulletHits = new Particles(
		() => {},
		el => {
			let disAng = disAngOrigin(el[1], el[2])
			let x = Math.cos(disAng.ang + PIH + el[3].rot) * disAng.dis
			let y = Math.sin(disAng.ang + PIH + el[3].rot) * disAng.dis
			hitExplosion(
				c,
				getOnScreenPos(el[3].x + x, el[3].y + y),
				0.02 * Math.min(15, zoom)
			)
		},
		() => {},
		250
	)
	bulletSmokes = new Particles(
		() => {},
		el => {
			c.fillStyle = rgb(el[3], Math.random())

			let onsc = getOnScreenPos(el[1], el[2])
			let siz = el[0] / 10
			c.fillRect(
				onsc.x - (siz / 2) * zoom,
				onsc.y - (siz / 2) * zoom,
				siz * zoom,
				siz * zoom
			)
		},
		() => {},
		250
	)

	brokenComponents = new Particles(
		() => {},
		el => {
			translateToAndDraw(c, el[1], el[2], () => {
				scaleRotate(c, zoom * el[3], el[4])
			})

			c.fill(el[7].path)

			c.restore()
			el[1] += Math.cos(el[5]) * el[6]
			el[2] += Math.sin(el[5]) * el[6]
			el[4] += 0.04
			el[3] *= 0.99
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
	for (let i = 0; i < 10; i++) {
		updateBullets()
	}

	if (player.shotCd > 0) {
		player.shotCd -= 1 * (player.shipOpts.weapons.isDead ? 0.5 : 1)
	}
	if (mouseDown) {
		if (player.shotCd <= 0) {
			player.shotCd = player.fireRate

			createBullets(
				player.seed,
				player.shipOpts.weapons,
				player,
				player.size,
				player.rot,
				player.shotSpeed,
				player.dmg,
				player.shotLife
			)
		}
	}
	let pQ = getShipQuadrant(player)
	for (let i = pQ.x - 1; i <= pQ.x + 1; i++) {
		for (let j = pQ.y - 1; j <= pQ.y + 1; j++) {
			let gOpts = getGalaxyOpts(pQ.x, pQ.y)

			if (gOpts.pos && distPoints(gOpts.pos, player) < quadrantSize)
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
			!quadrantEquals(enemy, player)
		) {
			console.log("Removed active enemy")
			activeEnemies.delete(enemy)
		}
	})

	activeEnemies.forEach(enemy => {
		if (enemy.isDead) {
			let arr = enemyCache[enemy.galaxy.x][enemy.galaxy.y]
			arr.splice(arr.indexOf(enemy), 1)

			if (arr.length == 0) {
				paused = true
				openWindow(player, enemy, function () {
					player.level += 3
					console.log("unpasue")
					lastTime = window.performance.now()
					paused = false
				})
			}
			activeEnemies.delete(enemy)
			if (arr.length == 0) {
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
			zoom = Math.min(
				ZOOM_MAX,
				Math.max(ZOOM_MIN, Math.max(zoom - 0.02, zoom * 0.99))
			)
			console.log(1)
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
	brokenComponents.render()
	hoveredEnemy = null
	activeEnemies.forEach(enemy => enemy.render())

	trailSmoke.render()
	drawPlayer()

	drawBullets()
	bulletHits.render()
	bulletSmokes.render()
	let pq = getShipQuadrant(player)
	drawHUD(
		getGalaxyOpts(pq.x, pq.y),
		enemyCache[pq.x] ? enemyCache[pq.x][pq.y] : [],
		time
	)
}
function createBullets(
	seed,
	weaponsOpts,
	ship,
	shipSize,
	dir,
	spd,
	dmg,
	shotLife,
	playerDir
) {
	for (let i = 0; i < weaponsOpts.amount; i++) {
		let weapOffsetX = weaponsOpts.x + +i * (weaponsOpts.w + weaponsOpts.margin)

		let dis = dist(0, 0, shipSize * weapOffsetX, shipSize * weaponsOpts.top)
		let ang = angle(0, 0, shipSize * weapOffsetX, shipSize * weaponsOpts.top)

		let shootDir = playerDir ? playerDir : dir
		let xSpd = Math.cos(dir) * spd + ship.mot.x / 10
		let ySpd = Math.sin(dir) * spd + ship.mot.y / 10
		let newSpd = dist(0, 0, xSpd, ySpd)
		addBullet(
			seed,
			ship.x + Math.cos(dir + PIH + ang) * dis,
			ship.y + Math.sin(dir + PIH + ang) * dis,
			shootDir,
			newSpd,
			dmg,
			shotLife,
			weaponsOpts.bulletColor
		)
		dis = dist(0, 0, shipSize * -weapOffsetX, shipSize * weaponsOpts.top)
		ang = angle(0, 0, shipSize * -weapOffsetX, shipSize * weaponsOpts.top)
		addBullet(
			seed,
			ship.x + Math.cos(dir + PIH + ang) * dis,
			ship.y + Math.sin(dir + PIH + ang) * dis,
			shootDir,
			newSpd,
			dmg,
			shotLife,
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
	c.strokeStyle = "rgba(255,255,255,0.1)"
	c.strokeStyle = "rgba(0,0,0,1 w)"
	c.lineWidth = 0.5
	Object.entries(bullets).forEach(entry => {
		let seed = entry[0]
		let bulletsOfSeed = entry[1]
		c.fillStyle = bulletsOfSeed.length ? rgb(bulletsOfSeed[0][6]) : "black"
		c.beginPath()
		bulletsOfSeed.forEach(bullet => {
			let pos = getOnScreenPos(bullet[0], bullet[1])
			c.moveTo(pos.x - 2, pos.y - 2)
			c.arc(
				pos.x - 2,
				pos.y - 2,
				0.1 * zoom * (bullet[5] < 50 ? bullet[5] / 50 : 1),
				0,
				8
			)
			// c.fillRect(pos.x - 2, pos.y - 2, 4, 4)
		})
		c.fill()
		c.closePath()
		c.stroke()
	})
}

function drawQuadrant(x, y) {
	c.lineWidth = 0.1

	if (hasQuadrantGalaxy({ x, y })) {
		if (isNaN(x)) {
			console.log(x)
		}
		let opts = getGalaxyOpts(x, y)
		let rn = getNewRng(opts.seed)
		let pos = getOnScreenPos(opts.pos.x, opts.pos.y)
		let isHovered = distPoints(pos, mousePos) < opts.size * zoom
		isHovered ? (hoveredGalaxy = opts) : null
		if (zoom < 0.5) {
			let mx = screenPos.x + (mousePos.x - w / 2) / zoom
			let my = screenPos.y + (mousePos.y - h / 2) / zoom

			if (isHovered) {
				c.strokeStyle = "green"
				c.fillStyle = "green"
				c.lineWidth = 0.5
				let tx = opts.name
				setFont(c, 16)
				let wd = c.measureText(tx).width

				c.beginPath()
				// c.arc(pos.x, pos.y, opts.size * zoom + 20, 0, 8)
				c.rect(
					pos.x - opts.size * zoom,
					pos.y - opts.size * zoom,
					opts.size * zoom * 2,
					opts.size * zoom * 2
				)
				// c.rect(
				// 	pos.x - 25 - wd - opts.size * zoom - 20,
				// 	pos.y - 10,
				// 	wd + 10,
				// 	20
				// )
				c.moveTo(pos.x - 15 - opts.size * zoom - 20, pos.y)
				c.lineTo(pos.x - opts.size * zoom, pos.y)
				c.closePath()
				c.stroke()
				c.fillText(tx, pos.x - 40 - wd - opts.size * zoom, pos.y + 6)
			}
		}

		//Draw stars

		let rad = opts.starRad * zoom
		c.fillStyle = opts.col(zoom, 1)
		let starX = pos.x
		let starY = pos.y
		c.beginPath()
		if (getPlayerSpeed() > 250000) {
			let rem = Math.max(0, 299792 - getPlayerSpeed()) / 50000
			starX = w / 2 - rem * (w / 4) * Math.cos(Math.abs(pos.x))
			starY = h / 2 - rem * (h / 4) * Math.cos(Math.abs(pos.y))

			let c2 = cnv2.getContext("2d")
			c2.fillStyle =
				"rgba(125," +
				(155 + Math.random() * 100) +
				"," +
				(155 + Math.random() * 100) +
				",0.4)"
			star(c2, Math.random() * w, Math.random() * h, Math.random() * 2)
			c2.fill()
		}
		c.arc(starX, starY, rad - 10 * zoom, 0, 8)
		c.closePath()
		c.fill()

		c.fillStyle = "yellow"
		for (let i = 0; i < Math.min(60, Math.max(5, 30 * Math.log(zoom))); i++) {
			c.fillStyle =
				"rgba(" +
				255 +
				"," +
				Math.min(255, Math.floor(rn() * 155 + 100) + 1 / zoom) +
				"," +
				Math.min(255, Math.floor(rn() * 155 + 50) + 1 / zoom) +
				"," +
				0.09 / Math.max(0.1, Math.min(5, zoom)) +
				")"
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
	c.strokeStyle = "white"
	c.lineWidth = 0.1

	opts.planets
		.filter(planet => planet.rad * zoom > 1)
		.forEach(planet => {
			c.strokeStyle = "white"
			c.beginPath()
			let onsc = getOnScreenPos(opts.pos.x, opts.pos.y)
			c.arc(onsc.x, onsc.y, planet.dist * zoom, 0, PI2)
			c.closePath()
			c.stroke()
			drawPlanet(planet, opts)
			c.closePath()
		})
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
		c.strokeStyle = "green"
		c.beginPath()
		c.moveTo(onsc.x, onsc.y)
		c.lineTo(
			onsc.x + Math.cos(player.rot) * 30,
			onsc.y + Math.sin(player.rot) * 30
		)
		c.stroke()
		c.closePath()
		c.beginPath()
		c.strokeStyle = "rgba(255,255,255,0.3)"
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
	let arrowUp =
		keysdown["ArrowUp"] || keysdown[" "] || keysdown["w"] || keysdown["W"]
	if (arrowUp) {
		player.shipOpts.thrust.points
			.filter(el => Math.random() < 0.6)
			.forEach(p => {
				let offset = p[0] + player.shipOpts.thrust.tw * Math.random()
				addTrailSmoke(
					player.x -
						Math.cos(player.rot - PIH) * offset -
						Math.cos(player.rot) * (p[1] + player.shipOpts.thrust.h2),
					player.y -
						Math.sin(player.rot - PIH) * offset -
						Math.sin(player.rot) * (p[1] + player.shipOpts.thrust.h2),
					player.rot
				)
			})
	}
	renderAShip(player, arrowUp, player.boostLeft, player.boostRight, false)

	if (zoom > 5000) {
		setFont(c, (((h / 2) * zoom) / 5000) * player.size)
		c.textBaseline = "top"
		c.fillStyle = "black"
		c.fillText("👨‍🚀", w / 2 - c.measureText("👨‍🚀").width / 2, h / 2)
		c.font = "12px Arial"
	}
}
function renderAShip(ship, boost, boostLeft, boostRight, showDmg) {
	let quadrantX = Math.floor(ship.x / quadrantSize)
	let quadrantY = Math.floor(ship.y / quadrantSize)
	let shipSystem = getGalaxyOpts(quadrantX, quadrantY)
	let hasGalaxy = hasQuadrantGalaxy({ x: quadrantX, y: quadrantY })
	let sunAng = hasGalaxy ? anglePoints(shipSystem.pos, ship) : -1
	let sunDis = hasGalaxy
		? shipSystem.size - distPoints(ship, shipSystem.pos)
		: 0
	let size = 1

	ship.size = size
	let shadeOffset = hasGalaxy ? (sunDis / shipSystem.size) * 0.25 : 0
	let onsc = getOnScreenPos(ship.x, ship.y)
	renderShip(
		c,
		onsc.x,
		onsc.y,
		size,
		ship.shipOpts,
		zoom,
		ship.rot,
		sunAng - ship.rot - PIH,
		shadeOffset,
		showDmg,
		boost,
		boostLeft,
		boostRight
	)
}
function gameOver() {
	let dialog = createDialog()

	let continueBut = getButton("Continue anyway", () => {
		reset()

		document.body.removeChild(dialog)
	})

	let newGameBut = getButton("Start another game", () => {
		//TODO
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
		renderShip(
			ct,
			0,
			0,
			1,
			player.shipOpts,
			1,
			-PIH,
			angle(
				mousePos.x,
				mousePos.y,
				w / 2,
				shipCnv.getBoundingClientRect().top + 150
			),
			0.2,
			false,
			true,
			true,
			true
		)
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
		shipCnv,
		raceName,
		createDiv(""),
		getButton("New Race", () => {
			getNewPlayer()
			raceName.innerHTML = player.race
		}),
		getButton("Confirm", () => {
			isClosed = true
			document.body.removeChild(dialog)
			paused = false
		}),
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
		getButton("Start game", () => {
			getNewPlayer()
			document.body.removeChild(dialog)

			chooseRace()
		}),
		subTitleDiv(
			"Mouse to aim. </br> W/S Up-/Down-Arrow to thrust. </br> Click to shoot. "
		),
		createDiv("")
	])

	dialog.style.height = "100%"
}
function updatePlayer() {
	Object.values(player.shipOpts).forEach(component => {
		if (!component.isDead && component.hp <= 0) {
			component.isDead = true
			if (component == player.shipOpts.hull) {
				Object.values(player.shipOpts).forEach(component =>
					addBrokenComponent(player, component)
				)
				player.isDead = true
				window.setTimeout(() => {
					paused = true
					gameOver()
				}, 2500)
				return
			}
		}
	})

	if (player.shipOpts.hull.isDead) {
	}

	let playerQuadrant = getShipQuadrant(player)

	if (hasQuadrantGalaxy(playerQuadrant)) {
		let galaxyOpts = getGalaxyOpts(playerQuadrant.x, playerQuadrant.y)

		updatePlayerGrav(galaxyOpts)
		player.isOnPlanet = false
		player.isRepairing = false
		galaxyOpts.planets.forEach(planet => {
			let pPos = getPlanetPos(planet, time)
			if (distPoints(player, pPos) < planet.rad) {
				Object.values(player.shipOpts).forEach(component => {
					player.isOnPlanet = true
					component.hp = Math.min(
						component.maxHp,
						component.hp + component.maxHp / 100
					)
					if (component.hp == component.maxHp) {
						component.isDead = false
					} else {
						player.isRepairing = true
					}
				})
			}
		})
	}
	let speed = player.speed * (player.shipOpts.thrust.isDead ? 0.25 : 1)
	let turnSpeed = player.turnSpeed * (player.shipOpts.wings.isDead ? 0.5 : 1)
	if (
		keysdown["ArrowUp"] ||
		keysdown["ArrowUp"] ||
		keysdown[" "] ||
		keysdown["w"] ||
		keysdown["W"]
	) {
		posPlusAng(player.thrust, player.rot, speed)
	}
	if (keysdown["ArrowDown"] || keysdown["s"] || keysdown["S"]) {
		posPlusAng(player.thrust, player.rot, -speed)
	}

	let turn = -turnTowards(
		angle(w / 2, h / 2, mousePos.x, mousePos.y),
		player.rot,
		turnSpeed * (player.shipOpts.wings.isDead ? 0.1 : 1)
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

	if (keysdown["ArrowLeft"]) {
		posPlusAng(player.thrust, player.rot + PIH, speed)
	}
	if (keysdown["ArrowRight"]) {
		posPlusAng(player.thrust, player.rot + PIH, -speed)
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
				let x = Math.cos(da.ang - ship.rot + PIH) * da.dis
				let y = Math.sin(da.ang - ship.rot + PIH) * da.dis

				Object.keys(components).forEach(key => {
					let comp = ship.shipOpts[key]
					if (
						(!comp.isDead || ignoreBroken) &&
						c.isPointInPath(comp.path, x, y)
					) {
						bulletsOfSeed.splice(i, 1)
						comp.hitMaskPath.moveTo(x, y)
						comp.hitMaskPath.arc(x, y, 0.15 * Math.random(), 0, 8)
						comp.hp = Math.max(0, comp.hp - bullet[4])
						comp.isHit = 15
						addBulletHit(x, y, ship)
						addBulletHitSmoke(bullet, getBulletColor(seed))
						return
					}
				})
			}
		})
}

function addBulletHit(x, y, anchor) {
	bulletHits.add([20 * Math.random(), x, y, anchor])
}
function addBrokenComponent(ship, component) {
	let ons = getOnScreenPos(ship.x, ship.y)
	brokenComponents.add([
		250,
		ons.x,
		ons.y,
		ship.size,
		ship.rot + PIH,
		rndBtwn(0, 8),
		rndBtwn(0, 1),
		component
	])
}

function addTrailSmoke(x, y, dir) {
	trailSmoke.add([
		rndBtwn(5, 50),
		x,
		y,
		dir + rndBtwn(-0.1, 0.1),
		rndBtwn(40, 60)
	])
}
function addBulletHitSmoke(bul, color) {
	bulletSmokes.add([
		rndBtwn(5, 20),
		bul[0] + rndBtwn(-1, 1),
		bul[1] + rndBtwn(-1, 1),
		color
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
				c.strokeStyle = "yellow"
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
		c.strokeStyle = "yellow"
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
	let playerDis = distPoints(planetPos, player)
	let onScreenPos = getOnScreenPos(planetPos.x, planetPos.y)
	if (distPoints(onScreenPos, mousePos) < planet.rad * zoom) {
		console.log("hovered")
		hoveredPlanet = planet
	}
	let ang = planet.startAng + time * planet.spd
	c.save()
	c.beginPath()
	c.arc(onScreenPos.x, onScreenPos.y, planet.rad * zoom, 0, 8)
	c.fillStyle = planet.col
	c.fill()
	c.closePath()
	c.clip()
	c.beginPath()

	c.fillStyle = "rgba(255,255,255,0.5)"
	let offX = onScreenPos.x - Math.cos(ang) * planet.rad * zoom * 1.7
	let offY = onScreenPos.y - Math.sin(ang) * planet.rad * zoom * 1.7
	if (zoom > 0.05) {
		let rgr = c.createRadialGradient(
			offX,
			offY,
			0,
			offX,
			offY,
			planet.rad * zoom * 3
		)
		rgr.addColorStop(0, "rgba(255,255,255,0.5)")
		rgr.addColorStop(0, "rgba(255,255,255,0.5)")
		rgr.addColorStop(1, "rgba(0,0,0,0)")
		c.fillStyle = rgr
	}
	c.arc(offX, offY, planet.rad * zoom * 2, 0, 8)
	c.closePath()
	c.fill()
	if (playerDis < planet.rad * 3) {
		let playerOnscreen = getOnScreenPos(player.x, player.y)

		if (!player.isDead) {
			renderShip(
				c,
				playerOnscreen.x + Math.cos(ang) * Math.sqrt(playerDis * 150 + 150),
				playerOnscreen.y + Math.sin(ang) * Math.sqrt(playerDis * 150 + 150),
				0.95, //* Math.max(0, 1 - playerDis / planet.rad),
				player.shipOpts,
				zoom,
				player.rot,
				0,
				0,
				false,
				false,
				false,
				false,
				planet.col
			)
		}
	}
	activeEnemies.forEach(enemy => {
		let enemyDis = distPoints(planetPos, enemy)
		if (enemyDis < planet.rad * 2) {
			let enemyOnscreen = getOnScreenPos(enemy.x, enemy.y)

			renderShip(
				c,
				enemyOnscreen.x + Math.cos(ang) * Math.sqrt(enemyDis * 150 + 150),
				enemyOnscreen.y + Math.sin(ang) * Math.sqrt(enemyDis * 150 + 150),
				enemy.size * 0.95, //* Math.max(0, 1 - playerDis / planet.rad),
				enemy.shipOpts,
				zoom,
				enemy.rot,
				0,
				0,
				true,
				false,
				false,
				false,
				planet.col
			)
		}
	})
	c.restore()
}

function getStarCol(zoomRad, a, rn1, rn2) {
	let col = Math.min(255, -zoomRad * 5 + 10 + Math.floor(rn1 * 200))
	let col2 = Math.min(255, -zoomRad * 5 + 10 + Math.floor(rn2 * 200))
	c.fillStyle =
		"rgba(" +
		Math.max(col, Math.min(zoomRad * 50, 255)) +
		"," +
		col +
		"," +
		col2 +
		"," +
		a +
		")"
}

function getPlanetColor(rn) {
	let col = Math.min(255, Math.floor(rn() * 75))
	let col2 = Math.min(255, Math.floor(rn() * 75))
	let col3 = Math.min(255, Math.floor(rn() * 75))
	return "rgba(" + col + "," + col2 + "," + col3 + "," + 1 + ")"
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

function isGalaxyDiscovered(x, y) {
	return (
		discoveredGalaxies.hasOwnProperty(x) &&
		discoveredGalaxies[x].hasOwnProperty(y)
	)
}

function getStarImg() {
	if (!starImg) {
		let cnv = document.createElement("canvas")
		let ctx = cnv.getContext("2d")
		ctx.fillStyle = "rgba(255,155,55,0.1)"

		for (let i = 0; i < 25; i++) {
			let rad = Math.random() * 60
			let rad2 = Math.random() * 60
			ctx.ellipse(75, 75, rad, rad, Math.random() * PI2, 0, PI2)
			ctx.fill()
		}
		starImg = cnv
	}
	return starImg
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
		// let enemyOpts = getEnemyOpts()
		let galaxy = getGalaxyOpts(x, y)
		let seed = galaxy.seed
		let rn = getNewRng(seed)
		let shipAmount = Math.ceil(3 + (rn() * 12 * player.level) / 500)
		let enemyOpts = getEnemyOpts(rn, seed)
		console.log("enemyStats: " + enemyOpts)
		console.log(enemyOpts)
		enemyOpts.galaxy = galaxy
		for (let i = 0; i < shipAmount; i++) {
			let newEn = new Enemy(enemyOpts)
			enemyCache[x][y].push(newEn)
		}
	}

	return enemyCache[x][y]
}

function getEnemyOpts(rn, seed) {
	let lvl = Math.min(500, player.level) / 500
	const shotDis = 30 + lvl * rn() * (250 - 30)
	const shotSpeed = 0.01 + 0.19 * lvl * rn()
	const shotLife = shotDis / shotSpeed
	let spd =
		0.1 -
		0.097 *
			getInRange(
				(Math.log10(1 + Math.max(0, 500 - player.level)) / Math.log10(501)) *
					rn(),
				0,
				1
			)
	console.log("Enemy speed:" + spd)
	return {
		seed: seed,
		shotDis: shotDis,
		turnSpeed: 0.05 + lvl * 0.04 * rn(),
		turnStability: 0.95,
		speed: spd,
		enemyDistance: Math.max(75, shotDis * (1 + rn())),
		dmg: Math.ceil(1 + lvl * 1000 * rn()),
		fireRate: Math.min(
			60,
			60 - Math.ceil((Math.log(1 + player.level) / Math.log(501)) * 59 * rn())
		),
		shotSpeed: shotSpeed,
		size: 1 + rn() * 1,
		shotLife: shotLife,
		shotCd: 0
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
		x: w / 2 - screenPos.x * zoom + x * zoom,
		y: h / 2 - screenPos.y * zoom + y * zoom
	}
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

const drawHUD = (galaxy, enemies) => {
	ch.font = "24px Arial"
	ch.clearRect(0, 0, w, h)
	drawSpeedAndDirection(galaxy, enemies)

	if (galaxy.planets) {
		drawRadar(galaxy, enemies)
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
			shotDis: player.shotDis
		}
		ch.fillText("Player Stats", 20, 400)
		Object.entries(stats).forEach((entry, i) => {
			ch.fillText(entry[0] + ": " + entry[1], 20, 430 + i * 30)
		})

		ch.fillText("playerLock:" + enemyLock, 20, 700)
	}
	// c.fillText("Health:", 30, 90)
	// c.fillRect(30, 110, (100 * player.health) / 100, 20)
	// c.strokeRect(30, 110, 100, 20)
	// c.fillStyle = "red"
}
function drawComponentHp() {
	let components = {
		Hull: "hull",
		Wings: "wings",
		Thrust: "thrust",
		Weapons: "weapons"
	}
	let y = 50
	let x = 275
	ch.strokeStyle = "green"
	ch.lineWidth = 1
	ch.textBaseline = "top"
	ch.font = "bold 18px Arial"
	ch.fontWeight = 800
	let totHp = 0
	let totMaxHp = 0
	Object.entries(components).forEach(entry => {
		totHp += player.shipOpts[entry[1]].hp
		totMaxHp += player.shipOpts[entry[1]].maxHp
		ch.fillStyle = "green"
		ch.fillText(entry[0], x, y)
		ch.strokeRect(x, y + 20, 100, 10)
		ch.fillStyle = getComponentColor(player.shipOpts[entry[1]])
		ch.fillRect(
			x,
			y + 20,
			(100 * player.shipOpts[entry[1]].hp) / player.shipOpts[entry[1]].maxHp,
			10
		)
		y += 55
	})

	ch.strokeRect(50, 35, 200, 12)
	ch.fillRect(
		50,
		35,
		(200 * player.shipOpts.hull.hp) / player.shipOpts.hull.maxHp,
		12
	)

	y -= 55
	ch.fillStyle =
		"rgba(200,200,50," +
		(0.5 + (0.5 - (0.5 * player.shotCd) / player.fireRate)) +
		")"
	ch.strokeRect(x, y + 30, 100, 4)
	ch.fillRect(x, y + 30, 100 - (100 * player.shotCd) / player.fireRate, 4)
}

function drawHudShip() {
	ch.strokeStyle = "green"
	ch.fillStyle = "black"
	ch.lineWidth = 2
	ch.strokeRect(25, 25, 400, 300)
	ch.fillRect(25, 25, 400, 300)

	ch.save()
	ch.translate(150, 175)
	ch.rotate(player.rot + PIH)
	let scale = 40
	ch.lineWidth = 0.03
	let weaponOpts = player.shipOpts.weapons
	for (let i = 0; i < weaponOpts.amount; i++) {
		ch.save()
		ch.scale(scale, scale)
		ch.translate(
			-weaponOpts.x - i * (weaponOpts.w + weaponOpts.margin),
			weaponOpts.top
		)
		ch.stroke(weaponOpts.path)
		ch.restore()
		ch.save()
		ch.scale(scale, scale)
		ch.translate(
			weaponOpts.x + i * (weaponOpts.w + weaponOpts.margin),
			weaponOpts.top
		)
		ch.stroke(weaponOpts.path)
		ch.restore()
	}

	ch.strokeStyle = getComponentColor(player.shipOpts.thrust)

	ch.scale(scale, scale)
	ch.globalCompositeOperation = "destination-out"
	ch.fill(player.shipOpts.thrust.path)
	ch.fill(player.shipOpts.thrust.path)
	ch.globalCompositeOperation = "source-over"
	ch.stroke(player.shipOpts.thrust.path)
	player.shipOpts.wings.list.forEach(wing => {
		ch.globalCompositeOperation = "source-over"
		ch.stroke(wing.path)
	})

	ch.strokeStyle = getComponentColor(player.shipOpts.wings)

	player.shipOpts.wings.list.forEach(wing => {
		ch.globalCompositeOperation = "destination-out"
		ch.fill(wing.path)
		ch.fill(wing.path)
	})
	ch.strokeStyle = getComponentColor(player.shipOpts.hull)
	ch.globalCompositeOperation = "destination-out"
	ch.fill(player.shipOpts.hull.path)
	ch.fill(player.shipOpts.hull.path)
	ch.globalCompositeOperation = "source-over"
	ch.stroke(player.shipOpts.hull.path)

	ch.restore()
}
function drawInterstellarRadar() {
	blinkTick++
	let x = w - 330 + 150
	let y = 25 + 150
	ch.fillStyle = "black"
	ch.fillRect(x - 150, y - 150, 300, 300)
	ch.fillStyle = "green"
	ch.strokeRect(x - 150, y - 150, 300, 300)

	ch.save()
	ch.rect(x - 150, y - 150, 300, 300)
	ch.clip()
	ch.lineWidth = 0.2
	ch.beginPath()
	for (let i = 0; i < 8; i++) {
		ch.moveTo(x - 150, Math.floor(y - 150 + (i * 300) / 8))
		ch.lineTo(x + 150, Math.floor(y - 150 + (i * 300) / 8))

		ch.moveTo(Math.floor(x - 150 + (i * 300) / 8), y - 150)
		ch.lineTo(Math.floor(x - 150 + (i * 300) / 8), y + 150)
	}
	ch.stroke()
	ch.closePath()

	let size = 4
	let currentGal = getShipQuadrant(player)
	let getRadarX = theX =>
		x + (theX - player.x) / ((quadrantSize * size * 2) / 300)
	let getRadarY = theY =>
		y + (theY - player.y) / ((quadrantSize * size * 2) / 300)

	ch.beginPath()
	for (let qx = currentGal.x - size; qx < currentGal.x + size; qx++) {
		for (let qy = currentGal.y - size; qy < currentGal.y + size; qy++) {
			if (hasQuadrantGalaxy({ x: qx, y: qy })) {
				let opts = getGalaxyOpts(qx, qy)
				ch.moveTo(getRadarX(opts.pos.x), getRadarY(opts.pos.y))
				ch.arc(
					getRadarX(opts.pos.x),
					getRadarY(opts.pos.y),
					opts.starRad / ((quadrantSize * size) / 300),
					0,
					8
				)
				let tx = opts.name
				let wd = ch.measureText(tx).width
			}
		}
	}
	ch.closePath()
	ch.fill()
	ch.font = "12px Arial"
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

	ch.fillStyle = "yellow"
	ch.beginPath()
	ch.arc(x, y, 2 + (3 * Math.abs((blinkTick % 200) - 100)) / 100, 0, 8)
	ch.closePath()
	ch.fill()

	ch.restore()
}
function drawRadar(galaxy, enemies) {
	blinkTick++
	let x = w - 330 + 150
	let y = 25 + 150
	ch.save()
	ch.fillStyle = "black"
	ch.beginPath()
	ch.rect(x - 150, y - 150, 300, 300)
	ch.clip()
	ch.fill()
	ch.closePath()
	ch.fillStyle = "green"
	ch.strokeRect(x - 150, y - 150, 300, 300)

	ch.lineWidth = 0.4
	ch.beginPath()
	for (let i = 0; i < 6; i++) {
		ch.moveTo(x - 150, y - 150 + (i * 300) / 6)
		ch.lineTo(x + 150, y - 150 + (i * 300) / 6)

		ch.moveTo(x - 150 + (i * 300) / 6, y - 150)
		ch.lineTo(x - 150 + (i * 300) / 6, y + 150)
	}
	ch.stroke()
	ch.closePath()
	ch.beginPath()

	let scale = (galaxy.size * 1.2) / 150
	let getRadarX = theX => x + (theX - galaxy.pos.x) / scale
	let getRadarY = theY => y + (theY - galaxy.pos.y) / scale

	ch.arc(x, y, galaxy.starRad / scale, 0, 8)
	galaxy.planets.forEach(planet => {
		let pos = getPlanetPos(planet, time)
		ch.moveTo(getRadarX(pos.x), getRadarY(pos.y))
		ch.arc(
			getRadarX(pos.x),
			getRadarY(pos.y),
			Math.max(3, planet.rad / scale),
			0,
			8
		)
	})
	ch.closePath()
	ch.fill()
	ch.fillStyle = "red"
	ch.beginPath()
	enemies.forEach(enemy => {
		ch.moveTo(getRadarX(enemy.x), getRadarY(enemy.y))
		ch.arc(
			getRadarX(enemy.x),
			getRadarY(enemy.y),
			2 + (3 * Math.abs((Math.abs(blinkTick - 100) % 200) - 100)) / 100,
			0,
			8
		)
	})
	ch.closePath()
	ch.fill()

	ch.fillStyle = "yellow"
	let px = getRadarX(player.x)
	let py = getRadarY(player.y)
	ch.beginPath()
	ch.arc(
		Math.max(x - 150, Math.min(x + 150, px)),
		Math.max(y - 150, Math.min(y + 150, py)),
		2 + (3 * Math.abs((blinkTick % 200) - 100)) / 100,
		0,
		8
	)
	ch.closePath()
	ch.fill()

	ch.strokeStyle = "yellow"
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

	let tx = galaxy.name || " "
	let wd = ch.measureText(tx).width
	ch.fillStyle = "green"
	ch.fillText(tx, w - 175 - wd / 2, 30)

	tx = "Hostile Ships: " + enemies.length
	wd = ch.measureText(tx).width
	if (enemies) {
		ch.fillText(tx, w - 175 - wd / 2, 300)
		// ch.fillText(enemies.length, w - 175 - wd / 2, 350)
	}
	ch.restore()
}
function drawSpeedAndDirection(galaxyOpts, enemies) {
	let x = (ch.fillStyle = "green")
	let playerSpeed = getPlayerSpeed()
	ch.font = "bold 17px Arial"
	let tx = "Current Speed: " + playerSpeed + "km/s"

	let wd = ch.measureText(tx).width
	ch.fillText(tx, w / 2 - wd / 2, 280)

	let dis = Math.min(45, 50 * dist(0, 0, player.mot.x, player.mot.y))
	let ang = angle(0, 0, player.mot.x, player.mot.y)

	ch.fillStyle = "black"
	ch.lineWidth = 2
	ch.save()
	ch.beginPath()
	ch.arc(w / 2, 175, 90, 0, 9)
	ch.stroke()
	ch.clip()
	ch.closePath()

	// ch.lineWidth = 0.4
	// ch.beginPath()
	// for (let i = 0; i < 6; i++) {
	// 	ch.moveTo(w/2-90, 125 + (i * 180) / amnt)
	// 	ch.lineTo(w/2+90, 125+ (i * 180) / amnt)

	// 	ch.moveTo(w/2 - 90 + (i * 180) / amnt, y - 150)
	// 	ch.lineTo(w/2 - 90 + (i * 180) / amnt, y + 150)
	// }
	// ch.stroke()
	// ch.closePath()

	// ch.strokeRect(w / 2 - 150, 25, 300, 300)
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
		return (
			"rgba(" +
			(207 - (207 * component.hp) / component.maxHp) +
			"," +
			(41 + (204 * component.hp) / component.maxHp) +
			"," +
			(56 + (61 * component.hp) / component.maxHp) +
			",1)"
		)
	}
}

function isPosOnScreen(pos, marg) {
	return pos.x > -marg && pos.x < w + marg && pos.y > -marg && pos.y < h + marg
}
