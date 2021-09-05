import { openWindow } from "./mergeComponents.js"
import { getNewRng } from "./Rng.js"
import { getShipOpts } from "./ship.js"
import { renderShip, rgb } from "./ShipRender.js"
import {
	angle,
	anglePoints,
	compareAngles,
	dist,
	distPoints,
	turnTowards
} from "./Util.js"

var paused = true
var debug = true
document
	.getElementById("debug")
	.addEventListener("change", () => (debug = !debug))

var w = window.innerWidth
var h = window.innerHeight
var cnv, c, cnv2, ch

var screenPos = { x: 0, y: 0 }
var planetLock = null
var homePlanet = null
var trailSmoke = []
var brokenComponents = []
let randomStartSeed = Math.floor(Math.random() * 99999)
console.log("Ship seed: " + randomStartSeed)
var zoom = 25
var quadrantSize = 3500
var mousePos = { x: 0, y: 0 }
var time = 0
var zoomAim = null
var keysdown = {}
var mouseDown = false
var bullets = {}
var activeEnemies = new Set()

function getNewPlayer() {
	let rndStart = {
		x: Math.floor(Math.random() * 10000),
		y: Math.floor(Math.random() * 10000)
	}
	console.log("Home Planet: x: " + rndStart.x + ", y:" + rndStart.y)
	while (
		!hasQuadrantGalaxy(rndStart) ||
		!getGalaxyOpts(rndStart.x, rndStart.y).planets.length
	) {
		rndStart = {
			x: Math.floor(Math.random() * 10000),
			y: Math.floor(Math.random() * 10000)
		}
		console.log("Home Planet: x: " + rndStart.x + ", y:" + rndStart.y)
	}
	screenPos = getGalaxyOpts(rndStart.x, rndStart.y).planets[0].pos // { x: rndStart.x * quadrantSize, y: rndStart.y * quadrantSize } // getGalaxyOpts(rndStart.x, rndStart.y).planets[0].pos
	planetLock = getGalaxyOpts(rndStart.x, rndStart.y).planets[0]
	homePlanet = getGalaxyOpts(rndStart.x, rndStart.y).planets[0]
	// player.x = screenPos.x + 25
	// player.y = screenPos.y + 25
	player = {
		seed: randomStartSeed,
		race: getRaceName(getNewRng(randomStartSeed)),
		boostLeft: false,
		boostRight: false,
		x: screenPos.x + 25,
		y: screenPos.y + 25,
		level: 5,
		rot: -Math.PI * 0.5,
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
		fireRate: 60,
		dmg: 1,
		shotCd: 0,
		shotLife: 20 / 0.01,
		shotSpeed: 0.01,
		shotDis: 20,

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
		this.rot = Math.random() * Math.PI * 2

		//bullet
	}
	shoot() {
		this.mot.x -= Math.cos(this.rot) * 0.05
		this.mot.y -= Math.sin(this.rot) * 0.05
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
				// if (
				// 	compareAngles(this.rot + Math.PI, anglePoints(player, this)) <
				// 	this.turnSpeed * 10
				// ) {
				if (!this.shipOpts.weapons.isDead && this.shotCd <= 0) {
					this.shoot()
					this.shotCd = this.fireRate
				}
				this.boostRight = this.boostLeft = false
			}
			this.aim = player
			this.moveTo(player)

			//isInShotDis ?
			//fly to & attack player
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
			//fly around
			if (!this.aim || distPoints(this.aim, this) < 5) {
				this.aim = this.findRandomAim()
			}
			if (this.aim.x == this.x && this.aim.y == this.y) {
				this.aim.x++
			}
			this.moveTo(this.aim)
		}
		this.mot.x *= 0.99
		this.mot.y *= 0.99
		this.x += this.mot.x
		this.y += this.mot.y

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
				addBrokenComponent(
					this.x,
					this.y,
					this.size,
					this.rot + Math.PI * 0.5,
					component
				)
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
			pos.x += Math.random() * 40
			pos.y += Math.random() * 40
			return pos
		}
		return {
			x:
				this.galaxy.middle.x +
				(Math.random() - Math.random()) * this.galaxy.size,
			y:
				this.galaxy.middle.y +
				(Math.random() - Math.random()) * this.galaxy.size
		}
	}
	render() {
		renderAShip(this, this.boost, this.boostLeft, this.boostRight, true)
		let onsc = getOnScreenPos(this.x, this.y)
		if (distPoints(mousePos, onsc) < zoom * this.size * 10) {
			c.fillStyle = "green"
			c.textBaseline = "top"
			let comps = {
				Hull: "hull",
				Weapons: "weapons",
				Wings: "wings",
				Thrust: "thrust"
			}
			c.font = "14px Gill Sans MT"
			c.fillText(this.race + " Ship", onsc.x - 60, onsc.y - 110)
			c.font = "12px Gill Sans MT"
			Object.entries(comps).forEach((entry, i) => {
				c.fillText(entry[0], onsc.x - 60, onsc.y - 90 + 13 * i)
				c.fillRect(
					onsc.x,
					onsc.y - 90 + 13 * i,
					(60 * this.shipOpts[entry[1]].hp) / this.shipOpts[entry[1]].maxHp,
					5
				)
			})
			c.beginPath()
			c.arc(onsc.x, onsc.y, this.size * zoom * 10, 0, 8)
			c.closePath()
			c.stroke()
		}
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
				c.strokeStyle = "white"
				c.beginPath()
				c.moveTo(ons.x, ons.y)
				c.lineTo(
					getOnScreenPos(this.aim.x, this.aim.y).x,
					getOnScreenPos(this.aim.x, this.aim.y).y
				)
				c.closePath()
				c.stroke()
				c.fillRect(getOnScreenPos(this.aim).x, getOnScreenPos(this.aim).y, 5, 5)
			}
		}
	}
	moveTo(pos) {
		// let x = pos.x - this.x
		// let y = pos.y - this.y
		// let lngth = Math.sqrt(x * x + y * y)
		// this.mot.x = (0.5 * x) / lngth
		// this.mot.y = (0.5 * y) / lngth

		let rotation =
			-this.turnSpeed *
			0.05 *
			turnTowards(anglePoints(pos, this), this.rot + Math.PI, this.turnSpeed)
		rotation > 0 ? (this.boostLeft = true) : (this.boostLeft = false)
		rotation < 0 ? (this.boostRight = true) : (this.boostRight = false)
		if (rotation == 0) {
		}
		this.rotAcc += rotation * (this.shipOpts.wings.isDead ? 0.1 : 1)
		this.rot += this.rotAcc

		this.rotAcc *= 0.9 + (this.shipOpts.wings.isDead ? 0.09 : 0)

		let dis = distPoints(this, pos)

		let speed =
			(Math.log(dis) / Math.log(this.shotDis)) *
			this.speed *
			(this.shipOpts.thrust.isDead ? 0.1 : 1)
		let acc = speed
		this.mot.x += acc * Math.cos(this.rot)
		this.mot.y += acc * Math.sin(this.rot)

		this.boost = true
	}
}
function killall() {
	activeEnemies.forEach(enemy =>
		Object.values(enemy.shipOpts).forEach(comp => (comp.hp = 0))
	)
}
const ZOOM_MAX = 6000
const ZOOM_MIN = 0.01
var zoomHandleGrabbed = false
window.onload = () => {
	cnv = document.getElementById("c")
	cnv.style.margin = 0
	document.body.margin = 0
	cnv.width = w
	cnv.height = h
	c = cnv.getContext("2d")

	let cnvh = document.getElementById("h")
	cnvh.style.margin = 0
	cnvh.width = w
	cnvh.height = h
	ch = cnvh.getContext("2d")

	renderBg()

	let resizeTimer = null
	window.addEventListener("resize", () => {
		clearTimeout(resizeTimer)
		resizeTimer = window.setTimeout(() => {
			w = window.innerWidth
			h = window.innerHeight
			cnv.width = w
			cnv.height = h
			cnv2.width = w
			cnv2.height = h
			cnvh.width = w
			cnvh.height = h
			renderBg()
		})
	})
	// window.addEventListener("resize", () => {})

	window.addEventListener("keydown", ev => {
		keysdown[ev.key] = true
		if (debug && ev.key == "k") {
			killall()
		}
	})
	window.addEventListener("keyup", ev => {
		keysdown[ev.key] = false
	})
	// let mouseDown = false
	window.addEventListener("mousedown", ev => {
		mouseDown = true
		mousePos = { x: ev.clientX, y: ev.clientY }

		if (hoveredGalaxy && debug) {
			// let galAngle = anglePoints(hoveredGalaxy.middle, player)
			// let dis = distPoints(hoveredGalaxy.middle, player)
			// player.x -= Math.cos(galAngle) * (dis - hoveredGalaxy.size)
			// player.y -= Math.sin(galAngle) * (dis - hoveredGalaxy.size)
			if (hoveredPlanet) {
				// console.log("planet")
				// zoomAim = {
				// 	x: getPlanetPos(hoveredPlanet).x,
				// 	y: getPlanetPos(hoveredPlanet).y,
				// 	zoom: (hoveredPlanet.rad * 3) / Math.min(w, h)
				// }
				planetLock = hoveredPlanet
				let planetPos = getPlanetPos(hoveredPlanet, time)
				let galAngle = anglePoints(planetPos, player)
				let dis = distPoints(planetPos, player)
				player.x -= Math.cos(galAngle) * (dis - hoveredPlanet.rad)
				player.y -= Math.sin(galAngle) * (dis - hoveredPlanet.rad)
			} else if (
				zoom < 0.5 &&
				!posEquals(hoveredGalaxy, getShipQuadrant(player))
			) {
				// zoomAim = {
				// 	x: hoveredGalaxy.middle.x,
				// 	y: hoveredGalaxy.middle.y,
				// 	zoom: Math.min(w, h) / (hoveredGalaxy.size * zoom * 1.1)
				// }
				let galAngle = anglePoints(hoveredGalaxy.middle, player)
				let dis = distPoints(hoveredGalaxy.middle, player)
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
			Math.min(
				zoomBar.clientHeight,
				Math.max(
					0,
					(zoom / (Math.log(ZOOM_MAX) - Math.log(ZOOM_MIN))) *
						zoomBar.clientHeight
				)
			) +
			"px"
	}
	let setZoomFromZoomHandle = y => {}
	setZoomHandleFromZoom()
	// zoomHandle.style.top =
	// 	Math.min(
	// 		zoomBar.clientHeight,
	// 		Math.max(
	// 			0,
	// 			(zoom / (Math.log(ZOOM_MAX) - Math.log(ZOOM_MIN))) *
	// 				zoomBar.clientHeight
	// 		)
	// 	) + "px"

	zoomHandle.addEventListener("mousedown", ev => {
		ev.preventDefault()
		zoomHandleGrabbed = ev.clientY - zoomHandle.getBoundingClientRect().top
	})
	zoomBar.addEventListener("mousedown", ev => {
		zoomHandleGrabbed = 0
		let rect = zoomBar.getBoundingClientRect()
		let relY = Math.max(
			0.1,
			Math.min(zoomBar.clientHeight, ev.clientY - rect.top - zoomHandleGrabbed)
		)
		zoomHandle.style.top =
			Math.min(zoomBar.clientHeight, Math.max(0, relY)) + "px"

		zoom = Math.max(
			ZOOM_MIN,
			Math.min(
				ZOOM_MAX,
				(Math.max(0.1, zoomBar.clientHeight - relY) / zoomBar.clientHeight) *
					(Math.log(ZOOM_MAX) - Math.log(ZOOM_MIN))
			)
		)
		zoomHandleGrabbed = true
	})

	window.addEventListener("mousemove", ev => {
		if (zoomHandleGrabbed) {
			let rect = zoomBar.getBoundingClientRect()
			let relY = Math.max(
				0.1,
				Math.min(zoomBar.clientHeight, ev.clientY - rect.top)
			)
			zoomHandle.style.top =
				Math.min(zoomBar.clientHeight, Math.max(0, relY)) + "px"

			zoom = Math.max(
				ZOOM_MIN,
				Math.min(
					ZOOM_MAX,
					(Math.max(0.1, zoomBar.clientHeight - relY) / zoomBar.clientHeight) *
						(Math.log(ZOOM_MAX) - Math.log(ZOOM_MIN))
				)
			)
		}

		if (mouseDown) {
			zoomAim = null
			if (planetLock) planetLock = null
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

		//Because Firefox does not set .wheelDelta
		let wheelDelta = event.wheelDelta ? event.wheelDelta : -1 * event.deltaY

		let evDel =
			((wheelDelta + 1) / (Math.abs(wheelDelta) + 1)) *
			Math.min(Math.abs(wheelDelta))

		var wheel = (evDel / Math.abs(evDel)) * 1

		zoom = Math.min(
			ZOOM_MAX,
			Math.max(ZOOM_MIN, zoom * (wheel < 0 ? 0.97 : 1.03))
		)

		delay = false
		console.log(zoom)

		setZoomHandleFromZoom()
	})

	startScreen()
	update()
}

function renderBg() {
	cnv2 = document.getElementById("b")
	cnv2.style.margin = 0
	document.body.margin = 0
	cnv2.width = w
	cnv2.height = h
	let c2 = cnv2.getContext("2d")
	for (let i = 0; i < 1000; i++) {
		c2.fillStyle =
			"rgba(125," +
			(155 + Math.random() * 100) +
			"," +
			(155 + Math.random() * 100) +
			",0.4)"
		star(c2, Math.random() * w, Math.random() * h, Math.random() * 2)
	}
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

var lastTime = window.performance.now()
var timeUntilNextTick = 0
var tickDur = 16
function update() {
	if (!paused) {
		let newTime = window.performance.now()
		timeUntilNextTick += newTime - lastTime
		lastTime = newTime
		while (timeUntilNextTick > tickDur) {
			timeUntilNextTick -= tickDur
		}
		tick()
		time += 1
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

			if (gOpts.middle && distPoints(gOpts.middle, player) < quadrantSize)
				getEnemies(i, j).forEach(enemy => {
					if (
						distPoints(enemy, player) < 1000 ||
						posEquals(getShipQuadrant(enemy), pQ)
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
			!posEquals(getShipQuadrant(enemy), getShipQuadrant(player))
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
function posEquals(p1, p2) {
	return p1.x == p2.x && p1.y == p2.y
}
var conqueredQuadrants = {}
var drawnQuadrants = []
function render() {
	c.clearRect(0, 0, w, h)
	let quadrants = getQuadrantsToDraw(screenPos)
	hoveredGalaxy = null
	hoveredPlanet = null

	screenPos = { x: player.x, y: player.y }

	drawnQuadrants = []
	for (let i = quadrants.xStart; i <= quadrants.xEnd; i++) {
		for (let j = quadrants.yStart; j <= quadrants.yEnd; j++) {
			drawQuadrant(i, j)
			drawnQuadrants.push([i, j])
		}
	}
	renderBrokenComponents()
	activeEnemies.forEach(enemy => enemy.render())

	renderTrailSmoke()
	drawPlayer()

	drawBullets()
	renderBulletHits()
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
			ship.x + Math.cos(dir + Math.PI * 0.5 + ang) * dis,
			ship.y + Math.sin(dir + Math.PI * 0.5 + ang) * dis,
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
			ship.x + Math.cos(dir + Math.PI * 0.5 + ang) * dis,
			ship.y + Math.sin(dir + Math.PI * 0.5 + ang) * dis,
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

var hoveredGalaxy = null
var hoveredPlanet = null
function drawQuadrant(x, y) {
	c.lineWidth = 0.1
	// c.strokeStyle = "white"
	// let pos = getOnScreenPos(x * quadrantSize, y * quadrantSize)
	// c.strokeRect(pos.x, pos.y, quadrantSize * zoom, quadrantSize * zoom)

	if (hasQuadrantGalaxy({ x, y })) {
		if (isNaN(x)) {
			console.log(x)
		}
		let opts = getGalaxyOpts(x, y)
		let rn = getNewRng(opts.seed)
		let starPos = getOnScreenPos(opts.middle.x, opts.middle.y)
		let isHovered = distPoints(starPos, mousePos) < opts.size * zoom
		isHovered ? (hoveredGalaxy = opts) : null
		if (zoom < 0.5) {
			let mx = screenPos.x + (mousePos.x - w / 2) / zoom
			let my = screenPos.y + (mousePos.y - h / 2) / zoom

			if (isHovered) {
				c.strokeStyle = "green"
				c.fillStyle = "green"
				c.lineWidth = 0.5
				let tx = opts.name
				c.font = "16px Arial black"
				let wd = c.measureText(tx).width

				c.beginPath()
				// c.arc(starPos.x, starPos.y, opts.size * zoom + 20, 0, 8)
				c.rect(
					starPos.x - opts.size * zoom,
					starPos.y - opts.size * zoom,
					opts.size * zoom * 2,
					opts.size * zoom * 2
				)
				// c.rect(
				// 	starPos.x - 25 - wd - opts.size * zoom - 20,
				// 	starPos.y - 10,
				// 	wd + 10,
				// 	20
				// )
				c.moveTo(starPos.x - 15 - opts.size * zoom - 20, starPos.y)
				c.lineTo(starPos.x - opts.size * zoom, starPos.y)
				c.closePath()
				c.stroke()
				c.fillText(tx, starPos.x - 40 - wd - opts.size * zoom, starPos.y + 6)
			}
		}

		//Draw stars

		let rad = opts.starRad * zoom
		c.fillStyle = opts.col(zoom, 1)
		let starX = starPos.x
		let starY = starPos.y
		c.beginPath()
		if (getPlayerSpeed() > 250000) {
			let rem = Math.max(0, 299792 - getPlayerSpeed()) / 50000
			starX = w / 2 - rem * (w / 4) * Math.cos(Math.abs(starPos.x))
			starY = h / 2 - rem * (h / 4) * Math.cos(Math.abs(starPos.y))

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
				rn() * Math.PI * 2 + Math.abs(((rn() * i * 0.01 + 0.5) % 2) - 1),
				0,
				Math.PI * 2,
				0
			)
			c.fill()
			c.closePath()
		}

		drawPlanets(opts)
	}
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
			drawPlanet(planet, opts)
			c.closePath()

			// 		c.strokeStyle = "green"
			// 		c.lineWidth = 2
			// 		c.beginPath()
			// 		c.arc( onScreenPos.x, onScreenPos.y, planet.rad * zoom + 5, 0, 8 )
			// 		c.stroke()
			// 		c.closePath()
			// }
		})
}
function hitExplosion(pos, rad) {
	for (let i = 0; i < 1; i++) {
		c.fillStyle =
			"rgba(" +
			255 +
			"," +
			Math.floor((Math.abs((time % 14) - 7) / 7) * 255) +
			"," +
			Math.floor((Math.abs((time % 34) - 17) / 17) * 255) +
			"," +
			(0.3 + 0.5 * Math.random()) +
			")"
		c.beginPath()
		c.ellipse(
			pos.x,
			pos.y,
			0.3 + rad * 1.2 * zoom * Math.random(),
			0.3 + rad * 0.9 * zoom * Math.random(),
			((time * 0.01) % 1.248) * Math.PI * 2,
			0,
			Math.PI * 2,
			0
		)
		c.fill()
		c.closePath()
	}
}
function drawExplosion(rn, starPos, rad) {
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
			starPos.x,
			starPos.y,
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
var player = {}

var playerPathCounter = 0
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
		player.shipOpts.thrust.points.forEach(p => {
			let offset = p[0] + player.shipOpts.thrust.tw * 0.5 //Math.random()
			addTrailSmoke(
				player.x -
					Math.cos(player.rot - Math.PI * 0.5) * offset -
					Math.cos(player.rot) * (p[1] + player.shipOpts.thrust.h2),
				player.y -
					Math.sin(player.rot - Math.PI * 0.5) * offset -
					Math.sin(player.rot) * (p[1] + player.shipOpts.thrust.h2),
				player.rot
			)
		})
	}
	renderAShip(player, arrowUp, player.boostLeft, player.boostRight, false)

	if (zoom > 5000) {
		c.font = (((h / 2) * zoom) / 5000) * player.size + "px Arial"
		let wd = c.measureText("👨‍🚀").width / 2
		c.textBaseline = "middle"
		c.fillStyle = "black"
		c.fillText("👨‍🚀", w / 2 - wd, h / 2)
		c.font = "12px Arial"
	}

	// if (player.planet) {
	// c.save()
	// // c.translate(onsc.x, onsc.y)
	// // c.rotate(player.rot)
	// c.fillStyle = "white"
	// c.beginPath()
	// // c.arc(0, 0, zoom * 0.03, 0, 8)
	// drawEvenTriangle(c, onsc.x, onsc.y, 0.01 * zoom, player.rot - 0.75 * Math.PI)
	// // c.arc(0, 0, 20, 0, 8)
	// c.fill()
	// c.closePath()

	// c.fillStyle = "rgba(255,0,0,1)"
	// c.rotate(-player.rot)
	// c.rotate(time * player.planet.spd)
	// c.beginPath()
	// c.rect(-0.005 * zoom, -0.03 * zoom, 0.01 * zoom, 0.03 * zoom)
	// c.arc(0, -0.03 * zoom, 0.008 * zoom, 0, 8)
	// c.fill()
	// c.closePath()
	// } else {
	// 	c.save()
	// 	c.translate(onsc.x, onsc.y)
	// 	c.rotate(player.rot)
	// 	c.font = 0.04 * zoom + "px serif"
	// 	c.fillText("🚀", 0, 0)
	// 	c.restore()
	// }

	// c.restore()
}
function renderAShip(ship, boost, boostLeft, boostRight, showDmg) {
	let quadrantX = Math.floor(ship.x / quadrantSize)
	let quadrantY = Math.floor(ship.y / quadrantSize)
	let shipSystem = getGalaxyOpts(quadrantX, quadrantY)
	let hasGalaxy = hasQuadrantGalaxy({ x: quadrantX, y: quadrantY })
	let sunAng = hasGalaxy ? anglePoints(shipSystem.middle, ship) : -1
	let sunDis = hasGalaxy
		? shipSystem.size - distPoints(ship, shipSystem.middle)
		: 0
	let size = 1
	// if (shipSystem) {
	// 	shipSystem.planets.forEach(planet => {
	// 		let pos = getPlanetPos(planet, time)
	// 		if (distPoints(pos, ship) < planet.rad * 1.5) {
	// 			size = 1 + 1 * Math.sqrt(planet.rad * 1.5 - distPoints(pos, ship))
	// 		}
	// 	})
	// 	if (distPoints(shipSystem.middle, ship) < shipSystem.starRad * 1.5) {
	// 		size =
	// 			1 +
	// 			1 *
	// 				Math.sqrt(
	// 					shipSystem.starRad * 1.5 - distPoints(shipSystem.middle, ship)
	// 				)
	// 	}
	// }
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
		sunAng - ship.rot - Math.PI * 0.5,
		shadeOffset,
		showDmg,
		boost,
		boostLeft,
		boostRight
	)
}
function gameOver() {
	let createDiv = className => {
		let d = document.createElement("div")
		d.className = className
		return d
	}

	let dialog = createDiv("dialog")
	document.body.appendChild(dialog)

	let msg = createDiv("title")
	msg.innerHTML = "Oh no. You died."
	dialog.appendChild(msg)

	let continueBut = document.createElement("button")
	continueBut.innerHTML = "Continue anyway"
	continueBut.onclick = () => {
		Object.values(player.shipOpts).forEach(comp => {
			comp.hp = comp.maxHp
			comp.isDead = false
		})
		player.isDead = false
		let playerGal = getShipQuadrant(player)
		if (hasQuadrantGalaxy(playerGal)) {
			let gal = getGalaxyOpts(playerGal.x, playerGal.y)
			player.x = gal.middle.x - gal.size
			player.y = gal.middle.y - gal.size
		} else {
			player.x = playerGal.x * quadrantSize
			player.y = playerGal.y * quadrantSize
		}
		player.mot.x = 0
		player.mot.y = 0
		document.body.removeChild(dialog)
		paused = false
	}
	let newGameBut = document.createElement("button")
	newGameBut.innerHTML = "Start another game"

	dialog.appendChild(continueBut)
	dialog.appendChild(newGameBut)
	window.setTimeout(() => (dialog.style.height = "100%"), 50)
}

function startScreen() {
	let createDiv = className => {
		let d = document.createElement("div")
		d.className = className
		return d
	}

	let dialog = createDiv("dialog")
	document.body.appendChild(dialog)

	let msg = createDiv("title")
	msg.innerHTML = "Space."
	dialog.appendChild(createDiv(""))
	dialog.appendChild(msg)

	let msg2 = createDiv("subTitle")
	msg2.innerHTML =
		"Mouse to aim. </br> W/S Up-/Down-Arrow to thrust. </br> Click to shoot. "

	let newGameBut = document.createElement("button")
	newGameBut.innerHTML = "Start game"
	newGameBut.onclick = () => {
		getNewPlayer()
		paused = false
		document.body.removeChild(dialog)
	}

	dialog.appendChild(newGameBut)
	dialog.appendChild(msg2)
	dialog.appendChild(createDiv(""))
	dialog.style.height = "100%"
}
function updatePlayer() {
	let allDead = true
	Object.values(player.shipOpts).forEach(component => {
		if (!component.isDead && component.hp <= 0) {
			component.isDead = true
			if (component == player.shipOpts.hull) {
				Object.values(player.shipOpts).forEach(component =>
					addBrokenComponent(
						player.x,
						player.y,
						player.size,
						player.rot + Math.PI * 0.5,
						component
					)
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
					component.hp = Math.min(component.maxHp, component.hp + 0.1)
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
		player.thrust.x += Math.cos(player.rot) * speed
		player.thrust.y += Math.sin(player.rot) * speed
	}
	if (keysdown["ArrowDown"] || keysdown["s"] || keysdown["S"]) {
		player.thrust.x -= Math.cos(player.rot) * speed
		player.thrust.y -= Math.sin(player.rot) * speed
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

	// if (keysdown["ArrowLeft"]) {
	// 	player.rotThrust -= speed * 0.7
	// }
	// if (keysdown["ArrowRight"]) {
	// 	player.rotThrust += speed * 0.7
	// }

	// player
	// } else {
	// }
	player.mot.x += player.thrust.x
	player.mot.y += player.thrust.y

	if (getPlayerSpeed() > 299792) {
		let factor = getPlayerSpeed() / 299792
		player.mot.x *= 1 / factor
		player.mot.y *= 1 / factor
	}

	player.x += player.mot.x
	player.y += player.mot.y
	// player.rot += player.rotThrust
	player.thrust.x = 0
	player.thrust.y = 0
	// player.rotThrust *= 0.9 + (player.shipOpts.wings.isDead ? 0.019 : 0)
	// Math.abs(player.rotThrust) < 0.001 ? (player.rotThrust = 0) : null

	checkCollisions(player, true)
}
var bulletHits = []
var bulletHitsSmoke = []
function checkCollisions(ship, ignoreBroken) {
	Object.entries(bullets)
		.filter(entry => entry[0] != ship.seed)

		.forEach(entry => {
			let seed = entry[0]
			let bulletsOfSeed = entry[1]
			for (let i = bulletsOfSeed.length - 1; i >= 0; i--) {
				let bullet = bulletsOfSeed[i]
				let dis = dist(bullet[0], bullet[1], ship.x, ship.y)
				let ang = angle(bullet[0], bullet[1], ship.x, ship.y)
				let x = Math.cos(ang - ship.rot + Math.PI * 0.5) * dis
				let y = Math.sin(ang - ship.rot + Math.PI * 0.5) * dis
				let wings = ship.shipOpts.wings
				if (
					(!wings.isDead || ignoreBroken) &&
					c.isPointInPath(wings.path, x, y)
				) {
					bulletsOfSeed.splice(i, 1)
					wings.hitMaskPath.moveTo(x, y)
					wings.hitMaskPath.arc(x, y, 0.15 * Math.random(), 0, 8)
					wings.hp = Math.max(0, wings.hp - bullet[4])
					wings.isHit = 15
					addBulletHit(x, y, ship)
					addBulletHitSmoke(bullet[0], bullet[1], getBulletColor(seed))
					continue
				}
				let thrust = ship.shipOpts.thrust
				if (
					(!thrust.isDead || ignoreBroken) &&
					c.isPointInPath(thrust.path, x, y)
				) {
					bulletsOfSeed.splice(i, 1)
					thrust.hitMaskPath.moveTo(x, y)
					thrust.hitMaskPath.arc(x, y, 0.15 * Math.random(), 0, 8)
					thrust.hp = Math.max(0, thrust.hp - bullet[4])
					thrust.isHit = 15
					addBulletHit(x, y, ship)
					addBulletHitSmoke(bullet[0], bullet[1], getBulletColor(seed))
					continue
				}
				let weapon = ship.shipOpts.weapons
				if (
					(!weapon.isDead || ignoreBroken) &&
					c.isPointInPath(weapon.colPath, x, y)
				) {
					bulletsOfSeed.splice(i, 1)
					weapon.hitMaskPath.moveTo(x, y)
					weapon.hitMaskPath.arc(x, y, 0.15 * Math.random(), 0, 8)
					weapon.hp = Math.max(0, weapon.hp - bullet[4])
					weapon.isHit = 15
					addBulletHit(x, y, ship)
					addBulletHitSmoke(bullet[0], bullet[1], getBulletColor(seed))
					continue
				}
				let hull = ship.shipOpts.hull
				if (
					(!hull.isDead || ignoreBroken) &&
					c.isPointInPath(hull.path, x, y)
				) {
					bulletsOfSeed.splice(i, 1)
					hull.hitMaskPath.moveTo(x, y)
					hull.hitMaskPath.arc(x, y, 0.15 * Math.random(), 0, 8)
					hull.hp = Math.max(0, hull.hp - bullet[4])
					hull.isHit = 15
					addBulletHit(x, y, ship)
					addBulletHitSmoke(bullet[0], bullet[1], getBulletColor(seed))
				}
			}
		})
}

function addBulletHit(x, y, anchor) {
	bulletHits.push([x, y, 20, anchor])
}
function addBrokenComponent(x, y, size, rot, component) {
	let ons = getOnScreenPos(x, y)
	brokenComponents.push([
		ons.x,
		ons.y,
		size,
		rot,
		Math.random() * 8,
		Math.random() * 1,
		component,
		250
	])
}
function renderBrokenComponents() {
	for (let i = brokenComponents.length - 1; i >= 0; i--) {
		let component = brokenComponents[i]
		c.fillStyle = rgb(component[6].color)
		if (component[7]--) {
			c.save()
			c.translate(component[0], component[1])
			c.rotate(component[3])
			c.scale(zoom * component[2], zoom * component[2])
			c.fill(component[6].path)

			c.restore()
			component[0] += Math.cos(component[4]) * component[5]
			component[1] += Math.sin(component[4]) * component[5]
			component[3] += 0.04
			component[2] *= 0.99
		} else {
			brokenComponents.splice(i, 1)
		}
	}
}
function addTrailSmoke(x, y, dir) {
	for (let i = 0; i < 2; i++) {
		trailSmoke.push([
			x,
			y,
			dir + (Math.random() - Math.random()) * 0.1,
			100 * Math.random(),
			10 + 50 * Math.random()
		])
		if (trailSmoke.length > 250) {
			trailSmoke.splice(0, 1)
		}
	}
}
function addBulletHitSmoke(x, y, color) {
	for (let i = 0; i < 2 + Math.random() * 5; i++) {
		bulletHitsSmoke.push([
			x + (Math.random() - Math.random()) * 0.5,
			y + (Math.random() - Math.random()) * 0.5,
			20,
			color
		])
		if (bulletHitsSmoke.length > 100) {
			bulletHitsSmoke.splice(0, 1)
		}
	}
}
function renderTrailSmoke() {
	c.fillStyle = "rgba(255,255,55,0.3)"
	c.beginPath()
	for (let i = trailSmoke.length - 1; i >= 0; i--) {
		if (--trailSmoke[i][3] > 0) {
			trailSmoke[i][0] -= (Math.cos(trailSmoke[i][2]) * trailSmoke[i][4]) / 100
			trailSmoke[i][1] -= (Math.sin(trailSmoke[i][2]) * trailSmoke[i][4]) / 100
			trailSmoke[i][2] += (Math.random() - Math.random()) * 0.1
			trailSmoke[i][4] *= 0.999
			let onsc = getOnScreenPos(trailSmoke[i][0], trailSmoke[i][1])
			let siz = ((0.3 * trailSmoke[i][3]) / 100) * zoom

			c.moveTo(onsc.x, onsc.y)
			c.arc(onsc.x, onsc.y, siz, 0, 8)
		} else {
			trailSmoke.splice(i, 1)
		}
	}
	c.fill()
	c.closePath()
}
function renderBulletHits() {
	for (let i = bulletHits.length - 1; i >= 0; i--) {
		if (bulletHits[i][2]--) {
			let dis = dist(0, 0, bulletHits[i][0], bulletHits[i][1])
			let ang = angle(0, 0, bulletHits[i][0], bulletHits[i][1])
			let x = Math.cos(ang + Math.PI * 0.5 + bulletHits[i][3].rot) * dis
			let y = Math.sin(ang + Math.PI * 0.5 + bulletHits[i][3].rot) * dis
			let pos = getOnScreenPos(bulletHits[i][3].x + x, bulletHits[i][3].y + y)
			hitExplosion(pos, 0.02 * Math.min(15, zoom))
		} else {
			bulletHits.splice(i, 1)
		}
	}

	for (let i = bulletHitsSmoke.length - 1; i >= 0; i--) {
		let rn = Math.random()
		if (bulletHitsSmoke[i][2]--) {
			let bullet = bulletHitsSmoke[i]
			c.fillStyle = bullet[3]

			let onsc = getOnScreenPos(bullet[0], bullet[1])
			let siz = bullet[2] / 20
			c.fillRect(
				onsc.x - (siz / 2) * zoom,
				onsc.y - (siz / 2) * zoom,
				siz * zoom,
				siz * zoom
			)
		} else {
			bulletHitsSmoke.splice(i, 1)
		}
	}
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

			// c.strokeStyle = "yellow"
			// c.lineWidth = 0.5
			// let on = getOnScreenPos(player.x, player.y)
			// c.beginPath()
			// c.moveTo(on.x, on.y)
			// c.lineTo(
			// 	on.x +
			// 		((Math.cos(ang) * 10 * planet.rad) / Math.max(planet.rad, dis) ** 2) *
			// 			1000,
			// 	on.y +
			// 		((Math.sin(ang) * 10 * planet.rad) / Math.max(planet.rad, dis) ** 2) *
			// 			1000
			// )
			// c.stroke()
			// c.closePath()
		}
	})
	let sunAng = anglePoints(player, opts.middle)
	let sunDis = distPoints(opts.middle, player)
	player.mot.x +=
		(Math.cos(sunAng) * 0.1 * opts.starRad) /
		Math.max(opts.starRad, sunDis) ** 2
	player.mot.y +=
		(Math.sin(sunAng) * 0.1 * opts.starRad) /
		Math.max(opts.starRad, sunDis) ** 2

	// c.strokeStyle = "yellow"
	// c.lineWidth = 0.5
	// let on = getOnScreenPos(player.x, player.y)
	// c.beginPath()
	// c.moveTo(on.x, on.y)
	// c.lineTo(
	// 	on.x +
	// 		((Math.cos(sunAng) * 20 * opts.starRad) /
	// 			Math.max(opts.starRad, sunDis) ** 2) *
	// 			1000,
	// 	on.y +
	// 		((Math.sin(sunAng) * 20 * opts.starRad) /
	// 			Math.max(opts.starRad, sunDis) ** 2) *
	// 			1000
	// )
	// c.stroke()
	// c.closePath()
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
	if (playerDis < planet.rad * 2) {
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
var quadrantCache = {}
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
var discoveredGalaxies = {
	0: { "-1": true }
}
var galaxyOptsCache = {}
let seeds = {}
var starImg
function getStarImg() {
	if (!starImg) {
		let cnv = document.createElement("canvas")
		let ctx = cnv.getContext("2d")
		ctx.fillStyle = "rgba(255,155,55,0.1)"

		for (let i = 0; i < 25; i++) {
			let rad = Math.random() * 60
			let rad2 = Math.random() * 60
			ctx.ellipse(75, 75, rad, rad, Math.random() * Math.PI * 2, 0, Math.PI * 2)
			ctx.fill()
		}
		starImg = cnv
	}
	return starImg
}
var playerPath = []
var enemyCache = {}
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
		//2 ** x * 3 ** y
		let rn = getNewRng(
			//12(a+b)(a+b+1)+b
			// 0.5 * (x + y) * (x + y + 1) + y
			seed
		)

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

		let starX = x * quadrantSize + quadrantSize / 2 + offsetX
		let starY = y * quadrantSize + quadrantSize / 2 + offsetY
		let middle = {
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
				startAng: rn() * Math.PI * 2,
				starPos: middle,
				col: getPlanetColor(rn),
				star: [x, y],
				index: i
			}
			curDis += dist + rad
			planet.pos = getPlanetPos(planet, time)
			planets.push(planet)
		}
		let rn1 = rn()
		let rn2 = rn()
		let col = (zoom, a) => getStarCol(starRad * zoom, 1, rn1, rn2)
		let name = getGalaxyName(rn)
		galaxyOptsCache[x][y] = {
			middle,
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
	const shotDis = 20 + lvl * rn() * (200 - 20)
	const shotSpeed = 0.01 + 0.19 * lvl * rn()
	const shotLife = shotDis / shotSpeed

	return {
		seed: seed,
		shotDis: shotDis,
		turnSpeed: 0.05 + lvl * 0.04 * rn(),
		turnStability: 0.95,
		speed: 0.001 + (0.1 - 0.001) * lvl * rn(),
		enemyDistance: Math.max(75, shotLife * shotSpeed * (1 + rn())),
		dmg: 1 + lvl * 1000 * rn(),
		fireRate:
			60 - Math.ceil((Math.log(1 + player.level) / Math.log(501)) * 59 * rn()),
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
function star(ct, x, y, rad) {
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
function getOnScreenPos(x, y) {
	return {
		x: w / 2 - screenPos.x * zoom + x * zoom,
		y: h / 2 - screenPos.y * zoom + y * zoom
	}
}

function rnChars(...nums) {
	return nums
		.map(num => String.fromCharCode(65 + Math.floor(26 * num)))
		.join("")
}
function rnRoman(num) {
	return num < 0.2
		? "IV."
		: num < 0.4
		? "V."
		: num < 0.6
		? "III."
		: num < 0.8
		? "II."
		: ""
}
function getGalaxyName(rn) {
	let str = ""
	for (let i = Math.round(rn()); i < 5 + rn() * 3; i++) {
		str +=
			i % 2
				? vowel[Math.floor(rn() * (vowel.length - 0.1))]
				: consonant[Math.floor(rn() * (consonant.length - 0.1))]
	}
	str += rn() > 0.5 ? " " + rnRoman(rn()) : ""
	return str
}
function getRaceName(rn) {
	let str = ""
	for (let i = Math.round(rn()); i < 3 + rn() * 3; i++) {
		let letter =
			(i + 1) % 2
				? vowel[Math.floor(rn() * (vowel.length - 0.1))]
				: consonant[Math.floor(rn() * (consonant.length - 0.1))]
		str += str.length == 0 ? letter : letter.toLowerCase()
	}
	str += rn() > 0.5 ? "ian" : "ord"
	return str
}

var vowel = "AEIOUY"
var consonant = "BCDFGHJKLMNPQRSTVWXY"
var bulletColors = {}
function getBulletColor(seed) {
	if (!bulletColors.hasOwnProperty(seed)) {
		let rn = getNewRng(seed)
		bulletColors[seed] = [
			Math.floor(155 + 100 * rn()),
			Math.floor(155 + 100 * rn()),
			Math.floor(155 + 100 * rn())
		]
		// bulletColors[seed] =
		// 	"rgba(" +
		// 	Math.floor(155 + 100 * rn()) +
		// 	"," +
		// 	Math.floor(155 + 100 * rn()) +
		// 	"," +
		// 	Math.floor(155 + 100 * rn()) +
		// 	",1)"
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
		//TODO Draw interstellar  map
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
var blinkTick = 0
function drawHudShip() {
	ch.strokeStyle = "green"
	ch.fillStyle = "black"
	ch.lineWidth = 2
	ch.strokeRect(25, 25, 400, 300)
	ch.fillRect(25, 25, 400, 300)

	ch.save()
	ch.translate(150, 175)
	ch.rotate(player.rot + Math.PI * 0.5)
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
				ch.moveTo(getRadarX(opts.middle.x), getRadarY(opts.middle.y))
				ch.arc(
					getRadarX(opts.middle.x),
					getRadarY(opts.middle.y),
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
					getRadarX(opts.middle.x) - wd / 2,
					getRadarY(opts.middle.y) + 5
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
	let getRadarX = theX => x + (theX - galaxy.middle.x) / scale
	let getRadarY = theY => y + (theY - galaxy.middle.y) / scale

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
