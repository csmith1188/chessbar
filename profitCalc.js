price = 100
winAmount = 110
console.log('\nPlay price:', price)
console.log('Payout amount:', winAmount)
console.log()

let initialTax = 2 * (price * 0.1)
console.log('Initial tax:', initialTax)

let initialProfit = (2 * price) - initialTax
console.log('Initial profit:', initialProfit, 'Per employee:', initialProfit / 2)

let winningOutgo = ((winAmount / 2) / .9) * 2
let winTax = (winAmount) * .1
console.log('Winning outgo:', winningOutgo)
console.log('Winning tax:', winTax)

let totalTax = initialTax + winTax
let totalProfit = initialProfit - winningOutgo

console.log('\nTotal tax', totalTax)
console.log('Total profit', totalProfit, 'Per employee:', totalProfit / 2)

let difference = totalProfit - totalTax

if (difference > 0) {
    console.log('We make', difference, 'more than Formbar.')
} else {
    console.log('We make', -difference, 'less than Formbar.')
}

console.log()