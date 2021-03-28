var socket = io();

socket.on('connect', () => {
  socket.emit("change_settings", {control:socket.io.engine.id})
  // console.log(socket.io.engine.id)
})

socket.on("names", (names) => {
  names.push("")
  document.getElementById("names").innerHTML = "Total: " + (names.length-1) + "<br>" + names.map(name=>name.split("<").join("\<").split(">").join("\>")).join("<button onclick=\"kick(this);\">kick</button><br>")
})

function kick(event) {
  console.log(event.target)
}

function start_game() {
  socket.emit("start_games")
}

function open_tournament() {
  socket.emit("change_settings", {closed:false})
}

function close_tournament() {
  socket.emit("change_settings", {closed:true})
}
