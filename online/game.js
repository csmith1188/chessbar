const { Board } = require('../engine/main')
/*
 ::::::::      :::     ::::    ::::  ::::::::::
:+:    :+:   :+: :+:   +:+:+: :+:+:+ :+:
+:+         +:+   +:+  +:+ +:+:+ +:+ +:+
:#:        +#++:++#++: +#+  +:+  +#+ +#++:++#
+#+   +#+# +#+     +#+ +#+       +#+ +#+
#+#    #+# #+#     #+# #+#       #+# #+#
 ########  ###     ### ###       ### ##########
*/

class Game {
    constructor(id, users = []) {
        this.id = id
        this.users = users
        this.board = new Board()
        console.log(this)
    }

    assignSides() {
        console.log(this.users)
        this.users[0].side = 'white'
        if (this.users[1]) this.users[1].side = 'black'
    }

    join(user) {
        user.side = 'spectating'
        this.users.push(user)
        this.assignSides()
    }

}

module.exports = { Game }