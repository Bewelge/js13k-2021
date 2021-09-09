import { components } from "./components.js"
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
import {
	appendChildren,
	createCnv,
	createDialog,
	createDiv,
	getButton,
	subTitleDiv,
	titleDiv
} from "./Util.js"

export const openWindow = (player, enemy, callback) => {
	let scale = Math.min(150, Math.max(30, window.innerWidth / 8))

	let dialog = createDialog()
	let cont = createDiv("cont")

	dialog.appendChild(titleDiv("Assimilation"))
	dialog.appendChild(
		subTitleDiv(
			"You destroyed all of the " + enemy.race + "s. Now steal their tech."
		)
	)
	dialog.appendChild(cont)
	dialog.appendChild(subTitleDiv("Click Ship parts on the right to assimilate"))

	let ship0 = createDiv("col")
	let components0 = createDiv("col")
	let stats = createDiv("colWide")
	let ship1 = createDiv("col")
	let components1 = createDiv("col")

	let ship0Cnv = createCnv(scale, scale * 2)
	let cShip0 = ship0Cnv.getContext("2d")
	let ship1Cnv = createCnv(scale, scale * 2)
	let cShip1 = ship1Cnv.getContext("2d")

	ship0.appendChild(ship0Cnv)
	ship1.appendChild(ship1Cnv)

	let isClosed = false

	let curOpts = {
		hull: player.shipOpts.hull,
		wings: player.shipOpts.wings,
		weapons: player.shipOpts.weapons,
		thrust: player.shipOpts.thrust
	}

	const renderCurShip = opts => {
		cShip0.clearRect(0, 0, scale, scale * 2)
		cShip1.clearRect(0, 0, scale, scale * 2)
		let renderOpts = {
			ang: -Math.PI * 0.5,
			dis: 0.1,
			boost: true,
			boostLeft: true,
			boostRight: true
		}
		renderShip(
			cShip0,
			scale / 2,
			scale,
			scale / 5,
			opts,
			-Math.PI * 0.5,
			renderOpts
		)
		renderShip(
			cShip1,
			scale / 2,
			scale,
			scale / 5,
			enemy.shipOpts,
			-Math.PI * 0.5,
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
		compDiv0.appendChild(compImg0)

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

			statCol0.appendChild(divVal)
			statColChange.appendChild(divValChange)
			statColName.appendChild(divName)
			statCol1.appendChild(divValEnemy)
		})

		let compDiv1 = createDiv("comp clickable")
		let compImg1 = createCnv(scale, scale)
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
		components1.appendChild(compDiv1)
	})

	appendChildren(cont, [ship0, components0, stats, components1, ship1])

	let confirmBut = getButton("Confirm", () => {
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
	})

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

		c0.clearRect(-150, -150, 300, 300)
		c0.save()
		c0.shadowBlur = "15px"
		c0.shadowColor = "red"

		comp.render(c0, curOpts)
		c0.restore()

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

export function formatNum(num, denom) {
	if (num == 0) return num
	denom =
		denom ||
		Math.ceil(Math.abs(Math.log10(Math.abs(Math.max(-1, Math.min(1, num)))))) +
			1

	return Math.floor(Math.pow(10, denom) * num) / Math.pow(10, denom)
}
