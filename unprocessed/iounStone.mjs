const tokenD = canvas.tokens.controlled[0];

new Sequence()
    .effect("jb2a.ioun_stones.01.blue.awareness")
        .attachTo(tokenD)
        .scale(0.25)
        .spriteOffset({ x: 50, y: -50 })
        .zeroSpriteRotation(true)
        .loopProperty("spriteContainer", "rotation", { from: 0, to: 360, duration: 3000})
        .persist()
        .name(`${tokenD.data.name} - Ioun Stone Awareness`)
    .play()