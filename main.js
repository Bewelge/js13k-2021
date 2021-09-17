var paused = true

var PIH = Math.PI / 2
var PI2 = Math.PI * 2
var BULLET_HITS = 0
var EXPLOSIONS = 1
var BULLETSMOKES = 2
var TRAIL = 3
var BROKENCOMPS = 4
var rnd = Math.random
var flr = Math.floor
var rmvCh = ch => document.body.removeChild(ch)
var apnd = (el, el1) => el.appendChild(el1)
var addEventListenerr = (el, typ, lis) => el.addEventListener(typ, lis)
var hsOwnProperty = (obj, prop) => obj.hasOwnProperty(prop)
class Particles {
	constructor() {
		this.particles = {}
	}
	createNew(id, setup, render, tearDown, max) {
		this.particles[id] = { setup, render, tearDown, max, list: [] }
	}
	render(ids) {
		ids
			.map(id => this.particles[id])
			.forEach(particle => {
				particle.setup()
				for (let i = particle.list.length - 1; i >= 0; i--) {
					if (--particle.list[i][0] > 0) {
						particle.render(particle.list[i])
					} else {
						particle.list.splice(i, 1)
					}
				}
				particle.tearDown()
			})
	}
	add(id, el) {
		this.particles[id].list.push(el)
		this.particles[id].list.length > this.particles[id].max
			? this.particles[id].list.splice(0, 1)
			: null
	}
}
var particles = new Particles()

var w = window.innerWidth
var h = window.innerHeight
var cnv, cnv2, cnvH, c, ch

var screenPos = { x: 0, y: 0 }
let randomStartSeed = flr(rnd() * 99999)
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

