export class Particles {
	constructor(setup, renderEl, tearDown, max) {
		this.setup = setup
		this.renderEl = renderEl
		this.tearDown = tearDown
		this.list = []
		this.max = max
	}
	render() {
		this.setup()
		for (let i = this.list.length - 1; i >= 0; i--) {
			if (--this.list[i][0] > 0) {
				this.renderEl(this.list[i])
			} else {
				this.list.splice(i, 1)
			}
		}
		this.tearDown()
	}
	add(el) {
		this.list.push(el)
		this.list.length > this.max ? this.list.splice(0, 1) : null
	}
}
