const express = require('express')
const app = express()
const http = require('http').Server(app)

const io = require('socket.io')(http)

app.use(express.static('public'))

var tournament = {control:"", names:[], closed: false}

var games = {}

io.on('connection', (socket) => {
  socket.on('disconnect', () => {
    for(let i = 0;i<tournament.names.length;i++) {
      if(tournament.names[i][1] === socket.id) {
        tournament.names.splice(i, 1)
        break
      }
    }
    io.to(tournament.control).emit('names', tournament.names.map(name=>name[0]))
  })

  socket.on('change_settings', (settings)=>{
    if(settings.control !== undefined) {
      tournament.control = settings.control
      io.to(tournament.control).emit('names', tournament.names.map(name=>name[0]))
    }

    if(settings.closed !== undefined) {
      tournament.closed = settings.closed
      // console.log(tournament.closed)
    }
  })

  socket.on('submit_name', (name) => {
    console.log(tournament.closed)
    if(tournament.closed) {
      socket.emit('kick')
    } else {
      tournament.names.push([name, socket.id])
      io.to(tournament.control).emit('names', tournament.names.map(name=>name[0]))
    }
  })

  socket.on('start_games', () => {
    for(let i = 0;i<tournament.names.length;i+=2) {
      if(i+1 === tournament.names.length) {
        // deal with extra person
        io.to(tournament.names[i][1]).emit('game_cancelled')
      } else {
        // automatically make person create game
        io.to(tournament.names[i][1]).emit('create_game', i+1)
      }
    }
  })

  socket.on('create_game', (id, other_person) => {
    games[id] = {player1:socket.id, board: new Array(7).fill(0).map(()=>new Array(7).fill(0).map(()=>0)), powerups:[[2,2],[2,4],[3,3],[4,2],[4,4]], names: ["", ""]}
    games[id].turn = {player1:false, player2:true}
    games[id].power = {player1:"none", player2:"none"}

    for(let i = 0;i<tournament.names.length;i++) {
      if(tournament.names[i][1] === socket.id) {
        games[id].names[0] = tournament.names[i][0]
        break
      }
    }

    games[id].names[1] = tournament.names[[other_person]][0]


    apply_board_gravity(id)

    emit_board(id)

    // make other person join game
    io.to(tournament.names[other_person][1]).emit('join_game', id)

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

    var powerups_list = ["bomb","flip","rotate"]

    let isPlayer1 = games[id].player1 === socket.id

    if(!((isPlayer1 && games[id].turn.player1) || (!isPlayer1 && games[id].turn.player2)))
      return

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

    if(!((isPlayer1 && games[id].turn.player1) || (!isPlayer1 && games[id].turn.player2)))
      return

    let power = isPlayer1 ? games[id].power.player1 : games[id].power.player2

    if (power === "bomb") {
      for(let i = 6;i>=0;i--) {
        if(games[id].board[column][i] === 0) {
          for(let x = -1;x<=1;x++) {
            for(let y = -1;y<=1;y++) {
              if(column+x>6 || column+x<0 || i+y>6 || i+y<0) {
                continue
              }
              games[id].board[column+x][i+y] = 0
            }
          }
          break
        }
      }
    }

    if (power === "rotate") {
      let board_copy = JSON.parse(JSON.stringify(games[id].board))

      for(let x = 0;x<7;x++) {
        for(let y = 0;y<7;y++) {
          games[id].board[x][y] = board_copy[6 - y][x]
        }
      }
    }

    if (power === "flip") {
      for(let i = 6;i>=0;i--) {
        if(games[id].board[column][i] === 0) {
          if(i === 6) {
            games[id].board[column][i] = isPlayer1 ? 1 : 2
          } else {
            games[id].board[column][i] = games[id].board[column][i+1]
            games[id].board[column][i+1] = isPlayer1 ? 1 : 2
          }
          break
        }
      }
    }

    if(power !== "none") {
      apply_board_gravity(id)

      if(isPlayer1) {
        games[id].power.player1 = "none"
      } else {
        games[id].power.player2 = "none"
      }

      let who_won = won(id)

      emit_board(id)
      if(who_won===null) {
        switch_turns(id)
      } else {
        emit_win(id, who_won)
        delete games[id]
      }
    }
  })

  function switch_turns(id){
    games[id].turn.player1 = !games[id].turn.player1
    games[id].turn.player2 = !games[id].turn.player2

    io.to(games[id].player1).emit('set_turn', games[id].turn.player1)
    io.to(games[id].player2).emit('set_turn', games[id].turn.player2)
  }

  function emit_board(id) {
    io.to(games[id].player1).emit('set_board', games[id].board, games[id].powerups, games[id].power, games[id].names)

    if(games[id].player2) {
      io.to(games[id].player2).emit('set_board', games[id].board, games[id].powerups, games[id].power, games[id].names)
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

  function apply_board_gravity (id) {
    for (let col = 0; col < 7; col++){
      let last = 0;
      let arr = []
      for (let row = 6; row >= 0; row--){
        if (games[id].board[col][row] != 0){
          arr.push(games[id].board[col][row]);
        }
        games[id].board[col][row] = 0;
      }
      let index = 0;
      for (let row = 6; row >= 0; row--){
        if (index >= arr.length){
          break;
        }
        games[id].board[col][row] = arr[index];
        index += 1;
      }
    }
  }
})

http.listen(3001, () => {
  console.log('listening on *:3001')
})