var ZOOM_MAX = 6000
var ZOOM_MIN = 0.01
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
	randomStartSeed = flr(rnd() * 99999)
	let rn = getNewRng(randomStartSeed)
	let rndStart = {
		x: flr(rn() * 10000),
		y: flr(rn() * 10000)
	}
	while (
		!hasQuadrantGalaxy(rndStart) ||
		!getGalaxyOpts(rndStart.x, rndStart.y).planets.length
	) {
		rndStart = {
			x: flr(rn() * 10000),
			y: flr(rn() * 10000)
		}
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

class Enemy {
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
		this.rot = rnd() * PI2
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
				this.galaxy.planets[flr(rnd() * this.galaxy.planets.length)],
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
		let size = this.size * zoom * 7
		let thislock = enemyLock == this
		if (distPoints(mousePos, onsc) < size * 1 || thislock) {
			if (hoveredEnemy == null) {
				if (!thislock) {
					hoveredEnemy = this
				}
				setFs(c, "green")
				c.textBaseline = "top"
				setFont(c, 14)

				let y = onsc.y - 60 - size / 2
				let tx = this.race + " Ship"
				fillText(c, tx, onsc.x - measureText(c, tx) / 2, y - 16)
				setFont(c, 10)
				getComponentNames().forEach((component, i) => {
					let yy = y + 13 * i
					fillText(c, components[component].name, onsc.x + 33, yy)
					fillRect(
						c,
						onsc.x - 30,
						yy,
						(60 * this.shipOpts[component].hp) / this.shipOpts[component].maxHp,
						5
					)
				})
			}
		}
		c.lineWidth = thislock ? 3 : 1
		setSs(c, "rgba(200,50,50,0.2)")
		strokeRect(c, onsc.x - size / 2, onsc.y - size / 2, size, size)
		if (!isPosOnScreen(onsc, zoom)) {
			let x = getInRange(onsc.x, 0, w)
			let y = getInRange(onsc.y, 0, h)
			setFs(c, "rgba(200,50,50,0.7)")
			c.lineWidth = 3
			beginPath(c)
			drawEvenTriangle(c, x, y, 18, angle(onsc.x, onsc.y, x, y))
			closePath(c)
			fill(c)
		} else {
			renderAShip(this, this.boost, this.boostLeft, this.boostRight, true)
		}
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
		music.playSound(sounds.explosion, rad)
		window.setTimeout(() => {
			particles.add(EXPLOSIONS, [
				36,
				rndBtwn(-z, z),
				rndBtwn(-z, z),
				ship,
				rnd() < 0.5
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
	addEventListenerr(window, "resize", () => {
		clearTimeout(resizeTimer)
		resizeTimer = window.setTimeout(resize)
	})
	resize()

	addEventListenerr(window, "keydown", ev => {
		keysdown[ev.code] = true
		if (ev.code == "KeyM") {
			muted = !muted
		}
		if (ev.code == "KeyK") {
			killall()
		}
	})
	addEventListenerr(window, "keyup", ev => (keysdown[ev.code] = false))
	addEventListenerr(window, "mousedown", ev => {
		mouseDown = true
		mousePos = { x: ev.clientX, y: ev.clientY }
		if (hoveredEnemy) {
			enemyLock = hoveredEnemy
		}
	})
	addEventListenerr(window, "mouseup", ev => {
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

	addEventListenerr(zoomHandle, "mousedown", ev => {
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
	addEventListenerr(zoomBar, "mousedown", ev => {
		zoomHandleGrabbed = 0

		zoom = getZoomFromEv(ev)

		zoomHandleGrabbed = true
	})

	addEventListenerr(window, "mousemove", ev => {
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
	addEventListenerr(window, "wheel", event => {
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
			let siz = ((0.3 * el[4]) / 150) * (0.2 + 0.8 * rnd()) * zoom

			circs(
				c,
				Array.apply(null, Array(Math.ceil(rnd() * 5))).map(el => [
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
		el => hitexpl(el, getInRange(zoom * 2, 6, 15), el[0] / 10),
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
				Array.apply(null, Array(Math.ceil(rnd() * 15))).map(el => [
					onsc.x + rndBtwn(-siz / 3, siz / 3),
					onsc.y + rndBtwn(-siz / 3, siz / 3),
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
	let xStart = flr((screenPos.x - w / 2 / zoom) / quadrantSize)
	let xEnd = flr((screenPos.x + w / 2 / zoom) / quadrantSize)
	let yStart = flr((screenPos.y - h / 2 / zoom) / quadrantSize)
	let yEnd = flr((screenPos.y + h / 2 / zoom) / quadrantSize)
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
			music.playSound(sounds.shoot)

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
						hitMaskCounter = 0
						lastTime = window.performance.now()
						paused = false
					})
				}, 500)
			}
		}
	})
}

function render() {
	clearRect(c, 0, 0, w, h)

	if (enemyLock && !enemyLock.isDead) {
		let enemyOnsc = getOnScreenPos(enemyLock.x, enemyLock.y)
		let dis = dist(w / 2, h / 2, enemyOnsc.x, enemyOnsc.y)
		let scrRad = Math.min(w, h - 300) / 2
		if (dis > scrRad * 1.5 && zoom > 1.5) {
			zoom = Math.min(
				ZOOM_MAX,
				Math.max(ZOOM_MIN, Math.max(zoom - 0.02, zoom * 0.99))
			)
		} else if (dis < scrRad * 0.5) {
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
	if (!hsOwnProperty(bullets, seed)) {
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
				setSs(c, "green")
				setFs(c, "green")
				c.lineWidth = 0.5
				let tx = opts.name
				setFont(c, 16)
				var siz = opts.size * zoom * 2
				strokeRect(c, pos.x - siz / 2, pos.y - siz / 2, siz, siz)
				fillText(c, tx, pos.x - measureText(c, tx) / 2, pos.y - siz / 2 - 18)
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
		// 	(155 + rnd() * 100) +
		// 	"," +
		// 	(155 + rnd() * 100) +
		// 	",0.4)"
		// 	star(c2, rnd() * w, rnd() * h, rnd() * 2)
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

			beginPath(c)
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
			fill(c)
			closePath(c)
		}

		drawPlanets(opts)
	}
}

function quadrantEquals(ship1, ship2) {
	return posEquals(getShipQuadrant(ship1), getShipQuadrant(ship2))
}
function getShipQuadrant(ship) {
	return {
		x: flr(ship.x / quadrantSize),
		y: flr(ship.y / quadrantSize)
	}
}

function drawPlanets(opts) {
	setSs(c, "white")
	c.lineWidth = 0.1

	opts.planets
		.filter(planet => planet.rad * zoom > 1)
		.forEach(planet => drawPlanet(planet, opts))
}
var UP = "KeyW"
var UP0 = "ArrowUp"
var DOWN = "ArrowDown"
var DOWN0 = "KeyS"
var LEFT = "KeyA"
var LEFT0 = "ArrowLeft"
var RIGHT = "KeyD"
var RIGHT0 = "ArrowRight"
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
		strokeLine(c, onsc, _posPlusAng(onsc, player.rot, 30), "rgb(50,50,50,0.4)")
		beginPath(c)
		setSs(c, "rgba(255,255,255,0.3)")
		if (playerPath.length) {
			let ons = getOnScreenPos(playerPath[0][0], playerPath[0][1])
			moveTo(c, ons.x, ons.y)
			playerPath.forEach(pos => {
				ons = getOnScreenPos(pos[0], pos[1])
				lineTo(c, ons.x, ons.y)
			})
			lineTo(c, onsc.x, onsc.y)
			stroke(c)
			closePath(c)
		}
	}
	let arrowUp = keysdown[UP0] || keysdown[UP]
	if (arrowUp) {
		player.shipOpts.thrust.points
			.filter(el => rnd() < 0.6)
			.forEach(p => {
				let offset = p[0] + player.shipOpts.thrust.tw * rnd()
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
		fillText(c, "👨‍🚀", w / 2 - measureText(c, "👨‍🚀") / 2, h / 2)
		c.font = "12px Arial"
	}
}
function renderAShip(ship, boost, boostLeft, boostRight, showDmg) {
	let quadrantX = flr(ship.x / quadrantSize)
	let quadrantY = flr(ship.y / quadrantSize)
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

		rmvCh(dialog)
	})

	let newGameBut = getButton("Start another game", () => {
		quadrantCache = {}
		galaxyOptsCache = {}
		enemyCache = {}
		enemyLock = null
		getNewPlayer()
		rmvCh(dialog)
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
		clearRect(ct, 0, 0, 300, 300)
		translateToAndDraw(ct, 150, 150, () => {
			save(ct)

			scale(ct, 40, 40)
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
			restore(ct)
			if (!isClosed) {
				window.requestAnimationFrame(tk)
			}
		})
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
			rmvCh(dialog)
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
		,
		subTitleDiv(
			[
				"Mouse to aim.",
				"WASD or Arrow keys to thrust.",
				"Click to shoot.",
				"Scroll to zoom.",
				"",
				"",
				"",
				"Defeat Enemies to improve ship",
				"Hover over planets to repair"
			].join("</br>")
		),
		getButton("Start game", () => {
			getNewPlayer()
			rmvCh(dialog)
			chooseRace()
			music = new Music()
		}),
		getButton("Start muted", () => {
			music = new Music()
			getNewPlayer()
			rmvCh(dialog)
			muted = true

			chooseRace()
		}),
		createDiv("")
	])

	dialog.style.height = "100%"
}
function updatePlayer() {
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
	if (keysdown[UP] || keysdown[UP0]) {
		posPlusAng(player.thrust, player.rot, speed)
	}
	if (keysdown[DOWN] || keysdown[DOWN0]) {
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

	if (keysdown[LEFT] || keysdown[LEFT0]) {
		posPlusAng(player.thrust, player.rot + PIH, -speed)
	}
	if (keysdown[RIGHT] || keysdown[RIGHT0]) {
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

var hitMaskCounter = 0
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
						if (hitMaskCounter++ < 50) {
							moveTo(comp.hitMaskPath, x, y)
							arc(comp.hitMaskPath, x, y, rndBtwn(0.02, 0.1))
						}
						comp.hp = Math.max(0, comp.hp - bullet[4])
						comp.isHit = 15
						music.playSound(sounds.hit)
						particles.add(BULLET_HITS, [
							rndBtwn(15, 25),
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
}
function drawPlanet(planet) {
	let planetPos = getPlanetPos(planet, time)
	let onScreenPos = getOnScreenPos(planetPos.x, planetPos.y)
	if (distPoints(onScreenPos, mousePos) < planet.rad * zoom) {
		hoveredPlanet = planet
	}
	let ang = planet.startAng + time * planet.spd
	save(c)

	fillCirc(c, onScreenPos.x, onScreenPos.y, planet.rad * zoom, planet.col)

	clip(c)
	beginPath(c)

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

	restore(c)
}

function getStarCol(zoomRad, a, rn1, rn2) {
	let col = Math.min(255, -zoomRad * 5 + 10 + flr(rn1 * 200))
	let col2 = Math.min(255, -zoomRad * 5 + 10 + flr(rn2 * 200))
	setFs(c, rgb([Math.max(col, Math.min(zoomRad * 50, 255)), col, col2], a))
}

function getPlanetColor(rn) {
	return rgb(
		[
			Math.min(255, flr(rn() * 75)),
			Math.min(255, flr(rn() * 75)),
			Math.min(255, flr(rn() * 75))
		],
		1
	)
}

function hasQuadrantGalaxy(pos) {
	if (!hsOwnProperty(quadrantCache, pos.x)) {
		quadrantCache[pos.x] = {}
	}
	if (!hsOwnProperty(quadrantCache[pos.x], pos.y)) {
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
	if (!hsOwnProperty(galaxyOptsCache, x)) {
		galaxyOptsCache[x] = {}
	}
	if (!hsOwnProperty(galaxyOptsCache[x], y)) {
		let a = x > y ? -2 * x - 1 : 2 * x
		let b = x > y ? -2 * y - 1 : 2 * y
		let seed = (a + b) * (a + b + 1) * 0.5 + b
		let rn = getNewRng(seed)

		if (!hsOwnProperty(seeds, seed)) {
			seeds[seed] = [x, y]
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

		let planetAmount = 2 + flr(rn() * 9)
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
	if (!hsOwnProperty(enemyCache, x)) {
		enemyCache[x] = {}
	}
	if (!hsOwnProperty(enemyCache[x], y)) {
		enemyCache[x][y] = []

		let galaxy = getGalaxyOpts(x, y)
		let seed = galaxy.seed
		let rn = getNewRng(seed)
		let shipAmount = Math.ceil(3 + (rn() * 12 * player.level) / 500)
		let enemyOpts = getEnemyOpts(rn, seed)
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
	var shotDis = rndBtwn(9, 9 + lvl * 500, rnn)
	var shotSpeed = 0.1 + 1.9 * lvl * rnn()
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
			30 -
				Math.min(
					1,
					Math.ceil(Math.log(1 + lvl * 500) / Math.log(501)) * 28 * rnn()
				)
		),
		shotSpeed,
		size: 1 + rnn(),
		shotLife: shotDis / shotSpeed,
		shotCd: 0,
		race: getRaceName(rn)
	}
}
function getPlanetPos(planet, time) {
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
	if (!hsOwnProperty(bulletColors, seed)) {
		let rn = getNewRng(seed)
		bulletColors[seed] = [
			flr(155 + 100 * rn()),
			flr(155 + 100 * rn()),
			flr(155 + 100 * rn())
		]
	}
	return bulletColors[seed]
}

var drawHUD = () => {
	ch.font = "24px Arial"
	clearRect(ch, 0, 0, w, h)
	drawSpeedAndDirection()

	if (playerGal && playerGal.planets) {
		drawRadar()
	} else {
		drawInterstellarRadar()
	}

	drawHudShip()

	drawComponentHp()
}
function drawComponentHp() {
	let y = 50
	let x = 275
	setSs(ch, "green")
	ch.lineWidth = 1
	ch.textBaseline = "top"
	setFont(ch, 18)
	ch.fontWeight = 800
	let lowHp = ""
	getComponentNames().forEach(component => {
		setFs(ch, "green")
		fillText(ch, components[component].name, x, y)
		strokeRect(ch, x, y + 20, 100, 10)
		setFs(ch, getComponentColor(player.shipOpts[component]))
		fillRect(
			ch,
			x,
			y + 21,
			(100 * player.shipOpts[component].hp) / player.shipOpts[component].maxHp,
			8
		)
		y += 55
		if (player.shipOpts[component].hp <= 0) {
			if (lowHp == "") {
				lowHp =
					components[component].name +
					" critically damaged. Return to planet to repair."
			} else {
				lowHp = "Ship critically damaged. Return to planet to repair."
			}
		}
	})

	if (lowHp != "") {
		setFs(ch, "red")
		fillText(ch, lowHp, 37, 290)
	}

	setFs(ch, getComponentColor(player.shipOpts.hull))
	strokeRect(ch, 50, 35, 200, 12)
	fillRect(
		ch,
		50,
		35,
		(200 * player.shipOpts.hull.hp) / player.shipOpts.hull.maxHp,
		12
	)

	setFs(
		ch,
		"rgba(200,200,50," +
			(0.5 + (0.5 - (0.5 * player.shotCd) / player.fireRate)) +
			")"
	)
	strokeRect(ch, x, y - 135, 100, 4)
	fillRect(ch, x, y - 135, 100 - (100 * player.shotCd) / player.fireRate, 4)
}

function drawHudShip() {
	setSs(ch, "green")
	setFs(ch, "black")

	strokeRect(ch, 25, 25, 400, 300)
	fillRect(ch, 25, 25, 400, 300)

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
	fillRect(ch, x, y, 300, 300)
	setFs(ch, "green")
	strokeRect(ch, x, y, 300, 300)

	save(ch)
	rect(ch, x, y, 300, 300)
	clip(ch)
	ch.lineWidth = 0.2
	beginPath(ch)
	for (let i = 0; i < 8; i++) {
		moveTo(ch, x, flr(y + (i * 300) / 8))
		lineTo(ch, x + 300, flr(y + (i * 300) / 8))

		moveTo(ch, flr(x + (i * 300) / 8), y)
		lineTo(ch, flr(x + (i * 300) / 8), y + 300)
	}
	stroke(ch)
	closePath(ch)

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
				let wd = measureText(ch, x)
				fillText(
					ch,
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

	restore(ch)
}
function drawRadar() {
	blinkTick++
	let x = w - 330
	let y = 25
	save(ch)
	setFs(ch, "black")

	beginPath(ch)
	rect(ch, x, y, 300, 300)
	clip(ch)
	fill(ch)
	closePath(ch)
	setFs(ch, "green")
	strokeRect(ch, x, y, 300, 300)

	ch.lineWidth = 0.4
	beginPath(ch)
	for (let i = 0; i < 6; i++) {
		moveTo(ch, x, y + (i * 300) / 6)
		lineTo(ch, x + 300, y + (i * 300) / 6)

		moveTo(ch, x + (i * 300) / 6, y)
		lineTo(ch, x + (i * 300) / 6, y + 300)
	}
	stroke(ch)
	closePath(ch)

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
	closePath(ch)
	fill(ch)
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
	beginPath(ch)
	if (playerPath.length) {
		let onsX = getRadarX(playerPath[0][0])
		let onsY = getRadarY(playerPath[0][1])

		moveTo(ch, onsX, onsY)
		playerPath.forEach(pos => {
			onsX = getRadarX(pos[0])
			onsY = getRadarY(pos[1])
			lineTo(ch, onsX, onsY)
		})
		lineTo(ch, px, py)
		stroke(ch)
		closePath(ch)
	}
	ch.globalAlpha = 1

	let tx = playerGal.name || " "
	let wd = measureText(ch, tx)

	setFs(ch, "green")
	fillText(ch, tx, w - 175 - wd / 2, 30)

	tx = "Hostile Ships: " + enemies.length
	wd = measureText(ch, tx)
	if (enemies) {
		fillText(ch, tx, w - 175 - wd / 2, 300)
	}
	restore(ch)
}
function drawSpeedAndDirection() {
	setFs(ch, "green")
	let playerSpeed = getPlayerSpeed()
	setFont(ch, 17)
	let tx = "Current Speed: " + playerSpeed + "km/s"

	let wd = measureText(ch, tx)
	fillText(ch, tx, w / 2 - wd / 2, 280)

	let dis = Math.min(45, 50 * dist(0, 0, player.mot.x, player.mot.y))
	let ang = angle(0, 0, player.mot.x, player.mot.y)

	ch.lineWidth = 2
	fillCirc(ch, w / 2, 175, 90, "black")
	strokeCirc(ch, w / 2, 175, 90, "green")

	ch.lineWidth = 2
	beginPath(ch)
	moveTo(ch, w / 2, 175)
	lineTo(ch, w / 2 + Math.cos(ang) * dis, 175 + Math.sin(ang) * dis)
	drawEvenTriangle(
		ch,
		w / 2 + Math.cos(ang) * (dis + 7.5),
		175 + Math.sin(ang) * (dis + 7.5),
		10,
		ang
	)

	closePath(ch)
	stroke(ch)
	restore(ch)
}

function getPlayerSpeed() {
	return flr(1000 * dist(0, 0, player.mot.x, player.mot.y)) / 10
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

function distPoints(point1, point2) {
	try {
		return dist(point1.x, point1.y, point2.x, point2.y)
	} catch (e) {}
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
	return Math.abs(((a + PI2) % PI2) - ((b + PI2) % PI2))
}
function turnTowards(angl, angl2, turnSpeed) {
	angl = angl % PI2
	angl2 = angl2 % PI2
	if (angl < 0) {
		angl += PI2
	}
	if (angl2 < 0) {
		angl2 += PI2
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
		dif += PI2
	}
	if (dif > Math.PI) {
		return 1
	} else {
		return -1
	}
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
	save(c)
	translate(c, x, y)
	draw()
	restore(c)
}
var fillCirc = (c, x, y, rad, col) => {
	circ(c, x, y, rad)
	setFs(c, col)
	fill(c)
}
var strokeCirc = (c, x, y, rad, col) => {
	circ(c, x, y, rad)
	setSs(c, col)
	stroke(c)
}
var circs = (c, arr, fills, strokes) => {
	beginPath(c)
	arr.forEach(circ => {
		moveTo(c, circ[0], circ[1])
		arc(c, circ[0], circ[1], circ[2])
	})
	closePath(c)
	if (strokes) {
		setSs(c, strokes)
		stroke(c)
	}
	if (fills) {
		setFs(c, fills)
		fill(c)
	}
}
var circ = (c, x, y, rad) => {
	beginPath(c)
	arc(c, x, y, rad, 0, 8)
	closePath(c)
}
var strokeLine = (c, pos0, pos1, col) => {
	if (col) {
		setSs(c, col)
	}
	beginPath(c)
	moveTo(c, pos0.x, pos0.y)
	lineTo(c, pos1.x, pos1.y)
	stroke(c)
	closePath(c)
}
var clearRect = (c, x, y, w, h) => c.clearRect(x, y, w, h)
var lineTo = (c, x, y) => c.lineTo(x, y)
var moveTo = (c, x, y) => c.moveTo(x, y)
var quadraticCurveTo = (c, x, y, c1, c2) => c.quadraticCurveTo(x, y, c1, c2)
var arc = (c, x, y, rad) => c.arc(x, y, rad, 0, PI2)
var beginPath = c => c.beginPath()
var closePath = c => c.closePath()
var stroke = c => c.stroke()
var strokeRect = (c, x, y, w, h) => c.strokeRect(x, y, w, h)
var fillRect = (c, x, y, w, h) => c.fillRect(x, y, w, h)
var fillText = (c, txt, x, y) => c.fillText(txt, x, y)
var measureText = (c, txt) => c.measureText(txt).width
var clip = c => c.clip()
var save = c => c.save()
var restore = c => c.restore()
var rect = (c, x, y, w, h) => c.rect(x, y, w, h)
var scale = (c, sc) => c.scale(sc, sc)
var translate = (c, x, y) => c.translate(x, y)
var rotate = (c, rot) => c.rotate(rot)
var fill = c => c.fill()
var createDiv = className => {
	let d = document.createElement("div")
	d.className = className
	return d
}

var createDialog = () => {
	let dialog = createDiv("dialog")
	apnd(document.body, dialog)
	return dialog
}
var titleDiv = txt => {
	let d = createDiv("title")
	d.innerHTML = txt
	return d
}
var subTitleDiv = txt => {
	let d = createDiv("subTitle")
	d.innerHTML = txt
	return d
}
var getButton = (txt, onclick) => {
	let b = document.createElement("button")
	b.onclick = onclick
	b.innerHTML = txt
	return b
}

var createCnv = (w, h) => {
	let c = document.createElement("canvas")
	c.width = w
	c.height = h
	return c
}

var scaleRotate = (c, sc, rot) => {
	c.scale(sc, sc)
	c.rotate(rot)
}
var rndBtwn = (min = 0, max = 1, rn = rnd) => {
	return min + (max - min) * rn()
}
var appendChildren = (parent, children) => {
	children.forEach(child => apnd(parent, child))
}

var pos = (x, y) => {
	return { x, y }
}
var copyPos = pos => {
	return {
		x: pos.x,
		y: pos.y
	}
}
var setFs = (c, fs) => {
	c.fillStyle = fs
}
var setSs = (c, ss) => {
	c.strokeStyle = ss
}
var setPos = (pos, x, y) => {
	pos.x = x
	pos.y = y
}
var posPlusPos = (pos, pos0) => {
	pos.x += pos0.x
	pos.y += pos0.y
	return pos
}
var posPlus = (pos, plus) => {
	pos.x += plus
	pos.y += plus
	return pos
}
var _posMult = (pos, mult) => {
	return { x: pos.x * mult, y: pos.y * mult }
}
var posMult = (pos, mult) => {
	pos.x *= mult
	pos.y *= mult
	return pos
}
var posPlusAng = (pos, ang, dis) => {
	pos.x += Math.cos(ang) * dis
	pos.y += Math.sin(ang) * dis
	return pos
}
var _posPlusAng = (pos, ang, dis) => {
	return {
		x: pos.x + Math.cos(ang) * dis,
		y: pos.y + Math.sin(ang) * dis
	}
}
var setFont = (c, size) => {
	c.font = size + "px Gill Sans MT"
}
var doXTimes = (doThat, xTimes) => {
	for (let xTimes = 0; xTimes < x; xTimes++) {
		doThat()
	}
}
var txtAt = (c, txt, x, y) => {}

var renderShip = (c, x, y, size, shipOpts, rot, opts) => {
	translateToAndDraw(c, x, y, () => {
		scaleRotate(c, size, rot + PIH)

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
var renderThrust = (shipOpts, c, opts) => {
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
			var x = -thrust.w2 / 2 + i * stepW - thrust.tw / 2
			setFs(c, "rgba(255,55,55,0.8)")
			fillRect(c, x, y, thrust.tw, rndBtwn(0.1, 0.25))
			setFs(c, "rgba(255,255,55,0.8)")
			fillRect(c, x, y, thrust.tw, rndBtwn(0.1, 0.25))
		}
	}
}

var renderHull = (shipOpts, c, opts) => {
	renderComponent(c, shipOpts.hull, [shipOpts.hull.path], opts)
	if (!opts.fill && !opts.stroke) {
		save(c)
		c.clip(shipOpts.hull.hitMaskPath)
		setFs(c, opts.fill || "rgba(0,0,0,0.7)")
		c.fill(shipOpts.hull.path)
		restore(c)

		let x = (shipOpts.hull.topW / 2) * shipOpts.hull.windowSize
		let lgr = c.createLinearGradient(-x, 0, x, 0)
		lgr.addColorStop(0, "rgba(50,250,250,1)")
		lgr.addColorStop(1, "rgba(50,150,150,1)")

		let lgr2 = "rgba(255,255,255,0.7)"
		// c.createLinearGradient(-x, 0, x, 0)
		// lgr2.addColorStop(0, "rgba(250,250,250,1)")
		// lgr2.addColorStop(1, "rgba(255,255,255,1)")
		save(c)
		c.scale(shipOpts.hull.windowSize, shipOpts.hull.windowSize)

		shadePath(c, shipOpts.hull.path, lgr, lgr2, opts.ang, opts.dis)
		restore(c)
	}
}

var renderWings = (shipOpts, c, opts) => {
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
			fillRect(c, x, y, 0.1, rndBtwn(0.2, 0.35))
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

var renderWeapons = (c, shipOpts, opts) => {
	renderComponent(c, shipOpts.weapons, [shipOpts.weapons.path], opts)
}

function shadePath(c, path, color, shadeColor, shadeDirection, shadeOffset) {
	save(c)
	setFs(c, shadeColor)
	c.fill(path)
	c.clip(path)
	setFs(c, color)
	translateToAndDraw(
		c,
		Math.cos(shadeDirection) * shadeOffset,
		Math.sin(shadeDirection) * shadeOffset,
		() => c.fill(path)
	)
	restore(c)
}
function rgba(r, g, b, a) {
	return "rgba(" + r + "," + g + "," + b + "," + a + ")"
}
function rgb(arr, a = 1) {
	return rgba(arr[0], arr[1], arr[2], a)
}
function lighten(arr, amnt, a = 1) {
	return rgb(
		arr.map(num => Math.min(255, num + flr(amnt))),
		a
	)
}

function getShipOpts(seed, level) {
	let rn = getNewRng(seed)
	return createRandomShip(rn, level)
}

var createRandomShip = (rn, level) => {
	let col1 = getRandomShipColor(rn)
	let col2 = getRandomSecondaryColor(rn)

	let hp = Math.ceil(2 + rn() * (level + 0.01) * 1000)
	let hull = getHull(rn, col1, hp)

	let wings = getWings(hull, rn, col1, col2, hp)

	let thrust = getThrust(rn, hull, col1, hp)

	let weapons = getWeapons(rn, wings, col2, hp)
	return {
		hull,
		wings,
		thrust,
		weapons
	}
}

function getThrust(rn, hull, color, hp) {
	let amount = Math.ceil(rn() * 5)
	let w1 = hull.bottomW
	let w2 = 2 * rn() * hull.bottomW
	let tw = (2.5 * rn() * w2) / (amount + 2)
	let top = hull.h / 2
	let h = Math.ceil(1000 * rn() * 2) / 1000
	let h1 = (0.5 + 0.5 * rn()) * h
	let h2 = h - h1
	let stepW = w2 / (amount + 1)
	let points = []
	for (let i = 1; i <= amount; i++) {
		points.push([-w2 / 2 + i * stepW - tw / 2, top + h1])
	}
	return {
		h,
		h1,
		h2,
		w1,
		w2,
		tw,
		top,
		amount,
		stepW,
		color,
		points,
		path: getThrustPath(top, w1, h1, w2),
		path2: getThrustPath2(points, tw, h2),
		hitMaskPath: new Path2D(),
		hp,
		maxHp: hp
	}
}

function getWeapons(rn, wings, color, hp) {
	let amount = Math.ceil(rn() * 3 * Math.min(1, player.level / 100))
	let bulletColor = [
		rndBtwn(100, 255, rn),
		rndBtwn(100, 255, rn),
		rndBtwn(100, 255, rn)
	]
	let w = 0.1 + rn() * 0.15
	let leftest = Math.max.apply(
		null,
		wings.list.map(wing => wing.bottomW)
	)
	let rightest = Math.min.apply(
		null,
		wings.list.map(wing => wing.bottomW)
	)
	let x = 0 - leftest / 2 + rn() * (leftest / 2 - amount * w)
	let margin = Math.max((0 - x - amount * w) / (amount + 1), 0)
	let h = wings.maxH * 1.2 * rn()
	let top = wings.maxY - wings.maxH

	let topW1 = (0.3 + rn() * 0.5) * w
	let topW2 = w
	let h1 = h * rn()
	let h2 = h - h1
	let t1wh = topW1 / 2
	let t2wh = topW2 / 2
	let ps = [
		[-t1wh, 0],
		[-t1wh, h1],
		[-t2wh, h1],
		[-t2wh, h1 + h2],
		[t2wh, h1 + h2],
		[t2wh, h1],
		[t1wh, h1],
		[t1wh, 0]
	]
	let cpath = new Path2D()
	cpath.rect(x, top, (w + margin) * amount * 2 + margin * 2, h)

	let isRound = rn() < 0.5

	let path = getAllWeaponsPath(amount, ps, x, margin, w, top, isRound)

	return {
		topW1,
		topW2,
		h1,
		h2,
		w,
		h,
		x,
		top,
		margin,
		amount,
		leftest,
		rightest,
		color,
		bulletColor,
		isRound,
		hp,
		maxHp: hp,
		hitMaskPath: new Path2D(),
		path,
		cpath
	}
}

function getAllWeaponsPath(amount, ps, x, margin, w, top, isRound) {
	let path = new Path2D()
	for (let i = 0; i < amount; i++) {
		path.addPath(
			getSingleWeaponPath(
				ps.map(pt => [pt[0] + x + i * (margin + w), pt[1] + top]),
				isRound
			)
		)
		path.addPath(
			getSingleWeaponPath(
				ps.map(pt => [pt[0] - x - i * (margin + w), pt[1] + top]),
				isRound
			)
		)
	}
	return path
}

function getWings(hull, rn, color, col2, hp) {
	let maxW = hull.bottomW
	let maxH = hull.h
	let maxY = -hull.h / 2
	let minY = -hull.h / 2
	let amount = Math.ceil(rn() * 4)
	let list = []
	for (let i = 0; i < amount; i++) {
		let topW = rn() * 3 + Math.min(hull.bottomW, hull.topW)
		let bottomW = rn() * 4 + Math.min(hull.bottomW, hull.topW)
		let offsetTop = (rn() * hull.h) / 2
		let h0 = hull.h * (0.3 * rn())
		let h1 = h0 + (hull.h - h0) * (rn() * 0.2 + 0.1)
		let h2 = h1 + (hull.h - h1) * rn() * (0.5 + 0.3)
		let h3 = h2 + (hull.h - h2) * rn()

		let isRound = rn() < 0.5

		var col = rn() < 0.3 ? color : col2
		list.push({
			topW,
			bottomW,
			h0,
			h1,
			h2,
			h3,
			offsetTop,
			hitMaskPath: new Path2D(),
			color: col,
			isRound,
			path: getWingPath(topW, bottomW, h0, h1, h2, h3, -hull.h / 2, isRound)
		})
		list[list.length - 1].path.color = col

		if (minY > offsetTop - hull.h) {
			minY = offsetTop - hull.h
		}
		if (maxY < offsetTop + h3 - hull.h) {
			maxY = offsetTop + h3 - hull.h
			maxW = bottomW
			maxH = h3
		}
	}
	let path = new Path2D()
	list.forEach(wing => path.addPath(wing.path))

	return {
		maxW,
		maxY,
		minY,
		maxH,
		amount,
		list,
		path,
		color,
		hitMaskPath: new Path2D(),
		hp,
		maxHp: hp
	}
}

function getHull(rn, color, hp) {
	var topW = rndBtwn(0.5, 1.5, rn)
	var h = rndBtwn(0.5, 2.5, rn)
	let opts = {
		topW,
		bottomW: rndBtwn(0.5, 2, rn),
		h,
		controlTop: rn() * h,
		controlSide: (topW / 2) * rn(),
		windowSize: rndBtwn(0.2, 0.5, rn)
	}
	opts.path = getHullPath(opts)
	opts.hp = hp * 3
	opts.maxHp = hp * 3
	opts.hitMaskPath = new Path2D()
	opts.color = color
	return opts
}
function getMerged(a, b, tween) {
	return a * tween + b * (1 - tween)
}
function getMergedAttrs(comp1, comp2, attrs, tween) {
	let obj = {}
	attrs.forEach(attr => {
		obj[attr] = getMerged(comp1[attr], comp2[attr], tween)
	})
	obj.color = getMergedColor(comp1.color, comp2.color, tween)
	obj.hitMaskPath = new Path2D()
	obj.hp = obj.maxHp
	return obj
}
function getMergedHull(hull1, hull2, tween) {
	let obj = getMergedAttrs(
		hull1,
		hull2,
		[
			"topW",
			"bottomW",
			"h",
			"controlTop",
			"controlSide",
			"windowSize",
			"maxHp"
		],
		tween
	)
	obj.path = getHullPath(obj)
	return obj
}
function getMergedWings(hullH, wings1, wings2, tween) {
	let wingArr = []
	for (let i = 0; i < wings2.list.length; i++) {
		if (wings1.list[i] && wings2.list[i]) {
			let wing1 = wings1.list[i]
			let wing2 = wings2.list[i]
			let wing = getMergedAttrs(
				wing1,
				wing2,
				["topW", "bottomW", "h0", "h1", "h2", "h3"],
				tween
			)
			wing.offsetTop = getMerged(wing1.offsetTop, wing2.offsetTop, tween)
			wing.path = getWingPath(
				wing.topW,
				wing.bottomW,
				wing.h0,
				wing.h1,
				wing.h2,
				wing.h3,
				-hullH / 2,
				wing1.isRound ^ wing2.isRound
			)

			wingArr.push(wing)
		} else {
			wingArr.push(wings2.list[i])
		}
	}
	let wingPath = new Path2D()
	wingArr.forEach(wing => wingPath.addPath(wing.path))
	let wings = getMergedAttrs(
		wings1,
		wings2,
		["maxW", "maxY", "minY", "maxH", "maxHp"],
		tween
	)
	wings.amount = wings2.amount
	wings.list = wingArr
	wings.path = wingPath
	return wings
}

var getMergedWeapons = (weapons1, weapons2, tween) => {
	let weapons = getMergedAttrs(
		weapons1,
		weapons2,
		["w", "x", "top", "margin", "h", "topW1", "topW2", "h1", "h2", "maxHp"],
		tween
	)
	let tw1h = weapons.topW1 / 2
	let tw2h = weapons.topW2 / 2
	let ps = [
		[-tw1h, 0],
		[-tw1h, weapons.h1],
		[-tw2h, weapons.h1],
		[-tw2h, weapons.h1 + weapons.h2],
		[tw2h, weapons.h1 + weapons.h2],
		[tw2h, weapons.h1],
		[tw1h, weapons.h1],
		[tw1h, 0]
	]
	weapons.amount = weapons2.amount

	weapons.cpath = new Path2D()
	weapons.cpath.rect(
		weapons.x,
		weapons.top,
		(weapons.w + weapons.margin) * weapons.amount * 2 + weapons.margin * 2,
		weapons.h
	)
	weapons.isRound = weapons1.isRound ^ weapons2.isRound
	weapons.path = getAllWeaponsPath(
		weapons.amount,
		ps,
		weapons.x,
		weapons.margin,
		weapons.w,
		weapons.top,
		weapons.isRound
	)

	weapons.leftest = Math.min(weapons1.leftest, weapons2.leftest)
	weapons.rightest = Math.max(weapons1.rightest, weapons2.rightest)
	weapons.bulletColor = getMergedColor(
		weapons1.bulletColor,
		weapons2.bulletColor,
		tween
	)
	return weapons
}
var getMergedThrust = (hull, thrust1, thrust2, tween) => {
	let thrust = getMergedAttrs(
		thrust1,
		thrust2,
		["h", "w1", "w2", "h1", "h2", "tw", "maxHp"],
		tween
	)
	thrust.amount = thrust2.amount
	thrust.top = getMerged(thrust1.top, hull.h / 2, tween)
	thrust.stepW = thrust.w2 / (thrust.amount + 1)
	thrust.points = []
	for (let i = 1; i <= thrust.amount; i++) {
		thrust.points.push([
			-thrust.w2 / 2 + i * thrust.stepW - thrust.tw / 2,
			thrust.top + thrust.h1
		])
	}
	thrust.path = getThrustPath(thrust.top, thrust.w1, thrust.h1, thrust.w2)
	thrust.path2 = getThrustPath2(thrust.points, thrust.tw, thrust.h2)

	return thrust
}
function getMergedColor(col1, col2, tween) {
	return [
		col1[0] * tween + (1 - tween) * col2[0],
		col1[1] * tween + (1 - tween) * col2[1],
		col1[2] * tween + (1 - tween) * col2[2]
	]
}
function getHullPath(opts) {
	let path = new Path2D()
	moveTo(path, -opts.topW / 2, -opts.h / 2)
	let t2 = opts.topW / 2
	let h2 = opts.h / 2
	path.bezierCurveTo(
		-t2 + opts.controlSide,
		-h2 - opts.controlTop,
		t2 - opts.controlSide,
		-h2 - opts.controlTop,
		t2,
		-h2
	)
	lineTo(path, opts.bottomW / 2, h2)
	lineTo(path, -opts.bottomW / 2, h2)
	lineTo(path, -opts.topW / 2, -h2)
	return path
}
function getThrustPath(y, w1, h1, w2) {
	let path = new Path2D()
	moveTo(path, -w1 / 2, y)
	lineTo(path, w1 / 2, y)
	lineTo(path, w2 / 2, y + h1)
	lineTo(path, -w2 / 2, y + h1)
	lineTo(path, -w1 / 2, y)

	return path
}
function getThrustPath2(ps, tw, h2) {
	let path = new Path2D()

	ps.forEach(p => {
		path.rect(p[0], p[1], tw, h2)
	})

	return path
}
function getSingleWeaponPath(ps, isRound) {
	let path = new Path2D()

	if (isRound) {
		moveTo(path, ps[0][0], ps[0][1])
		let i = 1
		for (i = 1; i < ps.length - 2; i++) {
			let xc = (ps[i][0] + ps[i + 1][0]) / 2
			let yc = (ps[i][1] + ps[i + 1][1]) / 2

			quadraticCurveTo(path, ps[i][0], ps[i][1], xc, yc)
		}
		quadraticCurveTo(path, ps[i][0], ps[i][1], ps[i + 1][0], ps[i + 1][1])
	} else {
		moveTo(path, ps[0][0], ps[0][1])
		for (let i = 1; i < ps.length; i++) {
			lineTo(path, ps[i][0], ps[i][1])
		}
	}
	lineTo(path, ps[0][0], ps[0][1])
	return path
}
function getWingPath(w1, w2, h1, h2, h3, h4, y, isRound) {
	let path = new Path2D()
	let ps = [
		[0, y + h1],
		[-w1 / 2, y + h2],
		[-w2 / 2, y + h3],
		[0, y + h4],
		[w2 / 2, y + h3],
		[w1 / 2, y + h2],
		[0, y + h1]
	]
	if (isRound) {
		moveTo(path, ps[0][0], ps[0][1])
		let i = 1
		for (i = 1; i < ps.length - 2; i++) {
			let xc = (ps[i][0] + ps[i + 1][0]) / 2
			let yc = (ps[i][1] + ps[i + 1][1]) / 2

			quadraticCurveTo(path, ps[i][0], ps[i][1], xc, yc)
		}
		quadraticCurveTo(path, ps[i][0], ps[i][1], ps[i + 1][0], ps[i + 1][1])
	} else {
		moveTo(path, ps[0][0], ps[0][1])
		for (let i = 1; i < ps.length; i++) {
			lineTo(path, ps[i][0], ps[i][1])
		}
	}
	return path
}

function getRandomShipColor(rn) {
	return [flr(55 + rn() * 50), flr(55 + rn() * 50), flr(55 + rn() * 50)]
}
function getRandomSecondaryColor(rn) {
	let rnd = flr(rn() * 155)
	return [rnd, rnd, rnd]
}
function mulberry32(a) {
	return function () {
		var t = (a += 0x6d2b79f5)
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

var getNewRng = seed => {
	return mulberry32(seed)
}

var renderBg = (w, h) => {
	let cnv2 = document.getElementById("b")
	cnv2.style.margin = 0
	document.body.margin = 0
	cnv2.width = w
	cnv2.height = h
	let c2 = cnv2.getContext("2d")
	for (let i = 0; i < 1000; i++) {
		setFs(c2, rgb([125, 155 + rnd() * 100, 155 + rnd() * 100], 0.4))
		star(c2, rnd() * w, rnd() * h, rnd() * 2)
	}
}

var timer = 1
var hitExplosion = (progress, c, pos, rad, col) => {
	timer += 0.1
	for (let i = 0; i < 3; i++) {
		setFs(c, lighten(col, rndBtwn(0, 50), rndBtwn(0, 1 - progress)))
		beginPath(c)

		c.ellipse(
			pos.x,
			pos.y,
			rad * progress * rnd(),
			rad * progress * rnd(),
			((timer * 0.01) % 1.248) * PI2,
			0,
			PI2,
			0
		)
		fill(c)
		closePath(c)
	}
}

var star = (ct, x, y, rad) => {
	let rndAng = rnd() * PI2
	ct.lineWidth = rad * 0.5
	beginPath(ct)
	drawEvenTriangle(ct, x, y, rad, rndAng)

	drawEvenTriangle(ct, x, y, rad, rndAng + Math.PI)
	fill(ct)
	closePath(ct)
}
var drawEvenTriangle = (ct, x, y, rad, turn) => {
	let ang1 = PI2 / 3
	moveTo(ct, x + Math.cos(turn) * rad, y + Math.sin(turn) * rad)
	lineTo(ct, x + Math.cos(turn + ang1) * rad, y + Math.sin(turn + ang1) * rad)
	lineTo(
		ct,
		x + Math.cos(turn + ang1 * 2) * rad,
		y + Math.sin(turn + ang1 * 2) * rad
	)
}
var vowel = "AEIOUY"
var consonant = "BCDFGHJKLMNPQRSTVWXY"
var getRaceName = rn => {
	let str = ""
	for (let i = Math.round(rn()); i < 3 + rn() * 3; i++) {
		let letter =
			(i + 1) % 2
				? vowel[flr(rn() * (vowel.length - 0.1))]
				: consonant[flr(rn() * (consonant.length - 0.1))]
		str += str.length == 0 ? letter : letter.toLowerCase()
	}
	str += ["ian", "ord", "an", "ar", "'ok"][flr(rn() * 4.9)]
	return str
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
var getGalaxyName = rn => {
	let str = ""
	for (let i = Math.round(rn()); i < 5 + rn() * 3; i++) {
		str +=
			i % 2
				? vowel[flr(rn() * (vowel.length - 0.1))]
				: consonant[flr(rn() * (consonant.length - 0.1))]
	}
	str += rn() > 0.5 ? " " + rnRoman(rn()) : ""
	return str
}

var openWindow = (player, enemy, callback) => {
	let scale = Math.min(150, Math.max(30, window.innerWidth / 8))
	zoom = 0.05
	let dialog = createDialog()
	let cont = createDiv("cont")

	apnd(dialog, titleDiv("Assimilation"))
	apnd(
		dialog,
		subTitleDiv(
			"You destroyed all of the " + enemy.race + "s. Now steal their tech."
		)
	)
	apnd(dialog, cont)
	apnd(dialog, subTitleDiv("Click Ship parts on the right to assimilate"))

	let ship0 = createDiv("col")
	let components0 = createDiv("col")
	let stats = createDiv("colWide")
	let ship1 = createDiv("col")
	let components1 = createDiv("col")

	let ship0Cnv = createCnv(scale, scale * 2)
	let cShip0 = ship0Cnv.getContext("2d")
	let ship1Cnv = createCnv(scale, scale * 2)
	let cShip1 = ship1Cnv.getContext("2d")

	apnd(ship0, ship0Cnv)
	apnd(ship1, ship1Cnv)

	let isClosed = false

	let curOpts = {
		hull: player.shipOpts.hull,
		wings: player.shipOpts.wings,
		weapons: player.shipOpts.weapons,
		thrust: player.shipOpts.thrust
	}

	var renderCurShip = opts => {
		clearRect(cShip0, 0, 0, scale, scale * 2)
		clearRect(cShip1, 0, 0, scale, scale * 2)
		let renderOpts = {
			ang: -PIH,
			dis: 0.1,
			boost: true,
			boostLeft: true,
			boostRight: true
		}
		renderShip(cShip0, scale / 2, scale, scale / 5, opts, -PIH, renderOpts)
		renderShip(
			cShip1,
			scale / 2,
			scale,
			scale / 5,
			enemy.shipOpts,
			-PIH,
			renderOpts
		)

		if (!isClosed) {
			window.requestAnimationFrame(() => renderCurShip(opts))
		}
	}

	renderCurShip(curOpts)

	let comps = components
	Object.values(comps).forEach(comp => {
		comp.statDivs = {}
		comp.statVals = {}
		comp.statChangeDivs = {}
	})

	Object.keys(comps).forEach(compName => {
		let compDiv0 = createDiv("comp")
		let compImg0 = createCnv(scale, scale)
		let c0 = compImg0.getContext("2d")
		c0.translate(scale / 2, scale / 2)
		c0.scale(scale / 5, scale / 5)
		comps[compName].render(c0, curOpts)
		apnd(compDiv0, compImg0)

		let compStats0 = createDiv("compWide")
		let statCol0 = createDiv("statCol")
		let statColChange = createDiv("statCol")
		let statColName = createDiv("statCol")
		let statColEmpty = createDiv("statCol")
		let statCol1 = createDiv("statCol")
		appendChildren(compStats0, [
			statCol0,
			statColChange,
			statColName,
			statColEmpty,
			statCol1
		])

		Object.entries(comps[compName].stats).forEach(entry => {
			let statName = entry[0]
			let val = entry[1](player)

			let divVal = createDiv("statValue")
			let divValChange = createDiv("statValueChange")
			let divValEnemy = createDiv("statValue2")

			let divName = createDiv("statName")
			divName.innerHTML = statName

			comps[compName].statDivs[statName] = divVal
			comps[compName].statChangeDivs[statName] = divValChange
			divValChange.innerHTML = "(+0)"
			comps[compName].statVals[statName] = val
			divVal.innerHTML = getFormattedStat(comps[compName], statName, val)
			divValEnemy.innerHTML = getFormattedStat(
				comps[compName],
				statName,
				entry[1](enemy)
			)

			apnd(statCol0, divVal)
			apnd(statColChange, divValChange)
			apnd(statColName, divName)
			apnd(statCol1, divValEnemy)
		})

		let compDiv1 = createDiv("comp clickable")
		let compImg1 = createCnv(scale, scale)
		let c1 = compImg1.getContext("2d")

		c1.translate(scale / 2, scale / 2)
		c1.scale(scale / 5, scale / 5)
		comps[compName].render(c1, enemy.shipOpts)
		apnd(compDiv1, compImg1)

		addEventListenerr(compImg1, "click", () => {
			getCompClickListener(
				compDiv1,
				c0,
				comps,
				compName,
				player,
				enemy,
				curOpts
			)
		})

		apnd(components0, compDiv0)
		apnd(stats, compStats0)
		apnd(components1, compDiv1)
	})

	appendChildren(cont, [ship0, components0, stats, components1, ship1])

	let confirmBut = getButton("Confirm", () => {
		player.shipOpts = curOpts
		dialog.style.height = "0%"
		window.setTimeout(() => {
			rmvCh(dialog)
			isClosed = true
			Object.entries(comps)
				.filter(entry => entry[1].selected)
				.forEach(entry => {
					let selectedName = entry[0]
					switch (selectedName) {
						case "wings":
							player.turnSpeed = (player.turnSpeed + enemy.turnSpeed) / 2
							break
						case "weapons":
							player.dmg = (player.dmg + enemy.dmg) / 2
							player.fireRate = (player.fireRate + enemy.fireRate) / 2
							player.shotSpeed = (player.shotSpeed + enemy.shotSpeed) / 2
							player.shotDis = (player.shotDis + enemy.shotDis) / 2
							player.shotLife = player.shotDis / player.shotSpeed
							break
						case "thrust":
							player.speed = (player.speed + enemy.speed) / 2
							break
					}
				})
			callback()
		}, 300)
	})

	apnd(dialog, confirmBut)

	window.setTimeout(() => (dialog.style.height = "100%"), 50)
}
var merging = false
function getCompClickListener(
	compImg1,
	c0,
	comps,
	compName,
	player,
	enemy,
	curOpts
) {
	music.playSound(sounds.merge)
	let tweenCounter = 50
	let comp = comps[compName]

	let tween = (from, to) => {
		if (from == undefined || to == undefined) return
		merging = true
		tweenCounter--

		curOpts[compName] = comp.getMerged(
			curOpts,
			from,
			to,
			Math.max(0.5, tweenCounter / 50)
		)

		if (compName == "hull" || compName == "thrust") {
			curOpts.thrust.top = curOpts.hull.h / 2
			curOpts.thrust.w1 = curOpts.hull.bottomW
			curOpts.thrust = comps.thrust.getMerged(curOpts, curOpts, curOpts, 0.5)
		}

		clearRect(c0, -150, -150, 300, 300)
		save(c0)
		c0.shadowBlur = "15px"
		c0.shadowColor = "red"

		comp.render(c0, curOpts)
		restore(c0)

		if (tweenCounter > 0) {
			window.requestAnimationFrame(() => {
				tween(from, to)
			})
		} else {
			merging = false
		}
	}
	let from, to
	let getStatVal, getChange
	if (compImg1.classList.contains("selected")) {
		compImg1.classList.remove("selected")
		comp.selected = false
		getStatVal = stat => comp.stats[stat](player)
		getChange = () => 0
		from = curOpts
		to = player.shipOpts
	} else {
		tweenCounter = 50
		compImg1.classList.add("selected")
		comp.selected = true
		getStatVal = stat =>
			(comp.stats[stat](player) + comp.stats[stat](enemy)) / 2
		getChange = statName => {
			let stat = comp.stats[statName]
			stat(player)
			let formatter =
				comp.formatters && comp.formatters[statName]
					? comp.formatters[statName]
					: formatNum
			return (
				formatter((stat(player) + stat(enemy)) / 2) - formatter(stat(player))
			)
		}
		from = player.shipOpts
		to = enemy.shipOpts
	}
	Object.entries(comp.stats).forEach(entry => {
		let statName = entry[0]
		comp.statDivs[statName].innerHTML = getFormattedStat(
			comp,
			statName,
			getStatVal(statName)
		)
		let change = getChange(statName)

		comp.statChangeDivs[statName].innerHTML =
			"(" + (change >= 0 ? "+" : "") + formatNum(change) + ")"
		comp.statChangeDivs[statName].className =
			change > 0 ? "plus" : change < 0 ? "minus" : ""
	})
	tween(from, to)
}

function getFormattedStat(comp, statName, val) {
	let format =
		comp.formatters && comp.formatters[statName]
			? comp.formatters[statName]
			: formatNum
	let suffix =
		comp.suffixes && comp.suffixes[statName] ? comp.suffixes[statName] : ""
	let str = format(val, 1)
	return str + suffix
}

function formatNum(num, denom) {
	if (num == 0) return num
	denom =
		denom ||
		Math.ceil(Math.abs(Math.log10(Math.abs(Math.max(-1, Math.min(1, num)))))) +
			1

	return flr(Math.pow(10, denom) * num) / Math.pow(10, denom)
}

var getComponentKeys = () => {
	return Object.keys(components).sort((a, b) => (b == "hull" ? -1 : 1))
}

var getComponentNames = () => {
	return Object.keys(components).sort((a, b) => -(a == "hull" ? 1 : 0))
}

var components = {
	weapons: {
		name: "Weapons",

		stats: {
			HP: ship => ship.shipOpts.weapons.maxHp,
			"Fire Rate": ship => ship.fireRate,
			Damage: ship => ship.dmg,
			"Shot Speed": ship => ship.shotSpeed,
			Range: ship => ship.shotLife * ship.shotSpeed
		},
		formatters: {
			"Fire Rate": val => formatNum(60 / val, 3),
			"Shot Speed": val => formatNum(100 * val, 1)
		},
		suffixes: {
			"Fire Rate": "/s",
			"Shot Speed": "km/s"
		},

		render: (c, opts) => {
			translateToAndDraw(c, 0, ((1 / (40 / 5)) * 40) / 5, () =>
				renderWeapons(c, opts, 0.5, 0.5)
			)
		},
		getMerged: (curOpts, opts1, opts2, tween) =>
			getMergedWeapons(opts1.weapons, opts2.weapons, tween)
	},
	hull: {
		name: "Hull",
		stats: {
			HP: ship => ship.shipOpts.hull.maxHp
		},
		render: (c, opts) => renderHull(opts, c, 0.5, 0.5),
		getMerged: (curOpts, opts1, opts2, tween) =>
			getMergedHull(opts1.hull, opts2.hull, tween)
	},
	wings: {
		name: "Wings",
		formatters: {
			"Turn Speed": val => formatNum(100 * val, 3)
		},
		stats: {
			HP: ship => ship.shipOpts.wings.maxHp,

			"Turn Speed": ship => ship.turnSpeed
		},
		render: (c, opts) => renderWings(opts, c, 0.5, 0.5),
		getMerged: (curOpts, opts1, opts2, tween) =>
			getMergedWings(curOpts.hull.h, opts1.wings, opts2.wings, tween)
	},
	thrust: {
		name: "Thrust",
		formatters: {
			"Thrust Speed": val => formatNum(1000 * val, 3)
		},
		stats: {
			HP: ship => ship.shipOpts.wings.maxHp,
			"Thrust Speed": ship => ship.speed
		},
		render: (c, opts) =>
			translateToAndDraw(c, 0, -((1 / (40 / 5)) * 40) / 4, () =>
				renderThrust(opts, c, 0.5, 0.5, true)
			),
		getMerged: (curOpts, opts1, opts2, tween) =>
			getMergedThrust(curOpts.hull, opts1.thrust, opts2.thrust, tween)
	}
}

var freqs = {
	A: 440,
	C: 523.3,
	E: 659.3,
	G: 392,
	B: 439.9,
	D: 587.3,
	F: 349.2
}
let chords = [
	[freqs.A, freqs.C, freqs.E],
	[freqs.G, freqs.B, freqs.D],
	[freqs.F, freqs.A, freqs.C],
	[freqs.G, freqs.B, freqs.D]
]
var durs = [0.25, 0.5, 1, 2, 4]
var music
var muted = false
class Music {
	constructor() {
		this.ctx = new AudioContext()
		this.chordLoop()
		this.curChord = 0
		this.nextChordAt = 0
		this.nextNoteAt = 0
		this.nextBeatAt = 0
		this.chordLength = 1.5
		this.rythm = [2, 0.25, 0.25, 0.5]
		this.breaks = 0.8
		this.queue = {}
	}

	playRandomNote() {
		let dur = durs[flr(rnd() * durs.length)]
		let note = chords[this.curChord][flr(rnd() * 3)]
		this.playNote(
			this.ctx,
			note,
			rndBtwn(0.1, 0.05),
			this.time,
			this.nextNoteAt - this.time,
			dur * this.breaks,
			"triangle"
		)
		this.nextNoteAt += dur
	}
	chordLoop() {
		if (!muted) {
			this.time = this.ctx.currentTime
			if (this.nextChordAt - this.time < 1) {
				this.curChord++
				this.curChord = this.curChord % chords.length
				let durCounter = 0
				this.rythm.forEach((ryth, i) => {
					this.playChord(
						this.ctx,
						chords[this.curChord],
						this.nextChordAt - this.time + durCounter,
						ryth * this.breaks
					)
					durCounter += ryth
				})

				this.nextChordAt += durCounter
			}
			if (this.nextNoteAt - this.time < 1) {
				this.playRandomNote()
			}
		}

		window.requestAnimationFrame(this.chordLoop.bind(this))
	}
	playChord(c, arr, delay, dur) {
		let gain = 0.05 / arr.length
		let time = c.currentTime
		arr.forEach(note => {
			this.playNote(c, note, gain, time, delay, dur)
		})
	}

	playNote(c, note, gain, time, delay, dur, type) {
		var o = c.createOscillator()
		var g = c.createGain()
		g.gain.value = 0
		g.gain.setValueAtTime(0, time + delay)
		g.gain.linearRampToValueAtTime(gain, time + delay + 0.25)
		g.gain.setValueAtTime(gain, time + delay + dur)
		g.gain.exponentialRampToValueAtTime(0.00001, time + delay + dur + 1)
		o.type = type || "sine"
		o.connect(g)
		o.frequency.value = note
		o.start(time + delay)
		o.stop(time + delay + dur + 2)
		g.connect(c.destination)
		window.setTimeout(() => {
			g.disconnect()
			o.disconnect()
		}, (delay + dur + 2) * 1000)
	}
	playSound(sound, dur = 1) {
		let soundKey = sound.id
		if (muted) return
		dur *= sound.dur * rndBtwn(0.9, 1.1)
		if (!hsOwnProperty(this.queue, soundKey)) {
			this.queue[soundKey] = []
		}
		let qu = this.queue[soundKey]
		if (qu.length > sound.max) return
		let c = this.ctx
		let time = c.currentTime
		let o = c.createOscillator()
		o.frequency.value = sound.freq * rndBtwn(0.9, 1.1)
		o.type = sound.type || "sine"
		let g = c.createGain()
		g.gain.value = 0
		g.gain.setValueAtTime(0, time)
		sound.gains.forEach(ga => {
			g.gain.linearRampToValueAtTime(ga[1], time + dur * ga[0])
		})
		if (sound.freqs) {
			sound.freqs.forEach(ga => {
				o.frequency.exponentialRampToValueAtTime(ga[1], time + dur * ga[0])
			})
		}
		o.connect(g)
		o.start(time)
		o.stop(time + dur)
		g.connect(c.destination)
		qu.push(o)
		window.setTimeout(() => {
			g.disconnect()
			o.disconnect()
			qu.splice(qu.indexOf(o), 1)
		}, (dur + 0.1) * 1000)
	}
}
var sounds = {
	shoot: {
		gains: [
			[0.1, 0.03],
			[0.1, 0.08],
			[1, 0]
		],
		freq: 140,
		dur: 0.1,
		max: 5,
		id: "shoot"
	},
	hit: {
		gains: [
			[0.1, 0.5],
			[0.15, 0.1],
			[0.2, 0.4],
			[0.25, 0.1],
			[0.3, 0.3],
			[0.4, 0.1],
			[1, 0]
		],
		freq: 30,
		dur: 1,
		type: "sine",
		max: 5,
		id: "hit"
	},
	explosion: {
		gains: [
			[0.1, 0.5],
			[0.12, 0.1],
			[0.14, 0.5],
			[0.16, 0.1],
			[0.18, 0.5],
			[1, 0]
		],
		freq: 40,
		dur: 0.6,
		max: 2,
		id: "explosion"
	},
	merge: {
		gains: [
			[0.1, 0.1],
			[0.9, 0.1],
			[1, 0]
		],
		freqs: [[1, 440]],
		freq: 80,
		dur: 0.5,
		max: 1,
		id: "merge"
	}
}
