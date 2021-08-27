import { dist, distPoints } from "./Util.js"

function updateEnemy(enemy) {
	let isEnemyNear = getEnemyNear()
	if (isEnemyNear) {
		//fly to & attack player
	} else {
		//fly around
		if (!enemy.aim) {
			enemy.aim = finyRandomAim(enemy)
		}
	}
}
