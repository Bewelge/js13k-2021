import {
	getMergedHull,
	getMergedThrust,
	getMergedWeapons,
	getMergedWings
} from "./ship.js"
import {
	renderHull,
	renderShip,
	renderThrust,
	renderWeapons,
	renderWings
} from "./ShipRender.js"

export const openWindow = (player, enemy, callback) => {
	let createDiv = className => {
		let div = document.createElement("div")
		div.className = className
		return div
	}
	let scale = Math.min(150, Math.max(30, window.innerWidth / 8))

	let dialog = createDiv("dialog")

	let cont = createDiv("cont")
	let title = createDiv("title")

	title.innerHTML = "Assimilation"
	let subTitle = createDiv("subTitle")
	subTitle.innerHTML =
		"You destroyed all of the " + enemy.race + "s. Now steal their tech."
	let subTitle2 = createDiv("subTitle")
	subTitle2.innerHTML = "Click Ship parts on the right to assimilate"

	dialog.appendChild(title)
	dialog.appendChild(subTitle)
	dialog.appendChild(cont)
	dialog.appendChild(subTitle2)

	let ship0 = createDiv("col")
	let components0 = createDiv("col")
	let stats = createDiv("colWide")
	let stats2 = createDiv("col")
	let ship1 = createDiv("col")
	let components1 = createDiv("col")

	let ship0Cnv = document.createElement("canvas")
	ship0Cnv.width = scale
	ship0Cnv.height = scale * 2
	let cShip0 = ship0Cnv.getContext("2d")
	// let ship00Cnv = document.createElement("canvas")
	// ship00Cnv.width = 150
	// ship00Cnv.height = 300
	// let cShip00 = ship00Cnv.getContext("2d")

	let isClosed = false

	// renderShip(
	// 	cShip00,
	// 	75,
	// 	75,
	// 	30,
	// 	player.shipOpts,
	// 	1,
	// 	-Math.PI * 0.5,
	// 	-Math.PI * 0.5,
	// 	0.1,
	// 	false,
	// 	true
	// )
	let curOpts = {
		hull: player.shipOpts.hull,
		wings: player.shipOpts.wings,
		weapons: player.shipOpts.weapons,
		thrust: player.shipOpts.thrust
	}

	ship0.appendChild(ship0Cnv)
	// ship0.appendChild(ship00Cnv)

	let ship1Cnv = document.createElement("canvas")
	ship1Cnv.width = scale
	ship1Cnv.height = scale * 2
	let cShip1 = ship1Cnv.getContext("2d")
	// renderShip(
	// 	cShip1,
	// 	75,
	// 	150,
	// 	40,
	// 	enemy.shipOpts,
	// 	1,
	// 	-Math.PI * 0.5,
	// 	-Math.PI * 0.5,
	// 	0.1,
	// 	false,
	// 	true
	// )
	ship1.appendChild(ship1Cnv)

	let renderCurShip = opts => {
		cShip0.clearRect(0, 0, scale, scale * 2)
		cShip1.clearRect(0, 0, scale, scale * 2)
		renderShip(
			cShip0,
			scale / 2,
			scale,
			scale / 5,
			opts,
			1,
			-Math.PI * 0.5,
			-Math.PI * 0.5,
			0.1,
			false,
			true
		)
		renderShip(
			cShip1,
			scale / 2,
			scale,
			scale / 5,
			enemy.shipOpts,
			1,
			-Math.PI * 0.5,
			-Math.PI * 0.5,
			0.1,
			false,
			true
		)

		if (!isClosed) {
			window.requestAnimationFrame(() => renderCurShip(opts))
		}
	}

	renderCurShip(curOpts)
	let comps = {
		weapons: {
			statDivs: {},
			statVals: {},
			statChangeDivs: {},
			formatters: {
				"Fire Rate": val => formatNum(60 / val, 3),
				"Shot Speed": val => formatNum(100 * val, 1)
			},
			suffixes: {
				"Fire Rate": "/s",
				"Shot Speed": "km/s"
			},
			stats: {
				HP: player.shipOpts.weapons.maxHp,
				"Fire Rate": player.fireRate,
				Damage: player.dmg,
				"Shot Speed": player.shotSpeed,
				Range: player.shotLife * player.shotSpeed
			},
			statsEnemy: {
				HP: enemy.shipOpts.weapons.maxHp,
				"Fire Rate": enemy.fireRate,
				Damage: enemy.dmg,
				"Shot Speed": enemy.shotSpeed,
				Range: enemy.shotLife * enemy.shotSpeed
			},
			render: (c, opts) => {
				c.save()
				c.translate(0, ((1 / (scale / 5)) * scale) / 5)
				renderWeapons(c, opts, 0.5, 0.5)
				c.restore()
			},
			getMerged: (opts1, opts2, tween) =>
				getMergedWeapons(opts1.weapons, opts2.weapons, tween)
		},
		hull: {
			statDivs: {},
			statVals: {},
			statChangeDivs: {},
			stats: {
				HP: player.shipOpts.hull.maxHp
			},
			statsEnemy: {
				HP: enemy.shipOpts.hull.maxHp
			},
			render: (c, opts) => renderHull(opts, c, 0.5, 0.5),
			getMerged: (opts1, opts2, tween) =>
				getMergedHull(opts1.hull, opts2.hull, tween)
		},
		wings: {
			formatters: {
				"Turn Speed": val => formatNum(100 * val, 3)
			},
			statDivs: {},
			statVals: {},
			statChangeDivs: {},
			stats: {
				HP: player.shipOpts.wings.maxHp,

				"Turn Speed": player.turnSpeed
			},
			statsEnemy: {
				HP: enemy.shipOpts.wings.maxHp,
				"Turn Speed": enemy.turnSpeed
			},
			render: (c, opts) => renderWings(opts, c, 0.5, 0.5),
			getMerged: (opts1, opts2, tween) =>
				getMergedWings(curOpts.hull.h, opts1.wings, opts2.wings, tween)
		},
		thrust: {
			formatters: {
				"Thrust Speed": val => formatNum(1000 * val, 3)
			},
			statDivs: {},
			statVals: {},
			statChangeDivs: {},
			stats: {
				HP: player.shipOpts.wings.maxHp,
				"Thrust Speed": player.speed
			},
			statsEnemy: {
				HP: enemy.shipOpts.wings.maxHp,
				"Thrust Speed": enemy.speed
			},
			render: (c, opts) => {
				c.save()
				c.translate(0, -((1 / (scale / 5)) * scale) / 4)
				renderThrust(opts, c, 0.5, 0.5, true)
				c.restore()
			},
			getMerged: (opts1, opts2, tween) =>
				getMergedThrust(curOpts.hull, opts1.thrust, opts2.thrust, tween)
		}
	}
	Object.keys(comps).forEach(compName => {
		let compDiv0 = createDiv("comp")
		let compImg0 = getCompCanvas(scale)
		let c0 = compImg0.getContext("2d")
		c0.translate(scale / 2, scale / 2)
		c0.scale(scale / 5, scale / 5)
		comps[compName].render(c0, curOpts)
		compDiv0.appendChild(compImg0)

		let compStats0 = createDiv("compWide")
		let statCol0 = createDiv("statCol")
		let statColChange = createDiv("statCol")
		let statColName = createDiv("statCol")
		let statColEmpty = createDiv("statCol")
		let statCol1 = createDiv("statCol")
		compStats0.appendChild(statCol0)
		compStats0.appendChild(statColChange)
		compStats0.appendChild(statColName)
		compStats0.appendChild(statColEmpty)
		compStats0.appendChild(statCol1)
		Object.entries(comps[compName].stats).forEach(entry => {
			let statName = entry[0]
			let val = entry[1]

			let divVal = createDiv("statValue")
			let divValChange = createDiv("statValueChange")
			let divValEnemy = createDiv("statValue2")

			let divName = createDiv("statName")
			divName.innerHTML = statName

			comps[compName].statDivs[entry[0]] = divVal
			comps[compName].statChangeDivs[entry[0]] = divValChange
			divValChange.innerHTML = "(+0)"
			comps[compName].statVals[entry[0]] = val
			divVal.innerHTML = getFormattedStat(comps[compName], statName, val)
			divValEnemy.innerHTML = getFormattedStat(
				comps[compName],
				statName,
				comps[compName].statsEnemy[statName]
			)

			statCol0.appendChild(divVal)
			statColChange.appendChild(divValChange)
			statColName.appendChild(divName)
			statCol1.appendChild(divValEnemy)
			// compStats0.appendChild(statRow)
		})
		// let compStats1 = createDiv("comp")
		// Object.entries(comps[compName].statsEnemy).forEach(entry => {
		// 	let statRow = createDiv("statRow")

		// 	let statName = entry[0]
		// 	let val = entry[1]

		// 	let divName = createDiv("statName2")
		// 	divName.innerHTML = statName
		// 	let divVal = createDiv("statValue2")
		// 	divVal.innerHTML = getFormattedStat(comps[compName], statName, val)

		// 	statRow.appendChild(divVal)
		// 	statRow.appendChild(divName)
		// 	compStats1.appendChild(statRow)
		// })

		let compDiv1 = createDiv("comp clickable")
		let compImg1 = getCompCanvas(scale)

		let c1 = compImg1.getContext("2d")
		c1.translate(scale / 2, scale / 2)
		c1.scale(scale / 5, scale / 5)
		comps[compName].render(c1, enemy.shipOpts)
		compDiv1.appendChild(compImg1)

		compImg1.addEventListener("click", () => {
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

		components0.appendChild(compDiv0)
		stats.appendChild(compStats0)
		// stats2.appendChild(compStats1)
		components1.appendChild(compDiv1)
	})

	cont.appendChild(ship0)
	cont.appendChild(components0)
	cont.appendChild(stats)
	// cont.appendChild(stats2)
	cont.appendChild(components1)
	cont.appendChild(ship1)

	let confirmBut = document.createElement("Button")
	confirmBut.innerHTML = "Confirm"
	confirmBut.onclick = () => {
		player.shipOpts = curOpts
		dialog.style.height = "0%"
		window.setTimeout(() => {
			document.body.removeChild(dialog)
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
	}
	dialog.appendChild(confirmBut)

	window.setTimeout(() => (dialog.style.height = "100%"), 50)
	document.body.appendChild(dialog)
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
	let tweenCounter = 50
	let tweenTick = null

	tweenCounter = 50
	let tween = (from, to) => {
		if (from == undefined || to == undefined) return
		merging = true
		tweenCounter--
		let merged = comps[compName].getMerged(
			from,
			to,
			Math.max(0.5, tweenCounter / 50)
		)
		curOpts[compName] = merged

		if (compName == "hull" || compName == "thrust") {
			curOpts.thrust.top = curOpts.hull.h / 2
			curOpts.thrust.w1 = curOpts.hull.bottomW
			curOpts.thrust = comps.thrust.getMerged(curOpts, curOpts, 0.5)
		}

		c0.clearRect(-150, -150, 300, 300)
		c0.save()
		c0.shadowBlur = "15px"
		c0.shadowColor = "red"

		comps[compName].render(c0, curOpts)

		c0.restore()
		// comps[compName].render(c0, curOpts)
		if (tweenCounter > 0) {
			window.requestAnimationFrame(() => {
				tween(from, to)
			})
		} else {
			merging = false
		}
	}
	if (compImg1.classList.contains("selected")) {
		compImg1.classList.remove("selected")
		comps[compName].selected = false
		Object.entries(comps[compName].stats).forEach(entry => {
			let statName = entry[0]
			let comp = comps[compName]
			comp.statDivs[statName].innerHTML = getFormattedStat(
				comp,
				statName,
				comp.statVals[statName]
			)
			comp.statChangeDivs[statName].innerHTML = "(+0)"
			comp.statChangeDivs[statName].className = ""
		})
		tween(curOpts, player.shipOpts)
	} else {
		compImg1.classList.add("selected")
		comps[compName].selected = true
		tweenCounter = 50
		Object.entries(comps[compName].stats).forEach(entry => {
			let statName = entry[0]
			let comp = comps[compName]
			comp.statDivs[statName].innerHTML = getFormattedStat(
				comp,
				statName,
				(comp.statVals[statName] + comp.statsEnemy[statName]) / 2
			)
			let formatter =
				comp.formatters && comp.formatters[statName]
					? comp.formatters[statName]
					: formatNum
			let statChange =
				formatter((comp.statVals[statName] + comp.statsEnemy[statName]) / 2) -
				formatter(comp.statVals[statName])

			statChange > 0
				? (comp.statChangeDivs[statName].className = "plus")
				: statChange < 0
				? (comp.statChangeDivs[statName].className = "minus")
				: (comp.statChangeDivs[statName].className = "")

			comp.statChangeDivs[statName].innerHTML =
				"(" + (statChange >= 0 ? "+" : "") + formatNum(statChange) + ")"
		})
		tween(player.shipOpts, enemy.shipOpts)
	}
	return { tweenCounter, tweenTick }
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

function getCompCanvas(scale) {
	let compImg0 = document.createElement("canvas")
	compImg0.height = scale
	compImg0.width = scale
	return compImg0
}
function formatNum(num, denom) {
	if (num == 0) return num
	denom =
		denom ||
		Math.ceil(Math.abs(Math.log10(Math.abs(Math.max(-1, Math.min(1, num)))))) +
			1

	return Math.floor(Math.pow(10, denom) * num) / Math.pow(10, denom)
}
