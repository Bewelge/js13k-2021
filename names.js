var vowel = "AEIOUY"
var consonant = "BCDFGHJKLMNPQRSTVWXY"
export const getRaceName = rn => {
	let str = ""
	for (let i = Math.round(rn()); i < 3 + rn() * 3; i++) {
		let letter =
			(i + 1) % 2
				? vowel[Math.floor(rn() * (vowel.length - 0.1))]
				: consonant[Math.floor(rn() * (consonant.length - 0.1))]
		str += str.length == 0 ? letter : letter.toLowerCase()
	}
	str += ["ian", "ord", "an", "ar", "'ok"][Math.floor(rn() * 4.9)]
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
export const getGalaxyName = rn => {
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
