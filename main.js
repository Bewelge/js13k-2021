import { getNewRng } from "./Rng.js"
import { getShipOpts, renderShip } from "./ship.js"
import {
	angle,
	anglePoints,
	compareAngles,
	dist,
	distPoints,
	turnTowards
} from "./Util.js"

var w = window.innerWidth
var h = window.innerHeight
var cnv, c, cnv2

var screenPos = { x: 0, y: 0 }
var planetLock = null
var homePlanet = null
let shipSeed = Math.floor(Math.random() * 99999)
console.log("Ship seed: " + shipSeed)
var zoom = 10
var quadrantSize = 5000
var mousePos = { x: 0, y: 0 }
var time = 0
var zoomAim = null
var keysdown = {}
var mouseDown = false
var rnNames = getNewRng(123494792498)
var rnSuns = getNewRng(123494792498)
var bullets = {}

export class Enemy {
	constructor(opts) {
		this.seed = opts.seed
		this.shipOpts = getShipOpts(this.seed)
		this.shotDis = opts.shotDis
		this.turnSpeed = opts.turnSpeed
		this.speed = opts.speed
		this.enemyDistance = opts.enemyDistance
		this.size = opts.size
		this.shotSpeed = opts.shotSpeed || 0.02
		this.dmg = opts.dmg
		this.fireRate = opts.fireRate
		this.galaxy = opts.galaxy
		let pos = this.findRandomAim()
		this.x = pos.x
		this.y = pos.y
		this.mot = { x: 0, y: 0 }
		this.rotAcc = 0
		this.rot = Math.random() * Math.PI * 2

		this.shotCd = 0

		//bullet
	}
	shoot() {
		this.mot.x -= Math.cos(this.rot) * 0.2
		this.mot.y -= Math.sin(this.rot) * 0.2
		createBullets(
			this.seed,
			this.shipOpts.weapons,
			this,
			this.size,
			this.rot,
			this.shotSpeed,
			this.dmg
		)
	}
	update() {
		// let isEnemyNear = getEnemyNear()
		let disToPlayer = distPoints(this, player)
		if (disToPlayer < this.enemyDistance) {
			if (disToPlayer < this.shotDis) {
				if (
					compareAngles(this.rot + Math.PI, anglePoints(player, this)) <
					this.turnSpeed * 3
				) {
					if (this.shotCd) {
						this.shotCd--
					} else {
						this.shoot()
						this.shotCd = this.fireRate
					}
					this.boostRight = this.boostLeft = false
				} else {
					// let rotation = (this.rot +=
					// 	this.turnSpeed *
					// 	turnTowards(
					// 		this.rot + Math.PI,
					// 		anglePoints(player, this),
					// 		this.turnSpeed
					// 	))
					// rotation > 0 ? (this.boostLeft = true) : (this.boostLeft = false)
					// rotation < 0 ? (this.boostRight = true) : (this.boostRight = false)
				}
				// this.boost = false
			}
			this.aim = player
			this.moveTo(player)

			//isInShotDis ?
			//fly to & attack player
		} else {
			if (this.aim == player && disToPlayer > this.enemyDistance * 2.5) {
				this.aim = null
			}
			//fly around
			if (!this.aim || distPoints(this.aim, this) < 5) {
				this.aim = this.findRandomAim()
			}
			this.moveTo(this.aim)
		}
		this.mot.x *= 0.99
		this.mot.y *= 0.99
		this.x += this.mot.x
		this.y += this.mot.y

		Object.entries(bullets)
			.filter(entry => entry[0] != this.seed)
			.map(entry => entry[1])
			.forEach(bulletsOfSeed => {
				for (let i = bulletsOfSeed.length - 1; i >= 0; i--) {
					let bullet = bulletsOfSeed[i]
					let dis = dist(bullet[0], bullet[1], this.x, this.y)
					let ang = angle(bullet[0], bullet[1], this.x, this.y)
					let x = Math.cos(ang - this.rot + Math.PI * 0.5) * dis
					let y = Math.sin(ang - this.rot + Math.PI * 0.5) * dis
					if (c.isPointInPath(this.shipOpts.hull.path, x, y)) {
						bulletsOfSeed.splice(i, 1)
						console.log(player.rot, dis)
						this.shipOpts.hull.hitMaskPath.moveTo(x, y)
						this.shipOpts.hull.hitMaskPath.arc(x, y, 0.05, 0, 8)
						addBulletHit(x, y, this)
						addBulletHitSmoke(bullet[0], bullet[1], this)
						this.shipOpts.hull.hp -= bullet[4]
						if (this.shipOpts.hull.hp < 0) {
							this.dead = true
						}
					}
				}
			})
	}
	findRandomAim() {
		if (this.galaxy.planets) {
			let pos = getPlanetPos(
				this.galaxy.planets[
					Math.floor(Math.random() * this.galaxy.planets.length)
				],
				time
			)
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
		renderAShip(this, this.boost, this.boostLeft, this.boostRight)

		// c.strokeStyle = "rgba(255,255,255,0.5)"
		// let ons = getOnScreenPos(this.x, this.y)
		// c.lineWidth = 0.5
		// c.beginPath()
		// c.arc(ons.x, ons.y, this.enemyDistance * zoom, 0, 8)
		// c.closePath()
		// c.stroke()
		// c.strokeStyle = "rgba(255,0,0,0.5)"
		// c.beginPath()
		// c.arc(ons.x, ons.y, this.shotDis * zoom, 0, 8)
		// c.closePath()
		// c.stroke()

		// c.strokeStyle = "white"
		// c.beginPath()
		// c.moveTo(ons.x, ons.y)
		// c.lineTo(
		// 	getOnScreenPos(this.aim.x, this.aim.y).x,
		// 	getOnScreenPos(this.aim.x, this.aim.y).y
		// )
		// c.closePath()
		// c.stroke()
		// c.fillRect(getOnScreenPos(this.aim).x, getOnScreenPos(this.aim).y, 5, 5)
	}
	moveTo(pos) {
		let rotation =
			this.turnSpeed *
			turnTowards(
				this.rot + Math.PI,
				anglePoints(pos, this),
				this.turnSpeed * 3
			)
		rotation > 0 ? (this.boostLeft = true) : (this.boostLeft = false)
		rotation < 0 ? (this.boostRight = true) : (this.boostRight = false)
		this.rotAcc += rotation
		this.rot += this.rotAcc
		this.rotAcc *= 0.9
		let dis = distPoints(this, pos)
		let speed = (Math.log(dis) / Math.log(this.shotDis)) * this.speed
		let acc =
			speed * (0.5 + 0.5 * Math.min(1, Math.max(0, dis / this.shotDis - 1)))
		this.mot.x += acc * Math.cos(this.rot)
		this.mot.y += acc * Math.sin(this.rot)

		this.boost = true
	}
}

window.onload = () => {
	cnv = document.getElementById("c")
	cnv.style.margin = 0
	document.body.margin = 0
	cnv.width = w
	cnv.height = h
	c = cnv.getContext("2d")

	renderBg()

	window.addEventListener("resize", () => {
		renderBg()
		w = window.innerWidth
		h = window.innerHeight
		cnv.width = w
		cnv.height = h
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

		zoom = Math.min(25000, Math.max(0.01, zoom * (wheel < 0 ? 0.97 : 1.03)))
		console.log(zoom)

		delay = false
	})

	window.addEventListener("keydown", ev => {
		keysdown[ev.key] = true
	})
	window.addEventListener("keyup", ev => {
		keysdown[ev.key] = false
	})
	// let mouseDown = false
	window.addEventListener("mousedown", ev => {
		mouseDown = true
		mousePos = { x: ev.clientX, y: ev.clientY }

		if (hoveredGalaxy) {
			if (hoveredPlanet) {
				console.log("planet")
				// zoomAim = {
				// 	x: getPlanetPos(hoveredPlanet).x,
				// 	y: getPlanetPos(hoveredPlanet).y,
				// 	zoom: (hoveredPlanet.rad * 3) / Math.min(w, h)
				// }
				planetLock = hoveredPlanet
			} else {
				zoomAim = {
					x: hoveredGalaxy.middle.x,
					y: hoveredGalaxy.middle.y,
					zoom: Math.min(w, h) / (hoveredGalaxy.size * zoom * 1.1)
				}
			}
		}
	})
	window.addEventListener("mouseup", ev => (mouseDown = false))
	window.addEventListener("mousemove", ev => {
		if (mouseDown) {
			zoomAim = null
			if (planetLock) planetLock = null
			screenPos.x += (mousePos.x - ev.clientX) / zoom
			screenPos.y += (mousePos.y - ev.clientY) / zoom
		}
		mousePos.x = ev.clientX
		mousePos.y = ev.clientY
	})

	screenPos = getGalaxyOpts(4, -5).planets[0].pos
	planetLock = getGalaxyOpts(4, -5).planets[0]
	homePlanet = getGalaxyOpts(4, -5).planets[0]
	player.x = screenPos.x + 25
	player.y = screenPos.y + 25

	render()
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
function getQuadrants() {
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

function render() {
	time += 1
	rnSuns = getNewRng(123494792498)

	if (time % 100 == 0) {
		createDrone(planetLock)
	}
	// c.fillStyle = "rgba(0,0,0,0.7)"
	// c.fillRect(0, 0, w, h, 0.2)
	c.clearRect(0, 0, w, h)

	// if (planetLock) {
	// 	zoomAim = {
	// 		x: getPlanetPos(planetLock, time).x,
	// 		y: getPlanetPos(planetLock, time).y,
	// 		zoom: (planetLock.rad * zoom) / Math.min(w, h)
	// 	}

	// 	// c.fillText(planetLock.name, 10, 20)
	// 	// screenPos = getPlanetPos(planetLock, time)
	// 	// c.strokeStyle = "rgba(255,255,255,0.8)"
	// 	// let rad = planetLock.rad * zoom + 5 * zoom
	// 	// c.strokeRect(w / 2 - rad, h / 2 - rad, rad * 2, rad * 2)
	// }
	// if (player.planet) {
	// 	let pPos = getPlanetPos(player.planet, time)
	// 	screenPos.x = pPos.x + player.x
	// 	screenPos.y = pPos.y + player.y
	// 	zoomAim = null
	// }
	let quadrants = getQuadrants(screenPos)
	hoveredGalaxy = null
	hoveredPlanet = null
	// if (zoomAim) {
	// 	// console.log(zoomAim)
	// 	zoom < zoomAim.zoom ? (zoom = Math.min(5, zoom + 0.01)) : null
	// 	screenPos.x = screenPos.x + (zoomAim.x - screenPos.x) * 0.1
	// 	screenPos.y = screenPos.y + (zoomAim.y - screenPos.y) * 0.1
	// 	if (
	// 		Math.abs(zoomAim.x - screenPos.x) + Math.abs(zoomAim.y - screenPos.y) <
	// 			3 &&
	// 		Math.abs(zoom) / Math.abs(zoomAim.zoom) - 1 < 0.01
	// 	) {
	// 		console.log("found")
	// 		zoomAim = null
	// 	}
	// }
	updatePlayer()
	for (let i = 0; i < 10; i++) {
		updateBullets()
	}

	screenPos = { x: player.x, y: player.y }
	if (mouseDown) {
		if (player.shootCd) {
			player.shootCd--
		} else {
			player.shootCd = player.fireRate
			let x = Math.cos(player.rot) * 0.05
			let y = Math.sin(player.rot) * 0.05
			let newDir = angle(0, 0, x, y)
			let newDis = dist(0, 0, x, y)

			// player.mot.x -= Math.cos(player.rot) * 0.2
			// player.mot.y -= Math.sin(player.rot) * 0.2
			createBullets(
				"player",
				player.shipOpts.weapons,
				player,
				player.size,
				//- Math.PI * 0.125,
				player.rot,
				0.05,
				player.firePower
			)
		}
	}
	for (let i = quadrants.xStart; i <= quadrants.xEnd; i++) {
		for (let j = quadrants.yStart; j <= quadrants.yEnd; j++) {
			drawQuadrant(i, j)
			if (enemyCache[i] && enemyCache[i][j]) {
				for (let k = enemyCache[i][j].length - 1; k >= 0; k--) {
					let enemy = enemyCache[i][j][k]
					enemy.update()
					enemy.render()
					if (enemy.dead) {
						enemyCache[i][j].splice(k, 1)
					}
				}
			}
		}
	}
	updateDrones()

	drawPlayer()

	drawBullets()
	renderBulletHits()
	drawHUD()

	window.requestAnimationFrame(render)
}
function createBullets(seed, weaponsOpts, ship, shipSize, dir, spd, dmg) {
	for (let i = 0; i < weaponsOpts.amount; i++) {
		let weapOffsetX =
			weaponsOpts.x +
			weaponsOpts.w / 2 +
			i * (weaponsOpts.w + weaponsOpts.margin)

		let dis = dist(0, 0, shipSize * weapOffsetX, shipSize * weaponsOpts.top)
		let ang = angle(0, 0, shipSize * weapOffsetX, shipSize * weaponsOpts.top)

		let xSpd = Math.cos(dir) * spd + ship.mot.x / 10
		let ySpd = Math.sin(dir) * spd + ship.mot.y / 10
		let newSpd = dist(0, 0, xSpd, ySpd)
		addBullet(
			seed,
			ship.x + Math.cos(dir + Math.PI * 0.5 + ang) * dis,
			ship.y + Math.sin(dir + Math.PI * 0.5 + ang) * dis,
			dir,
			newSpd,
			dmg
		)
		dis = dist(0, 0, shipSize * -weapOffsetX, shipSize * weaponsOpts.top)
		ang = angle(0, 0, shipSize * -weapOffsetX, shipSize * weaponsOpts.top)
		addBullet(
			seed,
			ship.x + Math.cos(dir + Math.PI * 0.5 + ang) * dis,
			ship.y + Math.sin(dir + Math.PI * 0.5 + ang) * dis,
			dir,
			newSpd,
			dmg
		)
	}
}
function addBullet(seed, x, y, dir, spd, dmg) {
	if (!bullets.hasOwnProperty(seed)) {
		bullets[seed] = []
	}
	bullets[seed].push([x, y, dir, spd, dmg])
}
function updateBullets() {
	Object.values(bullets).forEach(bulletsOfSeed => {
		for (let i = bulletsOfSeed.length - 1; i >= 0; i--) {
			let bullet = bulletsOfSeed[i]
			bullet[0] += Math.cos(bullet[2]) * bullet[3]
			bullet[1] += Math.sin(bullet[2]) * bullet[3]

			if (
				bullet[0] < screenPos.x - w / zoom ||
				bullet[1] < screenPos.y - h / zoom ||
				bullet[0] > screenPos.x + w / zoom ||
				bullet[1] > screenPos.y + h / zoom
			) {
				bulletsOfSeed.splice(i, 1)
				continue
			}
			// if (bullet[0])
			//check out of screen
			//move
			//check collision
		}
	})
}
function drawBullets() {
	c.fillStyle = "green"
	c.strokeStyle = "rgba(255,255,255,0.3)"
	c.lineWidth = 0.5
	c.beginPath()
	Object.values(bullets).forEach(bulletsOfSeed =>
		bulletsOfSeed
			.map(bullet => getOnScreenPos(bullet[0], bullet[1]))
			.forEach(pos => {
				c.moveTo(pos.x - 2, pos.y - 2)
				c.arc(pos.x - 2, pos.y - 2, 0.1 * zoom, 0, 8)
				// c.fillRect(pos.x - 2, pos.y - 2, 4, 4)
			})
	)
	c.fill()
	c.closePath()
	c.stroke()
}
function drawHUD() {
	c.fillStyle = "green"
	let playerSpeed =
		Math.floor(1e5 * dist(0, 0, player.mot.x, player.mot.y)) / 10
	c.fillText("Current Speed:", 30, 40)
	c.fillText(
		playerSpeed > 1000
			? Math.floor((10 * playerSpeed) / 1000) / 10 + "km/s"
			: playerSpeed + "m/s",
		30,
		60
	)

	// c.fillText("Health:", 30, 90)
	// c.fillRect(30, 110, (100 * player.health) / 100, 20)
	// c.strokeRect(30, 110, 100, 20)
	// c.fillStyle = "red"
}
var drones = []
function createDrone() {
	return
	if (planetLock) {
		let dir = Math.random() * Math.PI * 2
		let pos = getPlanetPos(planetLock, time)
		let starOpts = getGalaxyOpts(planetLock.star[0], planetLock.star[1])

		let aim =
			starOpts.planets[
				planetLock.index > 0 ? planetLock.index - 1 : planetLock.index + 1
			]

		drones.push({
			x: pos.x + Math.cos(dir) * (planetLock.rad + 3),
			y: pos.y + Math.sin(dir) * (planetLock.rad + 3),
			aim: aim,
			motX: Math.cos(dir) * 0.005,
			motY: Math.sin(dir) * 0.005
		})
	}
}
var settledPlanets = []
function updateDrones() {
	return
	c.fillStyle = "white"
	for (let i = drones.length - 1; i >= 0; i--) {
		let drone = drones[i]
		drone.motX *= 0.99
		drone.motY *= 0.99
		if (drone.aim) {
			drone.aim.pos = getPlanetPos(drone.aim, time)
			if (distPoints(drone, drone.aim.pos) < drone.aim.rad) {
				drones.splice(i, 1)
				continue
			}
			drone.motX += Math.cos(anglePoints(drone, drone.aim.pos)) * 0.02
			drone.motY += Math.sin(anglePoints(drone, drone.aim.pos)) * 0.02
		} else {
			// let qdr = {x:drones.x / quadrantSize,y:drones.y / quadrantSize}
			// let planets = getGalaxyOpts(qdr.x,qdr.y)
		}
		drone.y += drone.motY
		drone.x += drone.motX
		let onScreenPos = getOnScreenPos(drone.x, drone.y)
		drawEvenTriangle(
			c,
			onScreenPos.x - 2,
			onScreenPos.y - 2,
			4,
			angle(drone.motX, drone.motY, 0, 0) + Math.PI * 0.5
		)
	}
	c.fill()
}
var hoveredGalaxy = null
var hoveredPlanet = null
function drawQuadrant(x, y) {
	c.lineWidth = 0.1
	// c.strokeStyle = "white"
	// let pos = getOnScreenPos(x * quadrantSize, y * quadrantSize)
	// c.strokeRect(pos.x, pos.y, quadrantSize * zoom, quadrantSize * zoom)

	let playerQuadrant = getPlayerQuadrant()
	let playerIn = playerQuadrant.x == x && playerQuadrant.y == y

	if (hasQuadrantGalaxy({ x, y })) {
		let opts = getGalaxyOpts(x, y)
		let rn = getNewRng(opts.seed)
		if (playerIn) updatePlayerGrav(opts)
		let starPos = getOnScreenPos(opts.middle.x, opts.middle.y)
		let mx = screenPos.x + (mousePos.x - w / 2) / zoom
		let my = screenPos.y + (mousePos.y - h / 2) / zoom

		let isHovered = distPoints(starPos, mousePos) < opts.size * zoom
		isHovered ? (hoveredGalaxy = opts) : null

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
		if (opts.starRad * zoom < 0.6) {
			// getStarCol(starRad, rn)
			// c.globalAlpha = 0.4
			// star(c, starPos.x, starPos.y, starRad * zoom + 1)
			return
		}
		//Draw stars

		let rad = opts.starRad * zoom
		c.fillStyle = opts.col(zoom, 1)
		c.beginPath()
		c.arc(starPos.x, starPos.y, rad - 10 * zoom, 0, 8)
		c.closePath()
		c.fill()

		// c.drawImage(
		// 	getStarImg(),
		// 	0,
		// 	0,
		// 	150,
		// 	150,
		// 	starPos.x - rad,
		// 	starPos.y - rad,
		// 	rad * 2,
		// 	rad * 2
		// )
		c.fillStyle = "yellow"
		for (let i = 0; i < Math.min(60, 30 * Math.log(zoom)); i++) {
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
				starPos.x,
				starPos.y,
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

		// drawExplosion(rn, starPos, rad)

		// c.beginPath()
		// for (let i = 0; i < Math.max(15, 5 * Math.min(zoom, 1)); i++) {
		// 	let move = rn() * 4
		// 	let ang = rnSuns() * Math.PI * 2
		// 	let dis = Math.abs(
		// 		((rnSuns() * rad) / 5) * Math.sin(rnSuns() * time * 0.07)
		// 	)

		// 	c.moveTo(starPos.x + Math.cos(ang) * rad, starPos.y + Math.sin(ang) * rad)
		// 	c.quadraticCurveTo(
		// 		starPos.x + Math.cos(ang + move) * rad,
		// 		starPos.y + Math.sin(ang + move) * rad,
		// 		starPos.x + Math.cos(ang + move) * (rad + dis),
		// 		starPos.y + Math.sin(ang + move) * (rad + dis)
		// 	)
		// 	c.quadraticCurveTo(
		// 		starPos.x + Math.cos(ang + move) * rad,
		// 		starPos.y + Math.sin(ang + move) * rad,
		// 		starPos.x + Math.cos(ang + move + move) * rad,
		// 		starPos.y + Math.sin(ang + move + move) * rad
		// 	)
		// 	c.lineTo(starPos.x + Math.cos(ang) * rad, starPos.y + Math.sin(ang) * rad)
		// 	drawEvenTriangle(c, starPos.x, starPos.y, rad + dis, ang)
		// 	c.lineTo(
		// 		starPos.x + Math.sin(i * Math.sin(i) + ((time * 0.001) % 9)) * rad,
		// 		starPos.y + Math.cos(i * Math.sin(i) + ((time * 0.001) % 19)) * rad
		// 	)
		// 	c.fill()
		// }
		// c.globalAlpha = 1
		// c.closePath()

		// if (!isGalaxyDiscovered(x, y)) return
		drawPlanets(opts, isHovered)
	}
	// c.fillText(x + "," + y, pos.x + 10, pos.y + 10)
}
function getPlayerQuadrant() {
	return {
		x: Math.floor(player.x / quadrantSize),
		y: Math.floor(player.y / quadrantSize)
	}
}

function drawPlanets(opts, isHovered) {
	c.strokeStyle = "white"
	c.lineWidth = 0.1
	opts.planets
		.filter(planet => planet.rad * zoom > 1)
		.forEach(planet => {
			let planetPos = getPlanetPos(planet, time)
			let onScreenPos = getOnScreenPos(planetPos.x, planetPos.y)
			drawPlanet(planet, onScreenPos, opts)
			c.closePath()
			// if ( isHovered ) {
			// 	if ( distPoints( onScreenPos, mousePos ) < planet.rad * zoom ) {
			// 		hoveredPlanet = planet
			// 		c.strokeStyle = "green"
			// 		c.lineWidth = 2
			// 		c.beginPath()
			// 		c.arc( onScreenPos.x, onScreenPos.y, planet.rad * zoom + 5, 0, 8 )
			// 		c.stroke()
			// 		c.closePath()
			// 	}
			// }
		})
}
function hitExplosion(pos, rad) {
	for (let i = 0; i < 1; i++) {
		c.fillStyle =
			"rgba(" +
			0 +
			"," +
			Math.floor((Math.abs((time % 14) - 7) / 7) * 255) +
			"," +
			Math.floor((Math.abs((time % 34) - 17) / 17) * 255) +
			"," +
			0.5 * Math.random() +
			")"
		c.beginPath()
		c.ellipse(
			pos.x,
			pos.y,
			rad * 1.5 * zoom * Math.random(),
			rad * 1.2 * zoom * Math.random(),
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
var player = {
	x: 0,
	y: 0,
	health: 100,
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
	speed: 1,
	turnSpeed: 1,
	fireRate: 10,
	firePower: 50,
	fireCd: 0,
	shipOpts: getShipOpts(shipSeed)
}
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

	let onsc = getOnScreenPos(x, y)

	c.lineWidth = 1
	c.strokeStyle = "green"
	// c.beginPath()
	// c.moveTo(onsc.x, onsc.y)
	// c.lineTo(
	// 	onsc.x + Math.cos(player.rot) * 30,
	// 	onsc.y + Math.sin(player.rot) * 30
	// )
	// c.stroke()
	// c.closePath()
	c.beginPath()
	c.strokeStyle = "rgba(255,255,255,0.7)"
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

	renderAShip(
		player,
		keysdown["ArrowUp"],
		keysdown["ArrowLeft"],
		keysdown["ArrowRight"]
	)

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
function renderAShip(ship, boost, boostLeft, boostRight) {
	let quadrantX = Math.floor(ship.x / quadrantSize)
	let quadrantY = Math.floor(ship.y / quadrantSize)
	let shipSystem = getGalaxyOpts(quadrantX, quadrantY)
	let hasGalaxy = hasQuadrantGalaxy({ x: quadrantX, y: quadrantY })
	let sunAng = hasGalaxy ? anglePoints(shipSystem.middle, ship) : -1
	let sunDis = shipSystem.size - distPoints(ship, shipSystem.middle)
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
	let shadeOffset = hasGalaxy
		? sunDis < shipSystem.starRad
			? 0
			: (sunDis / shipSystem.size) * 0.25
		: 0
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
		boost,
		boostLeft,
		boostRight
	)
}

function updatePlayer() {
	// if (player.planet) {
	let speed = 0.003
	if (keysdown["ArrowUp"]) {
		player.thrust.x += Math.cos(player.rot) * speed
		player.thrust.y += Math.sin(player.rot) * speed
	}
	if (keysdown["ArrowDown"]) {
		player.thrust.x -= Math.cos(player.rot) * speed
		player.thrust.y -= Math.sin(player.rot) * speed
	}
	if (keysdown["ArrowLeft"]) {
		player.rotThrust -= speed * 0.7
	}
	if (keysdown["ArrowRight"]) {
		player.rotThrust += speed * 0.7
	}

	// player
	// } else {
	// }
	player.mot.x += player.thrust.x
	player.mot.y += player.thrust.y
	player.x += player.mot.x
	player.y += player.mot.y
	player.rot += player.rotThrust
	player.thrust.x = 0
	player.thrust.y = 0
	player.rotThrust *= 0.96
	Math.abs(player.rotThrust) < 0.001 ? (player.rotThrust = 0) : null

	checkCollisions("player", player)
}
var bulletHits = []
var bulletHitsSmoke = []
function checkCollisions(seed, ship) {
	Object.entries(bullets)
		.filter(entry => entry[0] != seed)
		.map(entry => entry[1])
		.forEach(bulletsOfSeed => {
			for (let i = bulletsOfSeed.length - 1; i >= 0; i--) {
				let bullet = bulletsOfSeed[i]
				let dis = dist(bullet[0], bullet[1], ship.x, ship.y)
				let ang = angle(bullet[0], bullet[1], ship.x, ship.y)
				let x = Math.cos(ang - ship.rot + Math.PI * 0.5) * dis
				let y = Math.sin(ang - ship.rot + Math.PI * 0.5) * dis
				if (c.isPointInPath(ship.shipOpts.wings.path, x, y)) {
					bulletsOfSeed.splice(i, 1)
					ship.shipOpts.wings.hitMaskPath.moveTo(x, y)
					ship.shipOpts.wings.hitMaskPath.arc(x, y, 0.05, 0, 8)
					addBulletHit(x, y, ship)
					addBulletHitSmoke(bullet[0], bullet[1], ship)
					continue
				}
				if (c.isPointInPath(ship.shipOpts.hull.path, x, y)) {
					bulletsOfSeed.splice(i, 1)
					ship.shipOpts.hull.hitMaskPath.moveTo(x, y)
					ship.shipOpts.hull.hitMaskPath.arc(x, y, 0.05, 0, 8)
					addBulletHit(x, y, ship)
					addBulletHitSmoke(bullet[0], bullet[1], ship)
				}
			}
		})
}

function addBulletHit(x, y, anchor) {
	bulletHits.push([x, y, 20, anchor])
}
function addBulletHitSmoke(x, y, anchor) {
	bulletHitsSmoke.push([x, y, 20, anchor])
}
function renderBulletHits() {
	for (let i = bulletHits.length - 1; i >= 0; i--) {
		if (bulletHits[i][2]--) {
			let dis = dist(0, 0, bulletHits[i][0], bulletHits[i][1])
			let ang = angle(0, 0, bulletHits[i][0], bulletHits[i][1])
			let x = Math.cos(ang + Math.PI * 0.5 + bulletHits[i][3].rot) * dis
			let y = Math.sin(ang + Math.PI * 0.5 + bulletHits[i][3].rot) * dis
			let pos = getOnScreenPos(bulletHits[i][3].x + x, bulletHits[i][3].y + y)
			hitExplosion(pos, 0.01 * Math.min(15, zoom))
		} else {
			bulletHits.splice(i, 1)
		}
	}
	c.fillStyle = "rgba(255,255,255,0.5)"
	for (let i = bulletHitsSmoke.length - 1; i >= 0; i--) {
		if (bulletHitsSmoke[i][2]--) {
			let pos = getOnScreenPos(bulletHitsSmoke[i][0], bulletHitsSmoke[i][1])

			let onsc = getOnScreenPos(bulletHitsSmoke[i][0], bulletHitsSmoke[i][1])
			let siz = bulletHitsSmoke[i][2] / 60
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
function drawPlanet(planet, onScreenPos) {
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
	c.arc(
		onScreenPos.x - Math.cos(ang) * planet.rad * zoom * 1.7,
		onScreenPos.y - Math.sin(ang) * planet.rad * zoom * 1.7,
		planet.rad * zoom * 2,
		0,
		8
	)
	c.closePath()
	c.fill()
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
	let col = Math.min(255, Math.floor(rn() * 255))
	let col2 = Math.min(255, Math.floor(rn() * 255))
	let col3 = Math.min(255, Math.floor(rn() * 255))
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
	if (!galaxyOptsCache.hasOwnProperty(x)) {
		galaxyOptsCache[x] = {}
		enemyCache[x] = {}
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
		let starRad = 30 + 60 * rn()
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
			let rad = 6 + 10 * rn()
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
			seed
		}

		enemyCache[x][y] = []
		// let enemyOpts = getEnemyOpts()
		let shipAmount = Math.ceil(rn() * 8)
		for (let i = 0; i < shipAmount; i++) {
			enemyCache[x][y].push(
				new Enemy({
					seed: seed,
					shotDis: 20,
					turnSpeed: 0.003,
					speed: 0.004,
					enemyDistance: 250,
					dmg: 5,
					fireRate: 20,
					shotSpeed: 0.05,
					galaxy: galaxyOptsCache[x][y],
					size: 1
				})
			)
		}
	}
	return galaxyOptsCache[x][y]
}

function getPlanetPos(planet, time) {
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
function drawEvenTriangle(ct, x, y, rad, turn) {
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
function getGalaxyName() {
	return (
		rnChars(rnNames(), rnNames(), rnNames(), rnNames(), rnNames()) +
		" " +
		rnRoman(rnNames())
	)
}
// ;("BCDFGHJKLMNPQRSTVWXZ")
// ;("AEIOUY")
