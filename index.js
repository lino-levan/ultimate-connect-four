const express = require('express')
const app = express()
const http = require('http').Server(app)
const io = require('socket.io')(http)

app.use(express.static('public'))

var games = {}

io.on('connection', (socket) => {
  console.log('a user connected')
  socket.on('disconnect', () => {
    console.log('user disconnected')
  })

  socket.on('create_game', (id) => {
    console.log(id)

    games[id] = {player1:socket.id, board: new Array(7).fill(0).map(()=>new Array(7).fill(0).map(()=>0)), powerups:[[2,2],[2,4],[3,3],[4,2],[4,4]]}
    games[id].turn = {player1:false, player2:true}
    games[id].power = {player1:"none", player2:"none"}

    emit_board(id)

    console.log(games[id])
  })

  socket.on('join_game', (id) => {
    if(games[id] && !games[id].player2) {
      games[id].player2 = socket.id

      emit_board(id)

      switch_turns(id)
    } else {
      socket.emit('join_error')
    }
  })

  socket.on('drop_coin', (id, column) => {
    if(!games[id])
      return

    var powerups_list = ["bomb"]

    let isPlayer1 = games[id].player1 === socket.id
    for(let i = 6;i>=0;i--) {
      if(games[id].board[column][i] === 0) {
        games[id].board[column][i] = isPlayer1?1:2

        // handle powerups obtained
        games[id].powerups.forEach((spot) => {
          if(spot[0] === column && spot[1] === i) {
            if(isPlayer1) {
              games[id].power.player1 = powerups_list[Math.floor(Math.random()*powerups_list.length)]
            } else {
              games[id].power.player2 = powerups_list[Math.floor(Math.random()*powerups_list.length)]
            }
          }
        })
        break;
      }
    }

    let who_won = won(id)

    emit_board(id)
    if(who_won===null) {
      switch_turns(id)
    } else {
      emit_win(id, who_won)
    }
  })

  socket.on('drop_power', (id, column) => {
    if(!games[id])
      return

    let isPlayer1 = games[id].player1 === socket.id

    let power = isPlayer1 ? games[id].power.player1 : games[id].power.player2

    if (power === "bomb") {
      for(let i = 6;i>=0;i--) {
        if(games[id].board[column][i] === 0) {
          games[id].board[column][i+1] = 0
          break;
        }
      }
    }

    let who_won = won(id)

    emit_board(id)
    if(who_won===null) {
      switch_turns(id)
    } else {
      emit_win(id, who_won)
    }
  })

  function switch_turns(id){
    games[id].turn.player1 = !games[id].turn.player1
    games[id].turn.player2 = !games[id].turn.player2

    io.to(games[id].player1).emit('set_turn', games[id].turn.player1)
    io.to(games[id].player2).emit('set_turn', games[id].turn.player2)
  }

  function emit_board(id) {
    io.to(games[id].player1).emit('set_board', games[id].board, games[id].powerups, games[id].power)

    if(games[id].player2) {
      io.to(games[id].player2).emit('set_board', games[id].board, games[id].powerups, games[id].power)
    }
  }

  function emit_win(id, winner) {
    io.to(games[id].player1).emit('win', winner)
    io.to(games[id].player2).emit('win', winner)
  }

  function won(id) {
    var wins = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]]

    for(let x = 0;x<7;x++) {
      for(let y = 0;y<7;y++) {
        let exit = false
        let color = games[id].board[x][y]


        if(color===0){
          continue
        }

        for(let w = 0;w<wins.length;w++) {
          for(let k = 0;k<4;k++) {
            let newX = x + (wins[w][0] * k)
            let newY = y + (wins[w][1] * k)

            if(newX>6 || newX<0 || newY>6 || newY<0) {
              break
            }

            if(games[id].board[newX][newY] !== color) {
              break
            } else if(k===3) {
              return color
            }
          }
        }
      }
    }

    return null
  }
})

http.listen(3001, () => {
  console.log('listening on *:3001')
})
