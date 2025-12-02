const socket = io()

socket.on('redirect', (url) => {
    console.log(`Redirecting to ${url}`)
    window.location.href = url
})

socket.on('youAre', (foo) => {
    me = foo
    // console.log(me)
})