const socket = io()

socket.on('redirect', (url) => {
    window.location.href = url
})

socket.on('youAre', (foo) => {
    me = foo
    // console.log(me)
})