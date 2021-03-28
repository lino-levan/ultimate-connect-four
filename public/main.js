var game_menu_div = document.getElementById("game_menu")

var canvas = document.getElementById("canvas")
var ctx = canvas.getContext("2d")

var board = new Array(7).fill(0).map(()=>new Array(7).fill(0))

var powerups = [[2,2],[2,4],[3,3],[4,2],[4,4]]

var powers = {player1:"none", player2:"none"}

var code = ""

var names = ["", ""]

var player = 1

var myturn = false

function draw_board() {
  ctx.fillStyle = "#0011ee"
  ctx.fillRect(0,0,700,700)

  for(let x = 0;x<7;x++) {
    for(let y= 0;y<7;y++) {
      if(board[x][y] === 0) {
        ctx.fillStyle = "#ffffff"

        powerups.forEach((spot, i) => {
          if(spot[0] === x && spot[1] === y) {
            ctx.fillStyle = "#99ff99"
          }
        })
      }

      if(board[x][y] === 1) {
        ctx.fillStyle = "#ff0000"
      }

      if(board[x][y] === 2) {
        ctx.fillStyle = "#ffff00"
      }
      ctx.beginPath()
      ctx.arc(x*100 + 50, y*100 + 50, 40, 0, 2 * Math.PI)
      ctx.fill()
    }
  }

  op = player === 1 ? 2 : 1

  document.getElementById("you").innerHTML = `<div><h1>You</h1><p>Color: ${player===1?"red":"yellow"}</p><p>Powerups: ${player===1?powers.player1:powers.player2}</p></div>`
  document.getElementById("opponent").innerHTML = `<div><h1>${names[op-1].length === 0? "Oppponent":names[op-1]}</h1><p>Color: ${player===1?"yellow":"red"}</p><p>Powerups: ${player===1?powers.player2:powers.player1}</p></div>`

  if(mouseX) {
    let column = Math.clamp(Math.floor((mouseX)/100), 0, 6)

    if(board[column][0]===0 && myturn) {
      ctx.fillStyle = player===1?"#ff0000":"#ffff00"
      ctx.beginPath()
      ctx.arc(column*100 + 50, 50, 40, 0, 2 * Math.PI)
      ctx.fill()
    }
  }
}

draw_board()

var socket = io();

function setup_sockets () {
  socket.on("set_board", (b,p, po, na)=>{
    console.log(p)
    board = b
    powerups = p
    powers = po
    names = na
    draw_board()

    document.getElementById("gamecode").innerText = "Game Code: " + code
    document.getElementById("game_menu").style.display = "none"
  })

  socket.on("join_error", ()=>{
    code_input.value = "INVALID CODE"
  })

  socket.on("set_turn", (t)=>{
    myturn = t
    document.getElementById("gamecode").innerText = myturn?"Your Turn":"Opponent's Turn"
  })

  socket.on("win", (winner)=>{
    if(winner === player) {
      document.getElementById("gamecode").innerText = "Win!"
    } else {
      document.getElementById("gamecode").innerText = "Lose!"

      window.close()
      socket.disconnect()
    }
  })

  socket.on("game_cancelled", () => {
    document.getElementById("gamecode").innerText = "You get a free pass for next round."
  })

  socket.on("kick", ()=> {
    window.close()
    socket.disconnect()
  })

  socket.on("create_game", (other_person) => {
    code = Math.random().toString(36).substring(7)
    document.getElementById("gamecode").innerText = "Game Code: " + code
    document.getElementById("game_menu").style.display = "none"
    player = 1

    socket.emit('create_game', code, other_person)
  })

  socket.on("join_game", (c) => {
    code = c
    player = 2
    socket.emit('join_game', code)
  })
}

setup_sockets()

var mouseX = 0;
var mouseY = 0;

document.getElementById("name").addEventListener("keyup", (e) => {
  if (e.keyCode === 13) {
    event.preventDefault();

    document.getElementById("name").style.display = "none"
    document.getElementById("whole").style.display = "flex"

    socket.emit("submit_name", document.getElementById("name").value)
  }
})

document.onmousemove = (e) => {
  let rect = canvas.getBoundingClientRect()
  mouseX = e.clientX - rect.left
  mouseY = e.clientY - rect.top

  draw_board()
}

canvas.onclick = (e) => {
  let column = Math.clamp(Math.floor((mouseX)/100), 0, 6)

  console.log(myturn, board[column][0])

  if(board[column][0]===0 && myturn) {
    socket.emit("drop_coin", code, column)
  }
}

document.onkeydown = (e) => {
  if(e.code === "Space" && myturn) {
    let column = Math.clamp(Math.floor((mouseX)/100), 0, 6)
    socket.emit("drop_power", code, column)
  }
}

Math.clamp = function(number, min, max) {
  return Math.max(min, Math.min(number, max));
}
