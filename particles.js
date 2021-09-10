export const BULLET_HITS = 0
export const EXPLOSIONS = 1
export const BULLETSMOKES = 2
export const TRAIL = 3
export const BROKENCOMPS = 4
export class Particles {
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
export const particles = new Particles()
